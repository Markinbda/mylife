"use client";

import Image from "next/image";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type AgeGroup = "younger" | "mid_years" | "mature";

interface AgeGroupCard {
  id: AgeGroup;
  label: string;
  description: string;
  image: string;
}

const AGE_GROUP_CARDS: AgeGroupCard[] = [
  {
    id: "younger",
    label: "Younger",
    description: "Bright, energetic, and youthful voices",
    image: "/images/guide-friend.png",
  },
  {
    id: "mid_years",
    label: "Mid Years",
    description: "Balanced, natural, and professional voices",
    image: "/images/sunset_over_ocean.png",
  },
  {
    id: "mature",
    label: "Mature",
    description: "Deep, wise, and reassuring voices",
    image: "/images/beach-ocean.jpg",
  },
];

export default function AgeSelectPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const checkAuth = async () => {
      if (!supabase) {
        router.push("/login");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
      }
    };

    void checkAuth();
  }, [router, supabase]);

  const handleAgeGroupSelect = (ageGroup: AgeGroup) => {
    router.push(`/guides/voice-select?age=${ageGroup}`);
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

      <div className="mt-12 flex w-full max-w-4xl flex-col items-center text-center">
        <h1 className="font-serif text-5xl font-bold text-[#1d140f]">Choose Your Guide Age</h1>
        <p className="mt-4 text-lg text-[#5b4d42]">Select the age group that resonates with you</p>

        <div className="mt-12 grid w-full gap-6 sm:grid-cols-1 md:grid-cols-3">
          {AGE_GROUP_CARDS.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => handleAgeGroupSelect(card.id)}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#e5ddd1] bg-white shadow-md transition-all hover:shadow-lg hover:border-[#c9793d]"
            >
              {/* Image Container */}
              <div className="relative h-48 w-full overflow-hidden bg-gray-200">
                <Image
                  src={card.image}
                  alt={card.label}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>

              {/* Content Container */}
              <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-8">
                <h2 className="font-serif text-2xl font-bold text-[#1d140f]">{card.label}</h2>
                <p className="mt-3 text-sm text-[#5b4d42]">{card.description}</p>
              </div>

              {/* Hover Indicator */}
              <div className="absolute inset-0 bg-[#c9793d]/10 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>

        <p className="mt-12 text-sm text-[#8d7558]">
          You can change your guide age at any time while recording your story
        </p>
      </div>
    </div>
  );
}
