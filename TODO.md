# Engine Tasks & Bug Tracking

## Critical Bugs

### [BUG-001] SSR Spacing/Sizing Hydration Mismatch — FIXED
**Status:** ✅ Resolved

**Root Cause:**
The `StyleCollector` tier system accumulated render counts across server requests
(module-level `_xReg` Map persists for the lifetime of the Node.js process).
After a few dev-server navigations, CSS blocks promoted to `group` tier on the
server but remained `local` on the fresh browser client. The tier comment strings
(`/* ─── group ─── */` vs `/* ─── local ─── */`) differed, causing React to
report a hydration mismatch on the `dangerouslySetInnerHTML` of `<style id="__engine_styles__">`.

**Fix — two-layer approach:**

1. **`collect()` outputs in insertion order, no tier comments** (`StyleCollector.ts`)
   - Added `_orderedKeys: string[]` and `_seen: Set<string>` per render instance
   - `collect()` iterates `_orderedKeys` and emits CSS without any comments
   - Server and client always render the same schema tree in the same order,
     so `_orderedKeys` is identical on both — producing byte-for-byte equal CSS strings
   - Tier buckets are preserved for `EngineGlobalStyles` pre-injection only

2. **`_resetRegistry()` per request in development** (`createPage.tsx`)
   - `StyleCollector._resetRegistry()` clears `_xReg` before every `createPage` call
     when `NODE_ENV !== "production"`
   - Ensures the server's counter always starts at 1, matching the client
   - In production/SSG, `_xReg` still accumulates across page builds as intended,
     so `EngineGlobalStyles` layout injection continues to work

**Files changed:** `StyleCollector.ts`, `createPage.tsx`

---

## Completed

### EngineScroll system (NEW)
- `EngineScroll` / `EngineScrollProvider` component added
- `scroll` registered in the component registry
- Same-page anchor navigation: smooth-scroll, no page transition
- Cross-page anchor navigation: fade-out → router.push → fade-in → smooth-scroll
- Configurable: `method`, `easing`, `scrollDuration`, `pageTransition`, `transitionDuration`, `scrollOffset`
- `point` prop added to `BaseNodeProps` — sets HTML `id` on any engine node
- `EngineMarkdown` h1/h2 are scroll points by default; opt-out with
  `disablepointformarkdownhash` / `disablepointformarkdownhashhash`

### EngineCSS improvements (NEW)
- `cprop` prop added to `BaseNodeProps` for pseudo-class states + CSS passthrough
- `onHover`, `onFocus`, `onActive` in `cprop` → injected CSS classes (no JS handlers)
- `cprop.css` → direct `CSSProperties` merged into inline style
- `cpropClass()` utility exported for use in custom components
- All primitives now correctly forward `id`, `point`, and `href` to the DOM
- `href` on any layout node wraps it in a transparent `display: contents` `<a>`
