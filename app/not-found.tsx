// ─────────────────────────────────────────────────────────────────────────────
//  Engine default 404 fallback.
//
//  This file is the floor — it re-exports the engine's built-in 404 page so
//  Next.js always has something to render. Replace it with your own
//  not-found.tsx to override; next.config.js will regenerate this shim if the
//  file goes missing with no replacement.
// ─────────────────────────────────────────────────────────────────────────────
export { default } from "@/error-page";
