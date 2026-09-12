export function cityInitials(city: string): string {
  return city
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("es") ?? "")
    .join("");
}
