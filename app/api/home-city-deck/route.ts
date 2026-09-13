import { NextResponse } from "next/server";
import { getCitySlugs, loadCityCatalogForSlugs } from "../../roavio/cityContent.server";
import { getRoavioCityImage } from "../../roavio/cityImages";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function shuffled<T>(source: readonly T[]): T[] {
  const result = [...source];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapWith]] = [result[swapWith], result[index]];
  }
  return result;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = Number.parseInt(url.searchParams.get("limit") ?? "30", 10);
  const limit = Math.max(3, Math.min(30, Number.isFinite(requested) ? requested : 30));
  const slugs = (await getCitySlugs()).filter((slug) => Boolean(getRoavioCityImage(slug)));
  const selected = shuffled(slugs).slice(0, Math.min(limit, slugs.length));
  const loaded = await loadCityCatalogForSlugs(selected);
  const bySlug = new Map(loaded.map((city) => [city.slug, city] as const));
  const cities = selected.flatMap((slug) => {
    const city = bySlug.get(slug);
    return city ? [city] : [];
  });

  return NextResponse.json(
    { cities },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}
