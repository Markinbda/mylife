"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { guideProfiles } from "@/lib/guides";

type ElevenVoice = {
  id: string;
  name: string;
  category?: string;
};

export default function GuideSelectionPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [selectedId, setSelectedId] = useState(guideProfiles[0].id);
  const [voices, setVoices] = useState<ElevenVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [voicesError, setVoicesError] = useState("");
  const [selectedVoiceId, setSelectedVoiceId] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("mylife:elevenlabs:voiceId") ?? "";
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selected = useMemo(
    () => guideProfiles.find((g) => g.id === selectedId) ?? guideProfiles[0],
    [selectedId],
  );

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.id === selectedVoiceId),
    [voices, selectedVoiceId],
  );

  useEffect(() => {
    localStorage.setItem("mylife:elevenlabs:voiceId", selectedVoiceId.trim());
  }, [selectedVoiceId]);

  useEffect(() => {
    let active = true;

    const init = async () => {
      if (!supabase) {
        setVoicesError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
        setVoicesLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setVoicesLoading(true);
      setVoicesError("");
      try {
        const response = await fetch("/api/elevenlabs/voices", { cache: "no-store" });
        const payload = (await response.json()) as {
          voices?: ElevenVoice[];
          error?: string;
        };

        if (!active) return;

        const fetchedVoices = payload.voices ?? [];
        setVoices(fetchedVoices);

        if (payload.error) {
          setVoicesError(payload.error);
        }

        if (fetchedVoices.length > 0 && !fetchedVoices.some((voice) => voice.id === selectedVoiceId)) {
          setSelectedVoiceId(fetchedVoices[0].id);
        }
      } catch {
        if (!active) return;
        setVoices([]);
        setVoicesError("Unable to load ElevenLabs voices.");
      } finally {
        if (active) setVoicesLoading(false);
      }
    };

    void init();

    return () => {
      active = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [router, selectedVoiceId, supabase]);

  const playGuidePreview = async () => {
    setAudioError("");
    setIsPlaying(true);
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const response = await fetch("/api/guide-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guideId: selected.id,
          text: selected.greeting,
          voiceId: selectedVoiceId.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Voice preview failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        setIsPlaying(false);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setIsPlaying(false);
        setAudioError("Could not play guide audio preview.");
      };

      await audio.play();
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : "Could not play voice preview.");
      setIsPlaying(false);
    }
  };

  const startWithGuide = () => {
    const params = new URLSearchParams({ lane: "story", guide: selected.id });
    if (selectedVoiceId.trim()) params.set("voice", selectedVoiceId.trim());
    if (selectedVoice?.name) params.set("voiceName", selectedVoice.name);
    router.push(`/studio?${params.toString()}`);
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#f6f3ee] px-5 py-8">
      <div className="w-full max-w-4xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 rounded-full border border-[#e5ddd2] bg-white px-3 py-1 text-sm text-[#7b6f60]"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7.5 9L4.5 6l3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
      </div>

      <div className="mt-6 flex w-full max-w-3xl flex-col items-center">
        <div className="relative h-48 w-48 rounded-full border-[6px] border-[#e4905d] p-1 shadow-[0_0_0_6px_#f4d8c2]">
          <Image src={selected.avatar} alt={selected.name} fill className="rounded-full object-cover" sizes="192px" />
        </div>

        <h1 className="mt-8 font-serif text-5xl font-bold text-[#1d140f]">Choose Who You Want To Talk To</h1>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          {guideProfiles.map((guide) => (
            <button
              key={guide.id}
              type="button"
              onClick={() => setSelectedId(guide.id)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                guide.id === selected.id
                  ? "border-[#c9793d] bg-[#f8e5d6] text-[#7b451f]"
                  : "border-[#ddd3c7] bg-white text-[#7d6f5d] hover:bg-[#f6efe7]"
              }`}
            >
              {guide.name}
            </button>
          ))}
        </div>

        <div className="mt-5 max-w-3xl text-center font-serif text-[1.35rem] leading-[1.45] text-[#2f231b]">
          <p>{selected.greeting}</p>
        </div>

        <div className="mt-6 w-full max-w-xl rounded-2xl border border-[#e5ddd1] bg-white p-4">
          <label htmlFor="voiceSelect" className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8d7558]">
            Select your ElevenLabs voice
          </label>
          <select
            id="voiceSelect"
            value={selectedVoiceId}
            onChange={(event) => setSelectedVoiceId(event.target.value)}
            disabled={voicesLoading || voices.length === 0}
            className="mt-2 w-full rounded-xl border border-[#dbcdbd] px-3 py-2 text-sm text-[#3f3022] outline-none ring-amber-300/70 focus:ring-2 disabled:bg-[#f4efe8]"
          >
            {voices.length === 0 ? (
              <option value="">No voices found</option>
            ) : (
              voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                  {voice.category ? ` (${voice.category})` : ""}
                </option>
              ))
            )}
          </select>
          {voicesLoading && <p className="mt-2 text-xs text-[#887763]">Loading voices from ElevenLabs...</p>}
          {voicesError && <p className="mt-2 text-xs text-[#a54136]">{voicesError}</p>}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => void playGuidePreview()}
            disabled={isPlaying || voicesLoading || voices.length === 0}
            className="rounded-full border border-[#c9783d] bg-white px-5 py-2.5 text-sm font-semibold text-[#84481f] transition-colors hover:bg-[#fff3e8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPlaying ? "Playing preview..." : "Preview selected voice"}
          </button>
          <button
            type="button"
            onClick={startWithGuide}
            className="rounded-full bg-[#c9783d] px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#b36d36]"
          >
            Continue with {selected.name}
          </button>
        </div>

        {audioError && <p className="mt-3 text-sm text-[#a54136]">{audioError}</p>}
      </div>
    </div>
  );
}

