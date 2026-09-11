export interface RoavioCity {
  city: string;
  country: string;
  continent: string;
  cost: string;
  quality: number;
  safety: number;
  internet: number;
  beach: boolean;
}

export const cities: RoavioCity[] = [
  { city: "Abu Dabi", country: "United Arab Emirates", continent: "Middle East", cost: "EUR 786/mo", quality: 9.3, safety: 8.9, internet: 356, beach: true },
  { city: "Accra", country: "Ghana", continent: "Africa", cost: "GHS 525/mo", quality: 1.4, safety: 5.5, internet: 53, beach: true },
  { city: "Amán", country: "Jordania", continent: "Middle East", cost: "JOD 664/mo", quality: 6.1, safety: 6.3, internet: 195, beach: false },
  { city: "Ámsterdam", country: "Netherlands", continent: "Europe", cost: "EUR 1131/mo", quality: 9.9, safety: 7, internet: 224, beach: false },
  { city: "Atenas", country: "Grecia", continent: "Europe", cost: "EUR 848/mo", quality: 6.4, safety: 4.5, internet: 87, beach: true },
  { city: "Auckland", country: "Nueva Zelanda", continent: "Oceania", cost: "NZD 983/mo", quality: 8.9, safety: 4.9, internet: 216, beach: true },
  { city: "Bali", country: "Indonesia", continent: "Asia", cost: "EUR 358/mo", quality: 6.2, safety: 7.3, internet: 43, beach: true },
  { city: "Bangkok", country: "Thailand", continent: "Asia", cost: "EUR 644/mo", quality: 4, safety: 6.2, internet: 275, beach: false },
  { city: "Barcelona", country: "Spain", continent: "Europe", cost: "EUR 816/mo", quality: 7.5, safety: 4.8, internet: 263, beach: true },
  { city: "Belgrado", country: "Serbia", continent: "Europe", cost: "EUR 734/mo", quality: 6.1, safety: 6.2, internet: 103.8, beach: false },
  { city: "Berlín", country: "Alemania", continent: "Europe", cost: "EUR 1055/mo", quality: 8.5, safety: 5.5, internet: 102, beach: false },
  { city: "Bogotá", country: "Colombia", continent: "Americas", cost: "EUR 604/mo", quality: 5.2, safety: 3.3, internet: 207, beach: false },
  { city: "Braga", country: "Portugal", continent: "Europe", cost: "EUR 676/mo", quality: 9.2, safety: 6, internet: 237, beach: false },
  { city: "Budapest", country: "Hungary", continent: "Europe", cost: "EUR 792/mo", quality: 7, safety: 6.6, internet: 237, beach: false },
  { city: "Buenos Aires", country: "Argentina", continent: "Americas", cost: "EUR 770/mo", quality: 5.9, safety: 3.7, internet: 110, beach: false },
  { city: "Chiang Mai", country: "Thailand", continent: "Asia", cost: "EUR 472/mo", quality: 6.8, safety: 7.8, internet: 275, beach: false },
  { city: "Ciudad de México", country: "Mexico", continent: "Americas", cost: "EUR 729/mo", quality: 4.8, safety: 3.4, internet: 92, beach: false },
  { city: "Ciudad del Cabo", country: "South Africa", continent: "Africa", cost: "EUR 606/mo", quality: 7.8, safety: 2.6, internet: 48.3, beach: true },
  { city: "Colombo", country: "Sri Lanka", continent: "Asia", cost: "USD 506/mo", quality: 3, safety: 5.7, internet: 33, beach: true },
  { city: "Copenhague", country: "Denmark", continent: "Europe", cost: "EUR 1217/mo", quality: 9.9, safety: 7.4, internet: 266, beach: true },
  { city: "Cracovia", country: "Poland", continent: "Europe", cost: "EUR 729/mo", quality: 7.5, safety: 7.5, internet: 213, beach: false },
  { city: "Doha", country: "Catar", continent: "Middle East", cost: "QAR 747/mo", quality: 8.7, safety: 8.5, internet: 197, beach: true },
  { city: "Dubái", country: "United Arab Emirates", continent: "Middle East", cost: "EUR 900/mo", quality: 8.4, safety: 8.4, internet: 356, beach: true },
  { city: "El Cairo", country: "Egipto", continent: "Africa", cost: "EGP 355/mo", quality: 4.1, safety: 5, internet: 92, beach: false },
  { city: "Estambul", country: "Turkey", continent: "Europe", cost: "EUR 679/mo", quality: 6.4, safety: 5.2, internet: 69, beach: true },
  { city: "Florencia", country: "Italia", continent: "Europe", cost: "EUR 1005/mo", quality: 7.6, safety: 5.8, internet: 110, beach: false },
  { city: "Hanói", country: "Vietnam", continent: "Asia", cost: "EUR 408/mo", quality: 4.5, safety: 6.6, internet: 274, beach: false },
  { city: "Ho Chi Minh", country: "Vietnam", continent: "Asia", cost: "EUR 428/mo", quality: 3.7, safety: 5, internet: 274, beach: false },
  { city: "Kuala Lumpur", country: "Malaysia", continent: "Asia", cost: "EUR 559/mo", quality: 6.7, safety: 4.1, internet: 162, beach: false },
  { city: "Lima", country: "Perú", continent: "Americas", cost: "PEN 530/mo", quality: 4.5, safety: 3, internet: 252, beach: true },
  { city: "Lisboa", country: "Portugal", continent: "Europe", cost: "EUR 816/mo", quality: 7.8, safety: 6.7, internet: 237, beach: true },
  { city: "Londres", country: "United Kingdom", continent: "Europe", cost: "GBP 1070/mo", quality: 7.3, safety: 4.5, internet: 163, beach: false },
  { city: "Madrid", country: "Spain", continent: "Europe", cost: "EUR 821/mo", quality: 9, safety: 7.1, internet: 263, beach: false },
  { city: "Manila", country: "Filipinas", continent: "Asia", cost: "EUR 492/mo", quality: 2.6, safety: 3.5, internet: 108, beach: false },
  { city: "Marrakech", country: "Marruecos", continent: "Africa", cost: "EUR 468/mo", quality: 5.6, safety: 5.5, internet: 57, beach: false },
  { city: "Mascate", country: "Omán", continent: "Middle East", cost: "OMR 636/mo", quality: 9.2, safety: 8.1, internet: 94, beach: true },
  { city: "Medellín", country: "Colombia", continent: "Americas", cost: "EUR 682/mo", quality: 5.8, safety: 4.6, internet: 207, beach: false },
  { city: "Melbourne", country: "Australia", continent: "Oceania", cost: "AUD 1160/mo", quality: 9.4, safety: 5.6, internet: 164, beach: true },
  { city: "Miami", country: "United States", continent: "North America", cost: "USD 1222/mo", quality: 7.9, safety: 4.7, internet: 303, beach: true },
  { city: "Milán", country: "Italia", continent: "Europe", cost: "EUR 1115/mo", quality: 6, safety: 4.6, internet: 110, beach: false },
  { city: "Montevideo", country: "Uruguay", continent: "Americas", cost: "UYU 810/mo", quality: 7, safety: 4.3, internet: 194, beach: true },
  { city: "Múnich", country: "Alemania", continent: "Europe", cost: "EUR 1111/mo", quality: 9.9, safety: 7.8, internet: 102, beach: false },
  { city: "Nairobi", country: "Kenia", continent: "Africa", cost: "KES 459/mo", quality: 5, safety: 4.1, internet: 16, beach: false },
  { city: "Oporto", country: "Portugal", continent: "Europe", cost: "EUR 721/mo", quality: 8.9, safety: 6.6, internet: 237, beach: true },
  { city: "Osaka", country: "Japan", continent: "Asia", cost: "JPY 625/mo", quality: 9, safety: 6.7, internet: 230, beach: false },
  { city: "Oslo", country: "Noruega", continent: "Europe", cost: "EUR 1371/mo", quality: 9.4, safety: 6.6, internet: 169, beach: false },
  { city: "París", country: "Francia", continent: "Europe", cost: "EUR 1126/mo", quality: 7, safety: 4.2, internet: 346, beach: false },
  { city: "Pekín", country: "China", continent: "Asia", cost: "CNY 3940/mo", quality: 5.8, safety: 7.4, internet: 223, beach: false },
  { city: "Praga", country: "Czech Republic", continent: "Europe", cost: "EUR 836/mo", quality: 8.8, safety: 7.5, internet: 89, beach: false },
  { city: "Roma", country: "Italia", continent: "Europe", cost: "EUR 861/mo", quality: 7.3, safety: 5.3, internet: 110, beach: false },
  { city: "San Francisco", country: "United States", continent: "North America", cost: "USD 1579/mo", quality: 8.3, safety: 4, internet: 303, beach: true },
  { city: "Santiago", country: "Chile", continent: "Americas", cost: "CLP 602/mo", quality: 5.6, safety: 3.6, internet: 357, beach: false },
  { city: "Seattle", country: "United States", continent: "North America", cost: "USD 1571/mo", quality: 9.2, safety: 4.5, internet: 303, beach: false },
  { city: "Seúl", country: "South Korea", continent: "Asia", cost: "EUR 1015/mo", quality: 7.9, safety: 7.5, internet: 233, beach: false },
  { city: "Sevilla", country: "Spain", continent: "Europe", cost: "EUR 698/mo", quality: 8.8, safety: 6.3, internet: 263, beach: false },
  { city: "Shanghái", country: "China", continent: "Asia", cost: "CNY 4183/mo", quality: 6.6, safety: 7.4, internet: 223, beach: false },
  { city: "Shenzhen", country: "China", continent: "Asia", cost: "EUR 583/mo", quality: 7.7, safety: 7.6, internet: 223, beach: true },
  { city: "Sídney", country: "Australia", continent: "Oceania", cost: "AUD 1137/mo", quality: 9.1, safety: 6.6, internet: 164, beach: true },
  { city: "Singapur", country: "Singapur", continent: "Asia", cost: "EUR 1304/mo", quality: 7.5, safety: 7.8, internet: 407, beach: true },
  { city: "Sofía", country: "Bulgaria", continent: "Europe", cost: "EUR 722/mo", quality: 7, safety: 6.1, internet: 89, beach: false },
  { city: "Split", country: "Croatia", continent: "Europe", cost: "EUR 836/mo", quality: 8.7, safety: 7, internet: 113, beach: true },
  { city: "Taipéi", country: "Taiwan", continent: "Asia", cost: "EUR 788/mo", quality: 7.9, safety: 8.4, internet: 259.9, beach: false },
  { city: "Tallin", country: "Estonia", continent: "Europe", cost: "EUR 939/mo", quality: 9.6, safety: 7.8, internet: 94, beach: false },
  { city: "Tiflis", country: "Georgia", continent: "Europe", cost: "EUR 574/mo", quality: 6, safety: 7.4, internet: 45, beach: false },
  { city: "Tokio", country: "Japan", continent: "Asia", cost: "EUR 804/mo", quality: 8.7, safety: 7.6, internet: 230, beach: false },
  { city: "Toronto", country: "Canada", continent: "North America", cost: "CAD 1488/mo", quality: 8.5, safety: 5.6, internet: 256, beach: false },
  { city: "Valencia", country: "Spain", continent: "Europe", cost: "EUR 766/mo", quality: 9.1, safety: 6.2, internet: 263, beach: true },
  { city: "Vancouver", country: "Canada", continent: "North America", cost: "CAD 985/mo", quality: 9.3, safety: 5.7, internet: 256, beach: true },
  { city: "Varsovia", country: "Poland", continent: "Europe", cost: "EUR 787/mo", quality: 7.6, safety: 7.5, internet: 213, beach: false },
  { city: "Viena", country: "Austria", continent: "Europe", cost: "EUR 1060/mo", quality: 9.9, safety: 7.1, internet: 114, beach: false }
];

export function citySlug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function findCity(slug: string): RoavioCity | undefined {
  return cities.find((city) => citySlug(city.city) === slug);
}

export const featuredImages: Record<string, string> = {
  valencia: "https://images.unsplash.com/photo-1577990432593-6bf35f43beed?q=82&w=1400&auto=format&fit=crop",
  lisboa: "https://images.unsplash.com/photo-1513735492246-483525079686?q=82&w=1400&auto=format&fit=crop",
  bali: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=82&w=1400&auto=format&fit=crop",
  bangkok: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?q=82&w=1400&auto=format&fit=crop",
  dubai: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=82&w=1400&auto=format&fit=crop"
};

export function nomadScore(city: RoavioCity): number {
  const internetScore = Math.min(city.internet / 40, 10);
  return Math.round((city.quality * 0.45 + city.safety * 0.3 + internetScore * 0.25) * 10) / 10;
}
