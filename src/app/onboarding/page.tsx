import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const journeyCards = [
  {
    title: "My Life Story",
    description:
      "Build chapters, memories, and timeline moments with a guide who helps you go deeper.",
    href: "/guides",
    cta: "Choose a guide",
  },
  {
    title: "Personal Messages",
    description:
      "Create private messages for loved ones, organized by recipient and delivery intent.",
    href: "/studio?lane=messages",
    cta: "Open message lane",
  },
];

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-10">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9d6d30]">Step 1 of 2</p>
      <h1 className="mt-2 text-4xl text-[#2f2217]">What would you like to work on today?</h1>
      <p className="mt-2 text-sm text-[#6f5b47]">Pick your lane and we will guide you through it.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {journeyCards.map((card) => (
          <article
            key={card.title}
            className="rounded-[24px] border border-[#ddc4a1] bg-[rgba(255,249,238,0.95)] p-6 shadow-[0_16px_35px_rgba(96,63,24,0.12)]"
          >
            <h2 className="text-2xl text-[#2f2217]">{card.title}</h2>
            <p className="mt-2 text-sm text-[#684f33]">{card.description}</p>
            <Link
              href={card.href}
              className="mt-6 inline-flex rounded-full border border-[#b87916]/50 bg-white px-4 py-2 text-sm font-semibold text-[#734f22] transition-colors hover:bg-[#fff2dc]"
            >
              {card.cta}
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}
