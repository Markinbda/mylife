import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PexelsPhoto = {
  id?: number;
  alt?: string;
  src?: { medium?: string; large?: string; original?: string };
  photographer?: string;
  url?: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.PEXELS_API_KEY ?? process.env.NEXT_PUBLIC_PEXELS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Pexels is not configured. Set PEXELS_API_KEY in environment." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    query?: string;
    perPage?: number;
  };

  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "Query is required." }, { status: 400 });
  }

  const perPage = Math.min(Math.max(body.perPage ?? 12, 1), 24);

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`;

  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Pexels request failed: ${text.slice(0, 250)}` },
      { status: res.status },
    );
  }

  const data = (await res.json()) as { photos?: PexelsPhoto[] };
  const photos = (data.photos ?? []).map((photo) => ({
    id: photo.id,
    alt: photo.alt ?? query,
    thumb: photo.src?.medium ?? photo.src?.large ?? photo.src?.original,
    full: photo.src?.large ?? photo.src?.original ?? photo.src?.medium,
    photographer: photo.photographer,
    sourceUrl: photo.url,
  }));

  return NextResponse.json({ photos });
}
