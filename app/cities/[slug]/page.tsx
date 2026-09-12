import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createCityDossier } from "../../roavio/CityDossier";
import { getCitySlugs, loadCityContent } from "../../roavio/cityContent.server";
import { getRoavioLocale } from "../../roavio/locale.server";

export async function generateStaticParams() {
  return (await getCitySlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getRoavioLocale()]);
  const city = await loadCityContent(slug, locale);
  if (!city) return {};
  return {
    title: locale === "es"
      ? `${city.name}, ${city.country} para nómadas digitales | Roavio`
      : `${city.name}, ${city.country} for digital nomads | Roavio`,
    description: city.summary || (locale === "es"
      ? `Coste, internet, seguridad, calidad de vida y guía para ${city.name}.`
      : `Cost, internet, safety, quality of life and relocation context for ${city.name}.`),
  };
}

export default async function CityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, locale] = await Promise.all([params, getRoavioLocale()]);
  const city = await loadCityContent(slug, locale);
  if (!city) notFound();
  const CityDossier = createCityDossier(city, locale);
  return <CityDossier />;
}
