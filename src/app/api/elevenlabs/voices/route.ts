import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  category?: string;
};

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { voices: [], error: "ELEVENLABS_API_KEY is not configured." },
      { status: 200 },
    );
  }

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: {
        "xi-api-key": apiKey,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      return NextResponse.json(
        {
          voices: [],
          error: `Could not load ElevenLabs voices: ${body.slice(0, 200)}`,
        },
        { status: 200 },
      );
    }

    const payload = (await response.json()) as { voices?: ElevenLabsVoice[] };
    const voices = (payload.voices ?? []).map((voice) => ({
      id: voice.voice_id,
      name: voice.name,
      category: voice.category ?? "",
    }));

    return NextResponse.json({ voices });
  } catch {
    return NextResponse.json(
      { voices: [], error: "Failed to reach ElevenLabs voice API." },
      { status: 200 },
    );
  }
}
