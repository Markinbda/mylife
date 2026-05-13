"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { getGuideProfile } from "@/lib/guides";

type Chapter = {
  id: string;
  title: string;
  year: string;
  entries: string[];
  photos: string[];
};

type ChapterRow = {
  id: string;
  title: string;
  year_label: string;
  position: number;
};

type EntryRow = {
  chapter_id: string;
  content: string;
};

type PhotoRow = {
  chapter_id: string;
  url: string;
};

type ChatMessage = {
  role: "guide" | "user";
  content: string;
};

type ConversationRow = {
  role: "guide" | "user";
  content: string;
  created_at: string;
};

const defaultStoryTitles = [
  "The beginning",
  "Childhood",
  "Teenage Years",
  "My Parents",
  "Marriage",
  "My Work Career",
  "Children and Parenting",
  "Travel and Adventure",
];

const openingByGuide: Record<string, string> = {
  friend: "Let us keep this easy. Tell me a memory that still feels vivid today.",
  archivist: "Let us anchor your story in time. Which year or life season should we expand?",
  coach: "Small steps count. What is one chapter detail you can add in the next two minutes?",
};

const followUps = [
  "What was happening right before that moment?",
  "Who was with you, and what made that connection meaningful?",
  "How did that memory change what came next in your life?",
  "Would you like to place this on your timeline now?",
];

function buildSuggestedTopics(title: string) {
  if (title.toLowerCase().includes("begin")) {
    return [
      "Where and when were you born?",
      "What is one early memory your family often told?",
      "What did home feel like during your first years?",
    ];
  }
  if (title.toLowerCase().includes("child")) {
    return [
      "Tell me about where you grew up.",
      "Who shaped you most as a child?",
      "What childhood routine still lives with you?",
    ];
  }
  return [
    `What story from ${title.toLowerCase()} still feels vivid?`,
    "Who was central in this chapter of life?",
    "What changed for you during this season?",
  ];
}

export default function StudioWorkspace({
  lane = "story",
  guide = "friend",
  voice,
  voiceName,
}: {
  lane?: string;
  guide?: string;
  voice?: string;
  voiceName?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const profile = getGuideProfile(guide);

  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [dbError, setDbError] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [playingIntro, setPlayingIntro] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [chapterSearch, setChapterSearch] = useState("");
  const [pexelsQuery, setPexelsQuery] = useState("");
  const [pexelsResults, setPexelsResults] = useState<string[]>([]);
  const [searchingPexels, setSearchingPexels] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === selectedChapterId) ?? chapters[0],
    [chapters, selectedChapterId],
  );

  const filteredChapters = useMemo(() => {
    const term = chapterSearch.trim().toLowerCase();
    if (!term) return chapters;
    return chapters.filter((chapter) => chapter.title.toLowerCase().includes(term));
  }, [chapterSearch, chapters]);

  const suggestedTopics = useMemo(
    () => buildSuggestedTopics(selectedChapter?.title ?? "this chapter"),
    [selectedChapter?.title],
  );

  const firstName = useMemo(() => {
    const trimmed = displayName.trim();
    return trimmed ? trimmed.split(/\s+/)[0] : "";
  }, [displayName]);

  const openingMessage = useMemo(() => {
    const base = openingByGuide[guide] ?? openingByGuide.friend;
    return firstName ? `${firstName}, ${base}` : base;
  }, [firstName, guide]);

  const persistConversationMessage = useCallback(
    async (chapterId: string, message: ChatMessage) => {
      if (!supabase || !userId || !chapterId) return;

      await supabase.from("chapter_conversations").insert({
        user_id: userId,
        chapter_id: chapterId,
        guide_id: guide,
        role: message.role,
        content: message.content,
      });
    },
    [guide, supabase, userId],
  );

  const hydrateChapters = useCallback(async (uid: string, laneValue: string) => {
    if (!supabase) {
      setDbError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    const client = supabase;

    const { data: chapterRows, error: chapterError } = await client
      .from("chapters")
      .select("id, title, year_label, position")
      .eq("user_id", uid)
      .eq("lane", laneValue)
      .order("position", { ascending: true });

    if (chapterError) {
      setDbError(chapterError.message);
      return;
    }

    let rows = (chapterRows ?? []) as ChapterRow[];

    if (rows.length === 0 && laneValue === "story") {
      const seedPayload = defaultStoryTitles.map((title, index) => ({
        user_id: uid,
        lane: laneValue,
        title,
        year_label: "",
        position: index,
      }));

      const { error: seedError } = await client.from("chapters").insert(seedPayload);
      if (seedError) {
        setDbError(seedError.message);
        return;
      }

      const { data: seededRows, error: seededFetchError } = await client
        .from("chapters")
        .select("id, title, year_label, position")
        .eq("user_id", uid)
        .eq("lane", laneValue)
        .order("position", { ascending: true });

      if (seededFetchError) {
        setDbError(seededFetchError.message);
        return;
      }

      rows = (seededRows ?? []) as ChapterRow[];
    }

    const chapterIds = rows.map((row) => row.id);

    const { data: entryRows } = chapterIds.length
      ? await client
          .from("chapter_entries")
          .select("chapter_id, content")
          .in("chapter_id", chapterIds)
      : { data: [] as EntryRow[] };

    const { data: photoRows } = chapterIds.length
      ? await client
          .from("chapter_photos")
          .select("chapter_id, url")
          .in("chapter_id", chapterIds)
      : { data: [] as PhotoRow[] };

    const entryMap = new Map<string, string[]>();
    (entryRows ?? []).forEach((entry) => {
      const prev = entryMap.get(entry.chapter_id) ?? [];
      prev.push(entry.content);
      entryMap.set(entry.chapter_id, prev);
    });

    const photoMap = new Map<string, string[]>();
    (photoRows ?? []).forEach((photo) => {
      const prev = photoMap.get(photo.chapter_id) ?? [];
      prev.push(photo.url);
      photoMap.set(photo.chapter_id, prev);
    });

    const hydrated = rows.map((row) => ({
      id: row.id,
      title: row.title,
      year: row.year_label,
      entries: entryMap.get(row.id) ?? [],
      photos: photoMap.get(row.id) ?? [],
    }));

    setChapters(hydrated);
    if (hydrated.length > 0) {
      setSelectedChapterId((prev) => prev || hydrated[0].id);
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;

    const init = async () => {
      setLoadingData(true);
      setDbError("");

      if (!supabase) {
        setDbError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
        setLoadingData(false);
        return;
      }

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !user) {
        router.push("/login");
        return;
      }

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (active) {
        setDisplayName(profileRow?.full_name?.trim() ?? "");
      }

      setUserId(user.id);
      await hydrateChapters(user.id, lane);

      if (active) {
        setLoadingData(false);
      }
    };

    void init();

    return () => {
      active = false;
    };
  }, [hydrateChapters, lane, router, supabase]);

  useEffect(() => {
    let active = true;

    const loadConversationHistory = async () => {
      if (!supabase || !userId || !selectedChapterId) {
        if (active) {
          setChatMessages([{ role: "guide", content: openingMessage }]);
        }
        return;
      }

      const { data, error } = await supabase
        .from("chapter_conversations")
        .select("role, content, created_at")
        .eq("user_id", userId)
        .eq("chapter_id", selectedChapterId)
        .order("created_at", { ascending: true });

      if (!active) return;

      if (error) {
        setChatMessages([{ role: "guide", content: openingMessage }]);
        return;
      }

      const history = ((data ?? []) as ConversationRow[]).map((message) => ({
        role: message.role,
        content: message.content,
      }));

      if (history.length > 0) {
        setChatMessages(history);
        return;
      }

      const initialMessage = { role: "guide", content: openingMessage } as const;
      setChatMessages([initialMessage]);
      await persistConversationMessage(selectedChapterId, initialMessage);
    };

    void loadConversationHistory();

    return () => {
      active = false;
    };
  }, [openingMessage, persistConversationMessage, selectedChapterId, supabase, userId]);

  const appendEntryToChapter = async (entry: string) => {
    const trimmed = entry.trim();
    if (!supabase || !trimmed || !userId || !selectedChapterId) return;

    const { error } = await supabase.from("chapter_entries").insert({
      user_id: userId,
      chapter_id: selectedChapterId,
      content: trimmed,
    });

    if (error) {
      setDbError(error.message);
      return;
    }

    setChapters((prev) =>
      prev.map((chapter) =>
        chapter.id === selectedChapterId
          ? { ...chapter, entries: [...chapter.entries, trimmed] }
          : chapter,
      ),
    );
  };

  const sendToGuide = async () => {
    const text = chatInput.trim();
    if (!text || !selectedChapterId) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    setChatMessages((prev) => [...prev, userMessage]);
    await persistConversationMessage(selectedChapterId, userMessage);
    await appendEntryToChapter(text);

    const nextFollowUp = followUps[Math.floor(Math.random() * followUps.length)];
    const guideMessage: ChatMessage = {
      role: "guide",
      content: `${firstName ? `${firstName}, ` : ""}${nextFollowUp} I can suggest another prompt when you are ready.`,
    };
    setChatMessages((prev) => [
      ...prev,
      guideMessage,
    ]);
    await persistConversationMessage(selectedChapterId, guideMessage);
    setChatInput("");
  };

  const createNewChapter = async () => {
    if (!supabase || !userId) return;

    const payload = {
      user_id: userId,
      lane,
      title: `New Chapter ${chapters.length + 1}`,
      year_label: "",
      position: chapters.length,
    };

    const { data, error } = await supabase
      .from("chapters")
      .insert(payload)
      .select("id, title, year_label")
      .single();

    if (error || !data) {
      setDbError(error?.message ?? "Could not create chapter.");
      return;
    }

    const chapter: Chapter = {
      id: data.id,
      title: data.title,
      year: data.year_label,
      entries: [],
      photos: [],
    };

    setChapters((prev) => [...prev, chapter]);
    setSelectedChapterId(chapter.id);
  };

  const playGuideIntro = async () => {
    setVoiceError("");
    setPlayingIntro(true);
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const chapterTitle = selectedChapter?.title ?? "this chapter";
      const res = await fetch("/api/guide-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guideId: profile.id,
          text: `Here are some story ideas for ${chapterTitle}. ${suggestedTopics.join(" ")}`,
          voiceId: voice?.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Could not play guide intro.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPlayingIntro(false);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setPlayingIntro(false);
        setVoiceError("Could not play guide intro.");
      };

      await audio.play();
      const guideMessage: ChatMessage = {
        role: "guide",
        content: `${firstName ? `${firstName}, ` : ""}here are some ideas for ${chapterTitle}: ${suggestedTopics.join(" ")}`,
      };
      setChatMessages((prev) => [
        ...prev,
        guideMessage,
      ]);
      if (selectedChapterId) {
        await persistConversationMessage(selectedChapterId, guideMessage);
      }
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : "Could not play guide intro.");
      setPlayingIntro(false);
    }
  };

  const handleUploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!supabase || !files || files.length === 0 || !userId || !selectedChapterId) return;

    const uploadedUrls: string[] = [];

    for (const file of Array.from(files)) {
      const path = `${userId}/${selectedChapterId}/${Date.now()}-${file.name.replaceAll(" ", "-")}`;
      const upload = await supabase.storage.from("chapter-photos").upload(path, file, { upsert: false });

      if (upload.error) {
        setDbError(upload.error.message);
        continue;
      }

      const { data } = supabase.storage.from("chapter-photos").getPublicUrl(path);
      uploadedUrls.push(data.publicUrl);

      const { error } = await supabase.from("chapter_photos").insert({
        user_id: userId,
        chapter_id: selectedChapterId,
        url: data.publicUrl,
      });

      if (error) {
        setDbError(error.message);
      }
    }

    if (uploadedUrls.length > 0) {
      setChapters((prev) =>
        prev.map((chapter) =>
          chapter.id === selectedChapterId
            ? { ...chapter, photos: [...chapter.photos, ...uploadedUrls] }
            : chapter,
        ),
      );
    }

    event.target.value = "";
  };

  const searchPexels = async () => {
    const term = pexelsQuery.trim();
    if (!term) return;

    const key = process.env.NEXT_PUBLIC_PEXELS_API_KEY;
    if (!key) {
      setPexelsResults([]);
      return;
    }

    setSearchingPexels(true);
    try {
      const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(term)}&per_page=6`, {
        headers: { Authorization: key },
      });
      const data = await res.json();
      const urls: string[] = Array.isArray(data?.photos)
        ? data.photos
            .map((photo: { src?: { medium?: string } }) => photo?.src?.medium)
            .filter((url: string | undefined): url is string => Boolean(url))
        : [];
      setPexelsResults(urls);
    } catch {
      setPexelsResults([]);
    } finally {
      setSearchingPexels(false);
    }
  };

  const attachPexelsImage = async (url: string) => {
    if (!supabase || !userId || !selectedChapterId) return;

    const { error } = await supabase.from("chapter_photos").insert({
      user_id: userId,
      chapter_id: selectedChapterId,
      url,
    });

    if (error) {
      setDbError(error.message);
      return;
    }

    setChapters((prev) =>
      prev.map((chapter) =>
        chapter.id === selectedChapterId
          ? { ...chapter, photos: [...chapter.photos, url] }
          : chapter,
      ),
    );
  };

  const signOut = async () => {
    if (!supabase) {
      router.push("/login");
      return;
    }

    await supabase.auth.signOut();
    router.push("/login");
  };

  const laneTitle = lane === "messages" ? "Personal Messages" : "Stories";

  if (loadingData) {
    return <main className="p-8 text-sm text-[#6d5f4e]">Loading your story vault...</main>;
  }

  return (
    <main className="min-h-screen bg-[#f7f5f1]">
      <header className="border-b border-[#ece5dc] bg-white/70 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <p className="font-semibold text-[#74a8a4]">MyLife</p>
            <p className="font-semibold text-[#ea8f61]">{laneTitle}</p>
            <p className="text-[#8a8377]">Photos</p>
            <p className="text-[#8a8377]">Book</p>
            <p className="text-[#8a8377]">Progress</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#857a6a]">
            <span>Guide: {profile.name}</span>
            {voice?.trim() && (
              <span className="rounded-full bg-[#f2ebe2] px-2 py-1">
                Voice: {voiceName?.trim() || "Custom ElevenLabs"}
              </span>
            )}
            <button
              type="button"
              onClick={signOut}
              className="rounded-full border border-[#d7c9b8] bg-white px-3 py-1.5 font-semibold text-[#7f6645]"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1400px] gap-0 lg:grid-cols-[320px_1fr]">
        <aside className="border-r border-[#ebe3d8] bg-[#f8f6f2] px-4 py-4">
          <input
            type="text"
            value={chapterSearch}
            onChange={(event) => setChapterSearch(event.target.value)}
            placeholder="Search stories..."
            className="w-full rounded-xl border border-[#e5ddd2] bg-white px-3 py-2 text-sm text-[#6c6255] outline-none focus:ring-2 focus:ring-[#84b4b0]"
          />

          <div className="mt-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#5d564c]">All Chapters</h2>
            <button
              type="button"
              onClick={() => void createNewChapter()}
              className="rounded-full border border-[#86bdb6] bg-[#f0fbf9] px-3 py-1.5 text-xs font-semibold text-[#4f958c]"
            >
              + New Chapter
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {filteredChapters.map((chapter, index) => {
              const active = chapter.id === selectedChapterId;
              return (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => setSelectedChapterId(chapter.id)}
                  className={`w-full rounded-2xl border bg-white px-3 py-3 text-left transition-colors ${
                    active ? "border-[#84b4b0] shadow-[inset_3px_0_0_0_#84b4b0]" : "border-[#ebe3d7] hover:bg-[#fbfaf8]"
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#84b4b0]">Chapter {index + 1}</p>
                  <p className="mt-1 text-3xl font-serif leading-tight text-[#251d16]">{chapter.title}</p>
                  <p className="mt-2 text-xs text-[#93887a]">{chapter.entries.length === 0 ? "No stories yet" : `${chapter.entries.length} stories`}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="px-6 py-8 md:px-12">
          <div className="mx-auto max-w-3xl">
            <p className="text-center text-xl text-[#7f7668]">Chapter {Math.max(chapters.findIndex((c) => c.id === selectedChapter?.id) + 1, 1)}</p>
            <h1 className="mt-2 text-center font-serif text-6xl text-[#1f1711]">{selectedChapter?.title ?? "Your chapter"}</h1>
            <p className="mt-2 text-center text-xl text-[#7f7668]">Suggested Topics</p>

            <div className="mt-8 rounded-[28px] border border-[#dfe9e6] bg-[#edf6f4] px-8 py-7 text-center shadow-[0_12px_26px_rgba(0,0,0,0.06)]">
              <div className="mx-auto mb-4 flex w-fit items-center gap-3">
                <div className="relative h-10 w-10 overflow-hidden rounded-full border border-white shadow">
                  <Image src={profile.avatar} alt={profile.name} fill className="object-cover" sizes="40px" />
                </div>
                <h3 className="text-4xl font-semibold text-[#1e1813]">Not sure where to start?</h3>
              </div>
              <p className="mx-auto max-w-2xl text-2xl italic leading-relaxed text-[#6d675d]">
                {profile.name} can suggest a few places from this chapter where your stories might live.
              </p>
              <button
                type="button"
                onClick={() => void playGuideIntro()}
                disabled={playingIntro}
                className="mt-6 rounded-full bg-[linear-gradient(90deg,#aa6bd3,#f08f51)] px-8 py-3 text-2xl font-semibold text-white shadow-[0_8px_20px_rgba(210,116,74,0.35)] disabled:opacity-60"
              >
                {playingIntro ? "Playing..." : `Get ideas from ${profile.name}`}
              </button>
              {voiceError && <p className="mt-3 text-sm text-[#a54136]">{voiceError}</p>}
            </div>

            <div className="my-6 flex items-center gap-4 text-[#9f9486]">
              <div className="h-px flex-1 bg-[#e8dfd4]" />
              <span>or</span>
              <div className="h-px flex-1 bg-[#e8dfd4]" />
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsComposerOpen(true);
                  setTimeout(() => textInputRef.current?.focus(), 0);
                }}
                className="rounded-full border border-[#ef9d65] px-6 py-3 text-xl font-semibold text-[#de7d3e]"
              >
                I have a story to tell
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full border border-[#79b6ad] px-6 py-3 text-xl font-semibold text-[#4e9a90]"
              >
                I have a photo to share
              </button>
              <label className="sr-only" htmlFor="studio-photo-input">Upload chapter photo</label>
              <input
                id="studio-photo-input"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  void handleUploadPhoto(event);
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => setIsComposerOpen((prev) => !prev)}
              className="mx-auto mt-4 block text-xl text-[#7e7468] underline underline-offset-2"
            >
              Write it myself
            </button>

            {isComposerOpen && (
              <div className="mt-6 space-y-3 rounded-3xl border border-[#e6ddcf] bg-white p-4">
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-[#e9e0d3] bg-[#fbfaf7] p-3">
                  {chatMessages.map((message, index) => (
                    <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      <p className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${message.role === "user" ? "bg-[#f2d9a7] text-[#442c0e]" : "border border-[#eadfce] bg-white text-[#3f3328]"}`}>
                        {message.content}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <textarea
                    ref={textInputRef}
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    rows={3}
                    placeholder="Write your story here..."
                    className="flex-1 resize-none rounded-2xl border border-[#ddcfbd] bg-white px-3 py-2 text-sm text-[#4b371d] outline-none focus:ring-2 focus:ring-[#c68c3c]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void sendToGuide();
                    }}
                    className="rounded-2xl bg-[#b87916] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9f680f]"
                  >
                    Save Story
                  </button>
                </div>
              </div>
            )}

            {(selectedChapter?.photos?.length ?? 0) > 0 && (
              <div className="mt-6 rounded-3xl border border-[#e6ddcf] bg-white p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#8e7f6f]">Photos</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedChapter.photos.map((photo, index) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={`${photo}-${index}`} src={photo} alt="Chapter visual" className="h-24 w-24 rounded-xl border border-[#dcc6a4] object-cover" />
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={pexelsQuery}
                    onChange={(event) => setPexelsQuery(event.target.value)}
                    placeholder="Search Pexels"
                    className="min-w-56 flex-1 rounded-full border border-[#d8c19d] bg-white px-3 py-2 text-xs text-[#4d391f] outline-none focus:ring-2 focus:ring-[#c68c3c]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void searchPexels();
                    }}
                    disabled={searchingPexels}
                    className="rounded-full bg-[#c2872e] px-3 py-2 text-xs font-semibold text-white disabled:opacity-70"
                  >
                    {searchingPexels ? "Searching..." : "Find Photos"}
                  </button>
                </div>

                {pexelsResults.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {pexelsResults.map((url) => (
                      <button key={url} type="button" onClick={() => void attachPexelsImage(url)} className="group relative overflow-hidden rounded-xl border border-[#dcc6a4]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="Pexels result" className="h-20 w-full object-cover transition-transform group-hover:scale-105" />
                        <span className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 text-[10px] text-white">Add</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {dbError && <p className="mt-6 text-sm text-[#a54136]">{dbError}</p>}
          </div>
        </section>
      </div>
    </main>
  );
}




