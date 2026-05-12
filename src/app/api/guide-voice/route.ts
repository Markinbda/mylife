import { NextRequest } from "next/server";
import { getGuideProfile } from "@/lib/guides";

export const runtime = "nodejs";

function resolveVoiceId(guideId: string, overrideVoiceId?: string) {
  if (overrideVoiceId?.trim()) return overrideVoiceId.trim();

  const byGuide: Record<string, string | undefined> = {
    friend: process.env.ELEVENLABS_VOICE_ID_FRIEND,
    archivist: process.env.ELEVENLABS_VOICE_ID_ARCHIVIST,
    coach: process.env.ELEVENLABS_VOICE_ID_COACH,
  };

  return byGuide[guideId] ?? process.env.ELEVENLABS_VOICE_ID;
}

export async function POST(req: NextRequest) {
  try {
    const { guideId, text, voiceId } = (await req.json()) as {
      guideId?: string;
      text?: string;
      voiceId?: string;
    };

    const script = (text ?? "").trim();
    if (!script) {
      return Response.json({ error: "Text is required." }, { status: 400 });
    }

    const profile = getGuideProfile(guideId);
    const selectedVoiceId = resolveVoiceId(profile.id, voiceId);
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey || !selectedVoiceId) {
      return Response.json(
        {
          error:
            "ElevenLabs is not configured. Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID (or guide-specific voice IDs).",
        },
        { status: 400 },
      );
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json(
        { error: `ElevenLabs request failed: ${errorText.slice(0, 250)}` },
        { status: response.status },
      );
    }

    const audio = await response.arrayBuffer();
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "Could not generate guide audio." }, { status: 500 });
  }
}
