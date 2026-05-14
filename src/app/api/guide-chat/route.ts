import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGuideProfile } from "@/lib/guides";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "guide"; content: string };

export async function POST(request: Request) {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = process.env.TRANSCRIBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI chat is not configured." }, { status: 503 });
  }

  const { guideId, chapterTitle, firstName, messages } = (await request.json()) as {
    guideId?: string;
    chapterTitle?: string;
    firstName?: string;
    messages?: ChatMessage[];
  };

  const profile = getGuideProfile(guideId);
  const name = firstName?.trim() ?? "";

  const namingInstructions = name
    ? [
        `Their preferred name is ${name}. Use it warmly but sparingly — about once every three or four replies, never in every message.`,
      ]
    : [
        `You do NOT yet know what to call this person. Your opening message already asked: "Is it ok if I ask you what I should call you?"`,
        `Interpret their reply:`,
        `- If they decline (e.g. "no", "not really", "rather not", "skip"), reply EXACTLY with: "No problem." then continue naturally with one warm opening question about their life. Do NOT ask for the name again.`,
        `- If they accept or simply provide a name (e.g. "yes, Mark", "I'm Sarah", "call me Liz", or just "Mark"), warmly acknowledge the name in one short sentence, then ask one gentle opening question about their life.`,
        `When — and only when — you have captured the name they want to be called, append a single line at the very end of your reply in this exact format (the client will strip it before showing it to the user):`,
        `[[NAME:<their name>]]`,
        `Use only the first name or nickname they provided. Do NOT include this marker if they declined or you are unsure.`,
      ];

  const systemPrompt = [
    `You are ${profile.name}, a life story guide helping someone record their personal legacy.`,
    `Your style: ${profile.style}. ${profile.vibe}.`,
    `The person is currently sharing stories from the chapter: "${chapterTitle ?? "their life"}".`,
    ...namingInstructions,
    ``,
    `Your role is to listen, reflect, and ask ONE thoughtful follow-up question that draws out more detail about what they just shared.`,
    `Keep your reply to 1-3 sentences. Be warm and specific to what they said — never give a generic response.`,
    `Do NOT offer suggestions or prompts unless specifically asked. Do NOT say "I can suggest another prompt".`,
    `End with a single open question that invites them to go deeper into their story.`,
  ]
    .filter(Boolean)
    .join("\n");

  const groqMessages = [
    { role: "system" as const, content: systemPrompt },
    ...(messages ?? []).map((m) => ({
      role: m.role === "guide" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    })),
  ];

  const baseUrl = (process.env.TRANSCRIBE_API_URL ?? "https://api.groq.com/openai/v1/audio/transcriptions")
    .replace(/\/audio\/transcriptions$/, "")
    .replace(/\/audio$/, "");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: groqMessages,
      max_tokens: 200,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ error: `AI service error: ${text}` }, { status: 502 });
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const reply = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!reply) {
    return NextResponse.json({ error: "Empty response from AI." }, { status: 502 });
  }

  return NextResponse.json({ reply });
}
