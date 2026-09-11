import { NextRequest, NextResponse } from "next/server";

const REVALIDATE_SECONDS = 60 * 60 * 24 * 30;

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city")?.trim();
  const country = request.nextUrl.searchParams.get("country")?.trim();
  if (!city) return NextResponse.json({ image: null }, { status: 400 });

  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `${city}${country ? ` ${country}` : ""}`,
    gsrnamespace: "0",
    gsrlimit: "1",
    prop: "pageimages|info",
    piprop: "thumbnail",
    pithumbsize: "960",
    inprop: "url",
    format: "json",
    formatversion: "2",
    origin: "*",
  });

  try {
    const response = await fetch(`https://es.wikipedia.org/w/api.php?${params.toString()}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: {
        Accept: "application/json",
        "User-Agent": "RoavioProposal/1.0 (city thumbnail resolver)",
      },
    });
    if (!response.ok) throw new Error(`Wikipedia ${response.status}`);
    const data = await response.json() as {
      query?: { pages?: Array<{ thumbnail?: { source?: string }; fullurl?: string; title?: string }> };
    };
    const page = data.query?.pages?.[0];
    return NextResponse.json({
      image: page?.thumbnail?.source ?? null,
      page: page?.fullurl ?? null,
      title: page?.title ?? null,
      source: "Wikipedia / Wikimedia Commons",
    }, {
      headers: { "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=${REVALIDATE_SECONDS}` },
    });
  } catch {
    return NextResponse.json({ image: null, source: "unavailable" }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  }
}
