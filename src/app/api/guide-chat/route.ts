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

  const { guideId, chapterTitle, firstName, messages, pivotPrompt } = (await request.json()) as {
    guideId?: string;
    chapterTitle?: string;
    firstName?: string;
    messages?: ChatMessage[];
    pivotPrompt?: boolean;
  };

  const profile = getGuideProfile(guideId);
  const name = firstName?.trim() ?? "";

  const namingInstructions = name
    ? [
        `Their preferred name is ${name}. Use it warmly but very sparingly — roughly once every five to seven replies, never more often. Most replies should not mention their name at all.`,
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
    `Your role is to listen deeply, reflect back what you heard, and gently draw out more detail about what they just shared.`,
    `Aim for 3-6 sentences — warm, personal, and specific. Reference concrete details from earlier turns in this conversation when it makes the reply feel more connected (e.g. callback to a person, place, feeling, or event they mentioned before). Never invent facts they did not share.`,
    `Briefly mirror or honor what they said in one sentence, share a short observation or gentle insight, and then close with ONE open-ended follow-up question that invites them to go deeper.`,
    `Do NOT offer suggestions or prompts unless specifically asked. Do NOT say "I can suggest another prompt". Avoid generic platitudes.`,
    pivotPrompt
      ? `IMPORTANT: This is a natural pause point. Instead of your usual single follow-up question, briefly reflect on what they shared, then ask warmly whether they would like to keep exploring this same subject a little longer, or move on to something new. Make it feel like an invitation, not an interruption.`
      : ``,
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
      max_tokens: 500,
      temperature: 0.75,
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
