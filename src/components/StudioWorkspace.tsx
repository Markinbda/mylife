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

type MicDevice = {
  deviceId: string;
  label: string;
};

type SpeechRecognitionResultLike = {
  0?: { transcript?: string };
  isFinal: boolean;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

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
  teenager: "Let us keep this easy. Tell me a memory that still feels vivid today.",
  housewife: "Let us anchor your story in time. Which year or life season should we expand?",
  older_man: "Small steps count. What is one chapter detail you can add in the next two minutes?",
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
  const [isGuideThinking, setIsGuideThinking] = useState(false);
  const [playingIntro, setPlayingIntro] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isMicPickerOpen, setIsMicPickerOpen] = useState(false);
  const [chapterSearch, setChapterSearch] = useState("");
  const [showSuggestedChapterPicker, setShowSuggestedChapterPicker] = useState(false);
  const [selectedSuggestedTitles, setSelectedSuggestedTitles] = useState<string[]>(defaultStoryTitles.slice(0, 4));
  const [creatingSuggestedChapters, setCreatingSuggestedChapters] = useState(false);
  const [pexelsQuery, setPexelsQuery] = useState("");
  const [pexelsResults, setPexelsResults] = useState<string[]>([]);
  const [searchingPexels, setSearchingPexels] = useState(false);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);
  const [showConversationHistory, setShowConversationHistory] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingError, setRecordingError] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [recordingStatus, setRecordingStatus] = useState("Idle");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micDevices, setMicDevices] = useState<MicDevice[]>([]);
  const [transcriptionConfigured, setTranscriptionConfigured] = useState<boolean | null>(null);
  const [selectedMicId, setSelectedMicId] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("mylife:selectedMicId") ?? "";
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");
  const liveTranscriptRef = useRef("");
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

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
    const base = openingByGuide[guide] ?? openingByGuide.teenager;
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

    const rows = (chapterRows ?? []) as ChapterRow[];

    if (rows.length === 0 && laneValue === "story") {
      setShowSuggestedChapterPicker(true);
      setChapters([]);
      setSelectedChapterId("");
      return;
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
    setShowSuggestedChapterPicker(false);
  }, [supabase]);

  const toggleSuggestedChapter = (title: string) => {
    setSelectedSuggestedTitles((prev) =>
      prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title],
    );
  };

  const createSelectedSuggestedChapters = async () => {
    if (!supabase || !userId || selectedSuggestedTitles.length === 0) {
      setDbError("Select at least one chapter to continue.");
      return;
    }

    setCreatingSuggestedChapters(true);
    setDbError("");

    const payload = selectedSuggestedTitles.map((title, index) => ({
      user_id: userId,
      lane,
      title,
      year_label: "",
      position: index,
    }));

    const { error } = await supabase.from("chapters").insert(payload);
    if (error) {
      setDbError(error.message);
      setCreatingSuggestedChapters(false);
      return;
    }

    await hydrateChapters(userId, lane);
    setCreatingSuggestedChapters(false);
  };

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

  const playGuideVoice = useCallback(
    async (text: string) => {
      const script = text.trim();
      if (!script) return;

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const response = await fetch("/api/guide-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guideId: profile.id,
          text: script,
          voiceId: voice?.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Could not play guide voice.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
      };

      await audio.play();
    },
    [profile.id, voice],
  );

  const sendToGuide = async (incomingText?: string) => {
    const text = (incomingText ?? chatInput).trim();
    if (!text || !selectedChapterId) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    setChatInput("");
    await persistConversationMessage(selectedChapterId, userMessage);
    await appendEntryToChapter(text);

    setIsGuideThinking(true);
    let replyText: string;
    try {
      const res = await fetch("/api/guide-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guideId: profile.id,
          chapterTitle: selectedChapter?.title ?? "",
          firstName,
          messages: updatedMessages,
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      replyText = data.reply ?? followUps[Math.floor(Math.random() * followUps.length)];
    } catch {
      replyText = followUps[Math.floor(Math.random() * followUps.length)];
    } finally {
      setIsGuideThinking(false);
    }

    const guideMessage: ChatMessage = { role: "guide", content: replyText };
    setChatMessages((prev) => [...prev, guideMessage]);
    await persistConversationMessage(selectedChapterId, guideMessage);
    try {
      setVoiceError("");
      await playGuideVoice(guideMessage.content);
    } catch (error) {
      const fallback =
        "Voice reply could not play. Click in the page once and try again, then check ElevenLabs settings.";
      setVoiceError(error instanceof Error ? error.message || fallback : fallback);
    }
  };

  const loadMicDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setRecordingError("Microphone selection is not supported in this browser.");
      setMicDevices([]);
      setSelectedMicId("");
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${index + 1}`,
      }));

    setMicDevices(inputs);
    if (!inputs.some((device) => device.deviceId === selectedMicId)) {
      setSelectedMicId("");
    }
  };

  const selectedMicValue = useMemo(
    () => (micDevices.some((device) => device.deviceId === selectedMicId) ? selectedMicId : ""),
    [micDevices, selectedMicId],
  );

  useEffect(() => {
    localStorage.setItem("mylife:selectedMicId", selectedMicId);
  }, [selectedMicId]);

  useEffect(() => {
    let active = true;

    const checkTranscribeConfig = async () => {
      try {
        const response = await fetch("/api/transcribe", {
          method: "GET",
          cache: "no-store",
        });

        if (!active) return;

        if (!response.ok) {
          setTranscriptionConfigured(false);
          return;
        }

        const payload = (await response.json()) as { configured?: boolean };
        setTranscriptionConfigured(Boolean(payload.configured));
      } catch {
        if (active) setTranscriptionConfigured(false);
      }
    };

    void checkTranscribeConfig();

    return () => {
      active = false;
    };
  }, []);

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
      const chapterTitle = selectedChapter?.title ?? "this chapter";
      await playGuideVoice(`Here are some story ideas for ${chapterTitle}. ${suggestedTopics.join(" ")}`);
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
    } finally {
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

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const transcribeAudioBlob = useCallback(async (blob: Blob) => {
    const mime = (blob.type || "audio/webm").toLowerCase();
    const ext = mime.includes("mp4") || mime.includes("m4a") ? "m4a" : "webm";
    const file = new File([blob], `story-voice.${ext}`, { type: mime });
    const form = new FormData();
    form.append("audio", file);
    form.append("prompt", "Transcribe exactly what is spoken. Do not add words.");

    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: form,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((data as { error?: string }).error ?? "Transcription failed.");
    }

    return ((data as { text?: string }).text ?? "").toString().trim();
  }, []);

  const cleanupRecording = (clearTranscript = true) => {
    stopTimer();
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onerror = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      recognitionRef.current = null;
    }
    if (clearTranscript) {
      finalTranscriptRef.current = "";
      liveTranscriptRef.current = "";
      setLiveTranscript("");
    }
  };

  useEffect(() => {
    return () => {
      cleanupRecording();
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const toggleRecording = async () => {
    if (isRecording) {
      setRecordingStatus("Stopping...");
      setIsRecording(false);
      stopTimer();
      recognitionRef.current?.stop();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    } else {
      try {
        setRecordingError("");
        finalTranscriptRef.current = "";
        setLiveTranscript("");
        setRecordingStatus("Requesting microphone...");
        recordedChunksRef.current = [];

        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach((track) => track.stop());
          micStreamRef.current = null;
        }

        micStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: selectedMicId
            ? {
                deviceId: { exact: selectedMicId },
                echoCancellation: true,
                noiseSuppression: true,
              }
            : {
                echoCancellation: true,
                noiseSuppression: true,
              },
        });

        await loadMicDevices();

        const stream = micStreamRef.current;
        if (!stream) {
          throw new Error("Could not initialize selected microphone.");
        }

        const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
        const selectedMime = mimeCandidates.find((mime) => MediaRecorder.isTypeSupported?.(mime));
        const recorder = selectedMime
          ? new MediaRecorder(stream, { mimeType: selectedMime })
          : new MediaRecorder(stream);

        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        recorder.onerror = (event: Event) => {
          const recorderEvent = event as Event & { error?: { message?: string } };
          setRecordingError(recorderEvent.error?.message || "Recorder error.");
          setRecordingStatus("Error");
        };

        recorder.onstop = async () => {
          const chunks = [...recordedChunksRef.current];
          recordedChunksRef.current = [];
          recognitionRef.current?.stop();
          cleanupRecording(false);

          if (chunks.length === 0) {
            setRecordingStatus("No speech detected.");
            setRecordingError("No speech was captured. Try again and speak a little louder.");
            return;
          }

          const blob = new Blob(chunks, { type: selectedMime || "audio/webm" });
          if (blob.size === 0) {
            setRecordingStatus("No speech detected.");
            setRecordingError("No speech was captured. Try again and speak a little louder.");
            return;
          }

          setIsTranscribing(true);
          setRecordingStatus("Transcribing...");
          try {
            const transcript = await transcribeAudioBlob(blob);
            if (!transcript) {
              setRecordingStatus("No speech detected.");
              setRecordingError("No speech was captured. Try again and speak a little louder.");
              return;
            }

            liveTranscriptRef.current = transcript;
            setLiveTranscript(transcript);
            setRecordingStatus("Transcript captured.");
            await sendToGuide(transcript);
            window.setTimeout(() => {
              setLiveTranscript("");
              liveTranscriptRef.current = "";
              setRecordingStatus("Idle");
            }, 2500);
          } catch (err: unknown) {
            const previewTranscript = (finalTranscriptRef.current || liveTranscriptRef.current).trim();
            if (previewTranscript) {
              setRecordingStatus("Using live transcript fallback.");
              setLiveTranscript(previewTranscript);
              await sendToGuide(previewTranscript);
            } else {
              setRecordingStatus("Error");
              setRecordingError(err instanceof Error ? err.message : "Transcription failed.");
            }
          } finally {
            setIsTranscribing(false);
          }
        };

        recorder.start();

        const speechWindow = window as Window & {
          SpeechRecognition?: SpeechRecognitionConstructor;
          webkitSpeechRecognition?: SpeechRecognitionConstructor;
        };
        const SR = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
        if (SR) {
          const recognition = new SR();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "en-US";

          recognition.onresult = (event: SpeechRecognitionEventLike) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
              const transcript = event.results[i][0]?.transcript ?? "";
              if (event.results[i].isFinal) {
                finalTranscriptRef.current = `${finalTranscriptRef.current} ${transcript}`.trim();
              } else {
                interim += transcript;
              }
            }
            const current = [finalTranscriptRef.current, interim.trim()].filter(Boolean).join(" ").trim();
            if (current) {
              liveTranscriptRef.current = current;
              setLiveTranscript(current);
            }
          };

          recognition.onerror = () => {
            // Keep recorder running even if live preview fails.
          };

          recognitionRef.current = recognition;
          try {
            recognition.start();
          } catch {
            // Ignore if browser blocks live preview start.
          }
        }

        setRecordingStatus("Listening...");
        setIsRecording(true);
        setRecordingTime(0);

        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      } catch (err: unknown) {
        setRecordingError(
          err instanceof Error
            ? err.message
            : "Failed to start microphone transcription. Please check permissions.",
        );
        setRecordingStatus("Error");
        cleanupRecording();
      }
    }
  };

  const laneTitle = lane === "messages" ? "Personal Messages" : "Stories";

  if (loadingData) {
    return <main className="p-8 text-sm text-[#6d5f4e]">Loading your story vault...</main>;
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#f7f5f1]">
      <header className="border-b border-[#ece5dc] bg-white/70 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-full items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <p className="font-semibold text-[#74a8a4]">MyLife Studio</p>
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

      <div className="mx-auto grid w-full max-w-full flex-1 min-h-0 gap-0 lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-[#ebe3d8] bg-[#f8f6f2] px-4 py-4 lg:block">
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
              + New
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
                  <p className="mt-1 line-clamp-2 text-lg font-serif text-[#251d16]">{chapter.title}</p>
                  <p className="mt-1 text-xs text-[#93887a]">{chapter.entries.length === 0 ? "No stories" : `${chapter.entries.length} stories`}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-h-0 flex-1 flex-col">
          {/* Header with guide info and conversation history */}
          <div className="border-b border-[#ece5dc] bg-white/70 px-6 py-4 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 overflow-hidden rounded-full border border-[#dcc6a4]">
                  <Image src={profile.avatar} alt={profile.name} fill className="object-cover" sizes="48px" />
                </div>
                <div>
                  <h2 className="font-semibold text-[#1f1711]">{selectedChapter?.title ?? "Your chapter"}</h2>
                  <p className="text-xs text-[#8e7f6f]">{profile.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConversationHistory(true)}
                className="rounded-full border border-[#d8c19d] bg-white px-4 py-2 text-sm font-semibold text-[#7f6645] hover:bg-[#fbfaf8]"
              >
                Conversation History
              </button>
            </div>
          </div>

          {/* Main layout: Conversation + Right photo sidebar */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Left: Conversation area */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-3 pt-6">
              <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col items-center justify-center gap-10 py-8">
                {chatMessages.length === 0 ? (
                  <div className="space-y-6 text-center">
                    <p className="font-serif text-5xl leading-tight text-[#1f1711]">
                      {selectedChapter?.title ?? "Your chapter"}
                    </p>
                    <p className="text-2xl leading-relaxed text-[#6d675d]">
                      {openingMessage}
                    </p>
                  </div>
                ) : (
                  <div className="w-full space-y-8 text-center">
                    {/* Last user message */}
                    {chatMessages.findLast((m) => m.role === "user") && (
                      <p className="font-serif text-3xl italic leading-relaxed text-[#6c6255]">
                        {chatMessages.findLast((m) => m.role === "user")!.content}
                      </p>
                    )}
                    {/* Last guide message or thinking indicator */}
                    {(isGuideThinking || chatMessages.findLast((m) => m.role === "guide")) && (
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative h-10 w-10 overflow-hidden rounded-full border border-[#dcc6a4]">
                          <Image src={profile.avatar} alt={profile.name} fill className="object-cover" sizes="40px" />
                        </div>
                        {isGuideThinking ? (
                          <p className="text-2xl text-[#b5a898] animate-pulse">&#8230;</p>
                        ) : (
                          <p className="text-3xl leading-relaxed text-[#3f3328]">
                            {chatMessages.findLast((m) => m.role === "guide")!.content}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons and response area */}
              <div className="sticky bottom-0 mt-4 space-y-4 border-t border-[#e8dfd4] bg-[#f7f5f1] pt-4 pb-10">
                {/* Action buttons - compact flat row */}
                <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2 text-sm text-[#6c6255]">
                  <span className="font-semibold">Add a story through</span>
                  <button
                    type="button"
                    onClick={() => setIsComposerOpen((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors ${
                      isComposerOpen
                        ? "border-[#b89a75] bg-[#f6ede0] text-[#3f3328]"
                        : "border-[#dcc6a4] bg-white hover:bg-[#faf6ef]"
                    }`}
                  >
                    <span>⌨️</span>
                    <span className="font-semibold">Keyboard</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#dcc6a4] bg-white px-3 py-1 hover:bg-[#faf6ef]"
                  >
                    <span>📸</span>
                    <span className="font-semibold">Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMicPickerOpen((prev) => !prev);
                      if (!isMicPickerOpen) void loadMicDevices();
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors ${
                      isMicPickerOpen
                        ? "border-[#b89a75] bg-[#f6ede0] text-[#3f3328]"
                        : "border-[#dcc6a4] bg-white hover:bg-[#faf6ef]"
                    }`}
                    title="Choose microphone"
                  >
                    <span>🎤</span>
                    <span className="font-semibold">Mic</span>
                  </button>
                </div>

                {isComposerOpen && (
                  <div className="mx-auto flex max-w-2xl flex-col gap-2">
                    <textarea
                      ref={textInputRef}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendToGuide();
                        }
                      }}
                      placeholder="Type your response…"
                      rows={3}
                      className="w-full resize-none rounded-xl border border-[#e4dacd] bg-white px-4 py-3 text-sm text-[#3f3328] placeholder-[#b5a898] focus:border-[#b89a75] focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsComposerOpen(false)}
                        className="rounded-full border border-[#e4dacd] bg-white px-4 py-1.5 text-xs font-semibold text-[#8e7f6f] hover:bg-[#f6f1e9]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => { void sendToGuide(); setIsComposerOpen(false); }}
                        disabled={!chatInput.trim()}
                        className="rounded-full bg-[#74a8a4] px-5 py-1.5 text-xs font-semibold text-white hover:bg-[#5f8f8a] disabled:opacity-40"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}

                {isMicPickerOpen && (
                  <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-xl border border-[#e4dacd] bg-white px-3 py-2 text-xs text-[#6a5f52]">
                    <label htmlFor="studio-mic-select" className="font-semibold">Microphone</label>
                    <select
                      id="studio-mic-select"
                      value={selectedMicValue}
                      onChange={(event) => setSelectedMicId(event.target.value)}
                      className="min-w-0 flex-1 rounded-md border border-[#dccfbf] bg-white px-2 py-1 text-xs text-[#4e4438]"
                    >
                      <option value="">Default microphone</option>
                      {micDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void loadMicDevices()}
                      className="rounded-md border border-[#dccfbf] px-2 py-1 text-[#6a5f52] hover:bg-[#f6f1e9]"
                    >
                      Refresh
                    </button>
                  </div>
                )}

                {transcriptionConfigured !== null && (
                  <div className="mx-auto max-w-2xl text-xs">
                    {transcriptionConfigured ? (
                      <p className="font-semibold text-[#2f8a57]">Transcription configured</p>
                    ) : (
                      <p className="font-semibold text-[#a54136]">Transcription not configured</p>
                    )}
                  </div>
                )}

                {voiceError && (
                  <div className="mx-auto max-w-2xl rounded-xl border border-[#e7c9be] bg-[#fff6f3] px-3 py-2 text-xs text-[#9b3f2f]">
                    {voiceError}
                  </div>
                )}

                {/* Large record button + status + Save */}
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => void toggleRecording()}
                    aria-label={isRecording ? "Stop recording" : "Start recording"}
                    className={`flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg transition-all ${
                      isRecording
                        ? "bg-[#7a1a10] hover:bg-[#5e140b] animate-pulse"
                        : "bg-[#c2241a] hover:bg-[#a01a12]"
                    }`}
                  >
                    <span className="text-5xl">{isRecording ? "⏹" : "🎤"}</span>
                  </button>
                  {isRecording && (
                    <span className="text-sm font-semibold text-[#a54136]">Recording: {formatTime(recordingTime)}</span>
                  )}
                  {recordingError && <span className="text-xs text-[#a54136]">{recordingError}</span>}
                </div>

                {(isRecording || isTranscribing || liveTranscript || recordingError || recordingStatus !== "Idle") && (
                  <div className="mx-auto max-w-2xl rounded-2xl border border-[#e4dacd] bg-white px-4 py-3 text-sm text-[#5f5447]">
                    {(isRecording || isTranscribing) && !liveTranscript && (
                      <p className="italic text-[#8e7f6f]">{recordingStatus}</p>
                    )}
                    {liveTranscript && (
                      <p>
                        <span className="font-semibold text-[#a54136]">Live transcript: </span>
                        {liveTranscript}
                      </p>
                    )}
                    {!isRecording && recordingStatus && !recordingError && (
                      <p className="mt-1 text-xs text-[#8e7f6f]">Status: {recordingStatus}</p>
                    )}
                    {recordingError && <p className="mt-1 text-[#a54136]">{recordingError}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Right sidebar: Vertical photo film strip */}
            <aside className="flex w-32 flex-col border-l border-[#ece5dc] bg-[#f8f6f2] py-6">
              <h3 className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8e7f6f]">Photos</h3>
              
              <div className="mt-3 flex-1 space-y-2 overflow-y-auto px-2">
                {selectedChapter?.photos && selectedChapter.photos.length > 0 ? (
                  selectedChapter.photos.map((photo, index) => (
                    <button
                      key={`${photo}-${index}`}
                      type="button"
                      onClick={() => setSelectedPhotoPreview(photo)}
                      className="group relative w-full overflow-hidden rounded-lg border border-[#d5b991] bg-white"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo}
                        alt="Chapter visual"
                        className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                        View
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-1 text-[10px] text-[#8e7f6f]">Add photos to start</p>
                )}
              </div>
            </aside>
          </div>
        </section>
      </div>

      {showSuggestedChapterPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-3xl border border-[#e4dacd] bg-white p-6 shadow-2xl">
            <h2 className="font-serif text-4xl text-[#1f1711]">Choose Your Suggested Chapters</h2>
            <p className="mt-2 text-[#6e6458]">
              Select the chapters you want to start with. Only these will appear in your story list (plus + New Chapter).
            </p>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {defaultStoryTitles.map((title) => {
                const checked = selectedSuggestedTitles.includes(title);
                return (
                  <label
                    key={title}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${
                      checked ? "border-[#84b4b0] bg-[#eef8f6]" : "border-[#e9e0d3] bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSuggestedChapter(title)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-[#3f3328]">{title}</span>
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSuggestedChapterPicker(false)}
                className="rounded-full border border-[#d7c9b8] bg-white px-4 py-2 text-sm font-semibold text-[#7f6645]"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => void createSelectedSuggestedChapters()}
                disabled={creatingSuggestedChapters || selectedSuggestedTitles.length === 0}
                className="rounded-full bg-[#84b4b0] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {creatingSuggestedChapters ? "Creating..." : "Continue with selected chapters"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConversationHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-3xl border border-[#e4dacd] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-3xl text-[#1f1711]">Conversation History</h2>
              <button
                type="button"
                onClick={() => setShowConversationHistory(false)}
                className="text-2xl text-[#8e7f6f] hover:text-[#6c6255]"
              >
                ×
              </button>
            </div>

            <div className="max-h-96 space-y-4 overflow-y-auto rounded-2xl border border-[#e9e0d3] bg-[#fbfaf7] p-4">
              {chatMessages.length === 0 ? (
                <p className="text-center text-[#8e7f6f]">No messages yet. Start a conversation!</p>
              ) : (
                chatMessages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] ${message.role === "user" ? "" : ""}`}>
                      <p className={`rounded-2xl px-3 py-2 text-sm ${message.role === "user" ? "bg-[#f2d9a7] text-[#442c0e]" : "bg-white text-[#3f3328]"}`}>
                        {message.content}
                      </p>
                      <p className={`mt-1 text-[10px] ${message.role === "user" ? "text-right text-[#8e7f6f]" : "text-[#8e7f6f]"}`}>
                        {message.role === "user" ? "You" : profile.name}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowConversationHistory(false)}
              className="mt-4 w-full rounded-full bg-[#84b4b0] px-4 py-2 font-semibold text-white hover:bg-[#6f9890]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {selectedPhotoPreview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedPhotoPreview(null)}
        >
          <div className="relative max-h-[90vh] max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setSelectedPhotoPreview(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white"
            >
              Close
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPhotoPreview}
              alt="Selected chapter visual"
              className="max-h-[90vh] max-w-[90vw] rounded-2xl border border-white/20 object-contain"
            />
          </div>
        </div>
      )}

      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleUploadPhoto(e)}
      />

      {/* Hidden audio element for playback */}
      <audio ref={audioRef} className="hidden" />
    </main>
  );
}




