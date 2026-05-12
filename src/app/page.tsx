import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#110a04]">
      {/* â”€â”€ HERO â”€â”€ full viewport */}
      <section
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden"
        style={{
          backgroundImage: "url(/images/sunset_over_ocean.png)",
          backgroundSize: "cover",
          backgroundPosition: "center 40%",
        }}
      >
        {/* cinematic dark-warm overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(18,8,2,0.55)] via-[rgba(18,8,2,0.45)] to-[rgba(10,4,1,0.80)]" />

        {/* Nav */}
        <nav className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-8 py-7">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-300/70">
              MyLife.bm
            </p>
            <span className="font-serif text-2xl font-bold text-white">MyLife</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/register"
              className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-amber-400"
            >
              Register
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white/90 backdrop-blur-sm transition-all hover:bg-white/20"
            >
              Sign in
            </Link>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.38em] text-amber-300/80">
            Your story. Your voice. Your legacy.
          </p>
          <h2 className="mb-6 font-serif text-5xl font-bold leading-tight text-white md:text-[5.5rem] md:leading-[1.08]">
            Every life is a story<br />worth telling.
          </h2>
          <p className="mx-auto mb-11 max-w-2xl text-lg leading-relaxed text-white/65 md:text-xl">
            A guide who listens, remembers, and helps you shape the moments that matter â€”
            one chapter at a time.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="rounded-full bg-amber-500 px-9 py-4 text-base font-semibold text-white shadow-lg shadow-amber-900/40 transition-all hover:bg-amber-400"
            >
              Begin Your Story
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/35 px-9 py-4 text-base font-semibold text-white/85 transition-all hover:bg-white/10"
            >
              Already a member?
            </Link>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-center text-white/35">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 14l-7-7h14l-7 7z" />
          </svg>
        </div>
      </section>

      {/* â”€â”€ PILLARS â”€â”€ dark warm section */}
      <section className="bg-[#140a03] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-400/60">
            What makes MyLife different
          </p>
          <h3 className="mb-16 text-center font-serif text-3xl font-bold text-white md:text-4xl">
            A friend who helps you remember
          </h3>
          <div className="grid gap-12 md:grid-cols-3">
            {[
              {
                glyph: "âœ¦",
                title: "Guide-led conversations",
                desc: "Choose a guide â€” warm friend, curious interviewer, or quiet companion â€” who shapes every session around you.",
              },
              {
                glyph: "â—ˆ",
                title: "Timeline that grows with you",
                desc: "Chapters arrange themselves into a living timeline. Add dates, photos, and memories whenever you're ready.",
              },
              {
                glyph: "â™¡",
                title: "Messages to loved ones",
                desc: "Record heartfelt messages for the people who matter most â€” preserved and delivered when the moment is right.",
              },
            ].map((f) => (
              <div key={f.title} className="text-center">
                <div className="mb-4 text-3xl text-amber-400">{f.glyph}</div>
                <h4 className="mb-3 font-serif text-xl font-semibold text-white">{f.title}</h4>
                <p className="text-sm leading-relaxed text-white/50">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* â”€â”€ CTA BANNER â”€â”€ notebook image */}
      <section
        className="relative flex min-h-[52vh] flex-col items-center justify-center overflow-hidden px-6 py-28"
        style={{
          backgroundImage: "url(/images/old_notebook_desk_lamp_pen.png)",
          backgroundSize: "cover",
          backgroundPosition: "center 35%",
        }}
      >
        <div className="absolute inset-0 bg-[rgba(12,6,2,0.74)]" />
        <div className="relative z-10 mx-auto max-w-2xl text-center">
          <h3 className="mb-5 font-serif text-4xl font-bold text-white md:text-5xl">
            Where would you like to begin?
          </h3>
          <p className="mb-9 text-base leading-relaxed text-white/60">
            Start with a single memory. Your guide will take it from there.
          </p>
          <Link
            href="/register"
            className="inline-block rounded-full bg-amber-500 px-11 py-4 text-base font-semibold text-white shadow-lg shadow-black/40 transition-all hover:bg-amber-400"
          >
            Start MyLife Journey
          </Link>
        </div>
      </section>

      {/* â”€â”€ FOOTER â”€â”€ */}
      <footer className="bg-[#0d0602] px-6 py-8 text-center">
        <p className="text-[11px] text-white/25">Â© 2026 MyLife.bm â€” Your story, preserved.</p>
      </footer>
    </div>
  );
}

