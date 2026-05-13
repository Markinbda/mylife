import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ configured: false, error: "Supabase is not configured." }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ configured: false, error: "Not authenticated" }, { status: 401 });
  }

  const configured = Boolean(process.env.TRANSCRIBE_API_KEY);
  return NextResponse.json({ configured });
}

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
    return NextResponse.json(
      { error: "Transcription is not configured. Set TRANSCRIBE_API_KEY." },
      { status: 503 },
    );
  }

  const apiUrl =
    process.env.TRANSCRIBE_API_URL || "https://api.openai.com/v1/audio/transcriptions";
  const model = process.env.TRANSCRIBE_MODEL || "whisper-1";

  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const candidate = incoming.get("audio") ?? incoming.get("file");
  let file: File | null = candidate instanceof File ? candidate : null;
  const prompt = (incoming.get("prompt") ?? "").toString().trim();

  if (!file) {
    for (const value of incoming.values()) {
      if (value instanceof File) {
        file = value;
        break;
      }
    }
  }

  if (!file) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Empty audio file" }, { status: 400 });
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Audio too large (max 20MB)" }, { status: 413 });
  }

  const upstream = new FormData();
  upstream.append("file", file, file.name || "speech.webm");
  upstream.append("model", model);
  upstream.append("response_format", "json");
  if (prompt) upstream.append("prompt", prompt);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Transcription failed: ${errorText.slice(0, 300)}` },
        { status: response.status },
      );
    }

    const data = (await response.json()) as { text?: string };
    return NextResponse.json({ text: (data.text ?? "").trim() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Transcription request failed";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
