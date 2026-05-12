export type GuideProfile = {
  id: "friend" | "archivist" | "coach";
  name: string;
  role: string;
  style: string;
  vibe: string;
  starter: string;
  greeting: string;
  avatar: string;
};

export const guideProfiles: GuideProfile[] = [
  {
    id: "friend",
    name: "Sage",
    role: "Your Trusted Friend",
    style: "Warm and conversational",
    vibe: "Feels like talking to someone who really knows you",
    starter: "What memory feels important to capture today?",
    greeting:
      "Hi, I am Sage. I will help you tell your story in your own words. Let us start gently. What is one memory that still feels vivid when you think about it?",
    avatar: "/images/guide-friend.png",
  },
  {
    id: "archivist",
    name: "Mara",
    role: "Your Memory Archivist",
    style: "Organized and reflective",
    vibe: "Helps place stories in time and connect chapters",
    starter: "Which chapter of your life should we build next?",
    greeting:
      "Hello, I am Mara. I help organize stories into clear chapters and timeline moments. Which chapter of your life feels most important to begin with today?",
    avatar: "/images/guide-archivist.jpg",
  },
  {
    id: "coach",
    name: "Ren",
    role: "Your Legacy Coach",
    style: "Encouraging and momentum-driven",
    vibe: "Pushes past writer's block with practical prompts",
    starter: "What story do you want your loved ones to remember most?",
    greeting:
      "Great to meet you, I am Ren. I will keep your momentum strong and make progress feel easy. What is one story you want your loved ones to always remember about you?",
    avatar: "/images/guide-coach.png",
  },
];

export function getGuideProfile(guideId?: string): GuideProfile {
  return guideProfiles.find((g) => g.id === guideId) ?? guideProfiles[0];
}
