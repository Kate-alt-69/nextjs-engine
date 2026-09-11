import { NextResponse } from "next/server";

const SYNODIC_MONTH = 29.530588853;
const REVALIDATE_SECONDS = 60 * 60 * 6;

function fallbackMoon() {
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
  const days = (Date.now() - knownNewMoon) / 86_400_000;
  const age = ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  const phaseFraction = age / SYNODIC_MONTH;
  const illumination = (1 - Math.cos(phaseFraction * Math.PI * 2)) * 50;
  const phase = phaseFraction < 0.03 || phaseFraction > 0.97 ? "New Moon"
    : phaseFraction < 0.22 ? "Waxing Crescent"
      : phaseFraction < 0.28 ? "First Quarter"
        : phaseFraction < 0.47 ? "Waxing Gibbous"
          : phaseFraction < 0.53 ? "Full Moon"
            : phaseFraction < 0.72 ? "Waning Gibbous"
              : phaseFraction < 0.78 ? "Last Quarter"
                : "Waning Crescent";
  return { phase, illumination, age, phaseFraction, source: "astronomical fallback" };
}

export async function GET() {
  const timestamp = Math.floor(Date.now() / 1000);
  try {
    const response = await fetch(`https://api.farmsense.net/v1/moonphases/?d=${timestamp}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`FarmSense ${response.status}`);
    const payload = await response.json() as Array<Record<string, unknown>>;
    const entry = payload[0] ?? {};
    const age = Number(entry.Age);
    const rawIllumination = Number(entry.Illumination);
    if (!Number.isFinite(age)) throw new Error("Moon age missing");
    const illumination = Number.isFinite(rawIllumination)
      ? (rawIllumination <= 1 ? rawIllumination * 100 : rawIllumination)
      : (1 - Math.cos((age / SYNODIC_MONTH) * Math.PI * 2)) * 50;
    return NextResponse.json({
      phase: typeof entry.Phase === "string" ? entry.Phase : "Moon",
      illumination: Math.max(0, Math.min(100, illumination)),
      age,
      phaseFraction: ((age / SYNODIC_MONTH) % 1 + 1) % 1,
      source: "FarmSense",
    }, {
      headers: { "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=${REVALIDATE_SECONDS * 2}` },
    });
  } catch {
    return NextResponse.json(fallbackMoon(), {
      headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
    });
  }
}
