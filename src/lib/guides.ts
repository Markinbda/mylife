export type GuideProfile = {
  id: "teenager" | "housewife" | "older_man";
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
    id: "teenager",
    name: "Teenager",
    role: "Your Young Guide",
    style: "Curious and energetic",
    vibe: "Brings fresh perspective to your stories",
    starter: "What's a story from your past you think I should know?",
    greeting:
      "Hey! I'm a teenager and I'm excited to hear your stories. What's something from your life that you think is really important? I want to understand you better.",
    avatar: "/images/guide-friend.png",
  },
  {
    id: "housewife",
    name: "Housewife",
    role: "Your Caring Guide",
    style: "Warm and nurturing",
    vibe: "Understands life's everyday moments and milestones",
    starter: "Tell me about the everyday moments that shaped you.",
    greeting:
      "Hello dear, I'm here to listen to your stories. I've lived through so many seasons of life, and I'd love to hear about yours. What memory would you like to share with me today?",
    avatar: "/images/guide-archivist.jpg",
  },
  {
    id: "older_man",
    name: "Older Man",
    role: "Your Wise Guide",
    style: "Thoughtful and reflective",
    vibe: "Brings life wisdom and perspective to your legacy",
    starter: "What lessons from your life matter most to you?",
    greeting:
      "Good to meet you. I'm an older man who's seen a lot in life. I'd like to hear your story and understand what shaped you. What's a moment you'd like to talk about?",
    avatar: "/images/guide-coach.png",
  },
];

export function getGuideProfile(guideId?: string): GuideProfile {
  return guideProfiles.find((g) => g.id === guideId) ?? guideProfiles[0];
}
