"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    if (!supabase) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (typeof window !== "undefined") {
      const storedGuide = localStorage.getItem("mylife:guide:id");
      const storedVoice = localStorage.getItem("mylife:elevenlabs:voiceId");
      const storedVoiceName = localStorage.getItem("mylife:guide:voiceName");
      if (storedGuide) {
        const params = new URLSearchParams({ lane: "story", guide: storedGuide });
        if (storedVoice) params.set("voice", storedVoice);
        if (storedVoiceName) params.set("voiceName", storedVoiceName);
        router.push(`/studio?${params.toString()}`);
        return;
      }
    }
    router.push("/onboarding");
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-6 py-10">
      <div className="w-full rounded-[28px] border border-[#ddc4a1] bg-[rgba(255,249,238,0.95)] p-8 shadow-[0_20px_50px_rgba(96,63,24,0.15)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9d6d30]">MyLife.bm</p>
        <h1 className="mt-2 text-4xl text-[#2f2217]">Welcome back</h1>
        <p className="mt-2 text-sm text-[#6d553a]">Sign in to continue writing your life story with your guide.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-[#5c4630]">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-xl border border-[#d8bc95] bg-white px-4 py-3 text-sm text-[#2f2217] outline-none focus:ring-2 focus:ring-[#b87916]"
            />
          </label>
          <label className="block text-sm font-semibold text-[#5c4630]">
            Password
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-xl border border-[#d8bc95] bg-white px-4 py-3 text-sm text-[#2f2217] outline-none focus:ring-2 focus:ring-[#b87916]"
            />
          </label>

          {error && <p className="text-sm text-[#a54136]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-full bg-[#b87916] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#9f680f] disabled:opacity-65"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <p className="text-center text-sm text-[#6d553a]">
            New here?{" "}
            <Link href="/register" className="font-semibold text-[#8f5f1f] underline">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

