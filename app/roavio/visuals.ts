export const featuredImages: Record<string, string> = {
  valencia: "https://images.unsplash.com/photo-1577990432593-6bf35f43beed?q=78&w=960&auto=format&fit=crop",
  lisboa: "https://images.unsplash.com/photo-1513735492246-483525079686?q=78&w=960&auto=format&fit=crop",
  bali: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=78&w=960&auto=format&fit=crop",
  bangkok: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?q=78&w=960&auto=format&fit=crop",
  dubai: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=78&w=960&auto=format&fit=crop",
  barcelona: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?q=78&w=960&auto=format&fit=crop",
  amsterdam: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?q=78&w=960&auto=format&fit=crop",
  paris: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=78&w=960&auto=format&fit=crop",
  londres: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=78&w=960&auto=format&fit=crop",
  tokio: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=78&w=960&auto=format&fit=crop",
  singapur: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?q=78&w=960&auto=format&fit=crop",
  sidney: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?q=78&w=960&auto=format&fit=crop",
  roma: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=78&w=960&auto=format&fit=crop",
  "san-francisco": "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?q=78&w=960&auto=format&fit=crop",
  miami: "https://images.unsplash.com/photo-1506966953602-c20cc11f75e3?q=78&w=960&auto=format&fit=crop",
  seul: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?q=78&w=960&auto=format&fit=crop",
  praga: "https://images.unsplash.com/photo-1541849546-216549ae216d?q=78&w=960&auto=format&fit=crop",
  berlin: "https://images.unsplash.com/photo-1560969184-10fe8719e047?q=78&w=960&auto=format&fit=crop",
  "ciudad-del-cabo": "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?q=78&w=960&auto=format&fit=crop",
  viena: "https://images.unsplash.com/photo-1516550893923-42d28e5677af?q=78&w=960&auto=format&fit=crop",
};

export function cityImage(slug: string): string | null {
  return featuredImages[slug] ?? null;
}

export function cityInitials(city: string): string {
  return city
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("es") ?? "")
    .join("");
}
