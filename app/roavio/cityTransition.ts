import type { EngineTransitionInput } from "@/engine";

/**
 * Stable DOM id used by NE shared View Transitions.
 *
 * Only the card that initiated navigation is promoted to a named transition
 * surface, then the matching city hero takes over that same surface on the
 * destination page. Other cards stay in the normal root snapshot.
 */
export function cityTransitionSurfaceId(slug: string): string {
  const safe = slug.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `rv-city-surface-${safe || "city"}`;
}

/**
 * Card -> dossier transition.
 *
 * NE's shared-element support morphs the card surface into the destination
 * hero. The rest of the page uses a longer fade, so the visual hierarchy reads
 * as "card expands first, details arrive second" without a heavy blur/portal
 * effect on mobile GPUs. Browsers without native View Transitions fall back to
 * NE's normal animated compatibility path.
 */
export function cityExpandTransition(slug: string): EngineTransitionInput {
  return {
    type: "fade",
    duration: 460,
    easing: "cubic-bezier(.18,.82,.22,1)",
    shared: cityTransitionSurfaceId(slug),
  };
}
