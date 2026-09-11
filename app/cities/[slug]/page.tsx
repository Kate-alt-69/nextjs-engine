import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createCityDossier } from "../../roavio/CityDossier";
import { getCitySlugs, loadCityContent } from "../../roavio/cityContent.server";

export async function generateStaticParams() {
  return (await getCitySlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const city = await loadCityContent(slug);
  if (!city) return {};
  return {
    title: `${city.name}, ${city.country} para nómadas digitales | Roavio`,
    description: city.summary || `Coste, internet, seguridad, calidad de vida y guía para ${city.name}.`,
  };
}

export default async function CityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const city = await loadCityContent(slug);
  if (!city) notFound();
  const CityDossier = createCityDossier(city);
  return <CityDossier />;
}
