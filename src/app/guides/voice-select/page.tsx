"use client";

import { Suspense } from "react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { guideProfiles } from "@/lib/guides";

type ElevenVoice = {
  id: string;
  name: string;
  category?: string;
};

type AgeGroup = "younger" | "mid_years" | "mature";

const AGE_GROUP_OPTIONS: { id: AgeGroup; label: string; keywords: string[] }[] = [
  {
    id: "younger",
    label: "Younger",
    keywords: ["young", "youth", "teen", "boy", "girl", "bright", "playful", "energetic"],
  },
  {
    id: "mid_years",
    label: "Mid Years",
    keywords: ["adult", "balanced", "natural", "casual", "professional", "warm", "confident"],
  },
  {
    id: "mature",
    label: "Mature",
    keywords: ["mature", "senior", "deep", "resonant", "authoritative", "wise", "reassuring", "calm"],
  },
];

interface VoiceCard {
  voice: ElevenVoice;
  image: string;
  gender: string;
}

const VOICE_NAME_IMAGE_MAP: Record<string, { image: string; gender: string }> = {
  charlie: { image: "/images/voice-charlie.png", gender: "Male (Teenage Boy)" },
  liam: { image: "/images/voice-liam.png", gender: "Male (Teenage Boy)" },
  jessica: { image: "/images/voice-jessica.png", gender: "Female" },
};
const FEMALE_HINTS = ["jessica", "female", "woman", "girl", "mom", "mother", "housewife"];
const MALE_HINTS = ["male", "man", "boy", "dad", "father"];

function getVoicePresentation(voice: ElevenVoice): { image: string; gender: string } {
  const normalizedName = voice.name.toLowerCase();
  const searchableText = `${voice.name} ${voice.category ?? ""}`.toLowerCase();

  const mappedByName = Object.entries(VOICE_NAME_IMAGE_MAP).find(([voiceName]) =>
    normalizedName === voiceName || normalizedName.startsWith(`${voiceName} `) || normalizedName.includes(`${voiceName} -`),
  )?.[1];
  if (mappedByName) {
    return mappedByName;
  }

  if (FEMALE_HINTS.some((hint) => searchableText.includes(hint))) {
    return {
      image: "/images/guide-coach.png",
      gender: "Female",
    };
  }

  if (MALE_HINTS.some((hint) => searchableText.includes(hint))) {
    return {
      image: "/images/guide-friend.png",
      gender: "Male",
    };
  }

  return {
    image: "/images/guide-coach.png",
    gender: "Voice Guide",
  };
}

function VoiceSelectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const ageParam = (searchParams.get("age") as AgeGroup) || "mid_years";

  const [selectedId, setSelectedId] = useState(guideProfiles[0].id);
  const [voices, setVoices] = useState<ElevenVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [voicesError, setVoicesError] = useState("");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(() => {
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

  const ageGroupLabel = useMemo(
    () => AGE_GROUP_OPTIONS.find((option) => option.id === ageParam)?.label || "Mid Years",
    [ageParam],
  );

  const filteredVoices = useMemo(() => {
    const selectedGroup = AGE_GROUP_OPTIONS.find((option) => option.id === ageParam);
    if (!selectedGroup) return voices.slice(0, 3);

    const scored = voices.map((voice) => {
      const text = `${voice.name} ${voice.category ?? ""}`.toLowerCase();
      const score = selectedGroup.keywords.reduce((count, keyword) => {
        return count + (text.includes(keyword) ? 1 : 0);
      }, 0);
      return { voice, score };
    });

    const matches = scored
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.voice);

    const fallback = voices.filter((voice) => !matches.some((matched) => matched.id === voice.id));
    return [...matches, ...fallback].slice(0, 3);
  }, [ageParam, voices]);

  const voiceCards = useMemo(
    (): VoiceCard[] =>
      filteredVoices.map((voice) => {
        const presentation = getVoicePresentation(voice);
        return {
          voice,
          image: presentation.image,
          gender: presentation.gender,
        };
      }),
    [filteredVoices],
  );

  useEffect(() => {
    localStorage.setItem("mylife:elevenlabs:voiceId", selectedVoiceId.trim());
  }, [selectedVoiceId]);

  // Derive the effective voice ID without triggering cascading setState in effects
  const effectiveVoiceId = useMemo(() => {
    if (filteredVoices.length === 0) return "";
    if (filteredVoices.some((voice) => voice.id === selectedVoiceId)) return selectedVoiceId;
    return filteredVoices[0].id;
  }, [filteredVoices, selectedVoiceId]);

  const selectedVoiceFromFiltered = useMemo(
    () => filteredVoices.find((voice) => voice.id === effectiveVoiceId),
    [filteredVoices, effectiveVoiceId],
  );

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

  const playVoicePreview = async (voiceId: string) => {
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
          voiceId: voiceId.trim() || undefined,
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
    if (effectiveVoiceId.trim()) params.set("voice", effectiveVoiceId.trim());
    if (selectedVoiceFromFiltered?.name) params.set("voiceName", selectedVoiceFromFiltered.name);
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

      <div className="mt-6 flex w-full max-w-4xl flex-col items-center">
        {/* Guide Avatar and Selection */}
        <div className="relative h-48 w-48 rounded-full border-[6px] border-[#e4905d] p-1 shadow-[0_0_0_6px_#f4d8c2]">
          <Image src={selected.avatar} alt={selected.name} fill className="rounded-full object-cover" sizes="192px" />
        </div>

        <h1 className="mt-8 font-serif text-5xl font-bold text-[#1d140f]">Choose Your Guide Voice</h1>
        <p className="mt-2 text-lg text-[#5b4d42]">{ageGroupLabel} voices that match your guide</p>

        {/* Guide Selection Buttons */}
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

        {/* Voice Cards Grid */}
        <div className="mt-10 w-full max-w-4xl">
          {voicesLoading && <p className="text-center text-[#887763]">Loading voices from ElevenLabs...</p>}
          {voicesError && <p className="text-center text-[#a54136]">{voicesError}</p>}

          {!voicesLoading && filteredVoices.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-3">
              {voiceCards.map((card) => (
                <div
                  key={card.voice.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedVoiceId(card.voice.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedVoiceId(card.voice.id);
                    }
                  }}
                  className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border-2 transition-all ${
                    card.voice.id === effectiveVoiceId
                      ? "border-[#c9793d] shadow-lg"
                      : "border-[#e5ddd1] shadow-md hover:shadow-lg hover:border-[#d4c4b5]"
                  }`}
                >
                  {/* Image Container */}
                  <div className="relative h-40 w-full overflow-hidden bg-gray-200">
                    <Image
                      src={card.image}
                      alt={card.voice.name}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>

                  {/* Content Container */}
                  <div className="flex flex-1 flex-col items-center justify-between bg-white px-4 py-6">
                    <div>
                      <h3 className="font-serif text-lg font-bold text-[#1d140f]">{card.voice.name}</h3>
                      <p className="mt-1 text-xs text-[#8d7558]">{card.gender}</p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void playVoicePreview(card.voice.id);
                      }}
                      disabled={isPlaying}
                      className="mt-4 rounded-full border border-[#c9783d] bg-white px-4 py-2 text-xs font-semibold text-[#84481f] transition-colors hover:bg-[#fff3e8] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPlaying ? "Playing..." : "Preview"}
                    </button>
                  </div>

                  {/* Selection Indicator */}
                  {card.voice.id === effectiveVoiceId && (
                    <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#c9793d]">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2">
                        <path d="M2 8l4 4 8-10" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!voicesLoading && filteredVoices.length === 0 && (
            <p className="text-center text-[#a54136]">No voices found for this age group.</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/guides/age-select")}
            className="rounded-full border border-[#c9793d] bg-white px-6 py-2.5 text-sm font-semibold text-[#84481f] transition-colors hover:bg-[#fff3e8]"
          >
            Back to age selection
          </button>
          <button
            type="button"
            onClick={startWithGuide}
            disabled={!selectedVoiceId}
            className="rounded-full bg-[#c9793d] px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#b36d36] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue with {selected.name}
          </button>
        </div>

        {audioError && <p className="mt-3 text-sm text-[#a54136]">{audioError}</p>}
      </div>
    </div>
  );
}

export default function VoiceSelectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f6f3ee]">
          <div className="text-center">
            <p className="text-[#5b4d42]">Loading voice selection...</p>
          </div>
        </div>
      }
    >
      <VoiceSelectContent />
    </Suspense>
  );
}
