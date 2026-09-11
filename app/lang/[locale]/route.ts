import { NextResponse, type NextRequest } from "next/server";
import { normalizeRoavioLocale } from "../../roavio/i18n";

export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeRoavioLocale(rawLocale);
  const currentOrigin = new URL(request.url).origin;
  const referer = request.headers.get("referer");
  let destination = new URL("/", request.url);

  if (referer) {
    try {
      const candidate = new URL(referer);
      if (candidate.origin === currentOrigin) destination = candidate;
    } catch {
      // Keep the same-origin homepage fallback.
    }
  }

  const response = NextResponse.redirect(destination);
  response.cookies.set("rv_lang", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}
