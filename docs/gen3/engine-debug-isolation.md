# EngineDebug ephemeral isolation

`/_engine/debug` is a development-only Engine route. It must behave like an Engine-owned workbench even when the host Next.js application has a global root layout with headers, footers, cookie banners, portals, analytics UI, or aggressive global CSS.

## Why isolation is required

Next.js App Router root layouts always wrap nested pages. A generated `app/%5Fengine/debug/page.tsx` therefore cannot structurally opt out of an application's `app/layout.tsx`.

EngineDebug solves this at the client boundary instead of requiring every application to special-case `/_engine/*`.

## Isolation contract

The generated debug route wraps the workbench in `EngineDebugIsolation`.

During the first server paint, a bootstrap surface covers the viewport and suppresses sibling host chrome along the route's ancestor chain.

After hydration, EngineDebug:

- creates a dedicated host directly under `document.body`;
- mounts the workbench into a Shadow DOM root through a React portal;
- hides and marks every other direct body surface inert and `aria-hidden`;
- watches for later body-level portals and suppresses them as they are added;
- applies maximum-priority fixed positioning to the debug host;
- prevents host global CSS from crossing into the workbench through Shadow DOM;
- restores all previous `inert`, `aria-hidden`, focus, and document state when the route unmounts.

This keeps host headers, footers, cookie portals, floating widgets, and unrelated overlays out of the EngineDebug UI without depending on application class names.

## Preview behavior

Isolation applies to the **debug workbench**, not to the page being inspected inside its preview iframe.

If the selected application route legitimately renders its own navigation, cookie notice, modal, or footer, that UI remains visible inside the preview. Removing it would make the preview inaccurate.

The outer `/_engine/debug` workbench itself must not inherit those surfaces.

## What isolation does not claim

The App Router parent layout has already been instantiated before a nested page can run. EngineDebug therefore cannot prevent arbitrary host React effects, analytics calls, or server work from having executed.

The isolation contract is specifically that host UI cannot render into, style, cover, focus, or accept input over the EngineDebug workbench. Applications that want to avoid even mounting expensive host effects may additionally short-circuit `/_engine/*` in their own root chrome, but that is an optional optimization rather than a correctness requirement.

## Production invariant

`EngineDebugIsolation` is reachable only from the generated development route. Production preparation removes `app/%5Fengine/debug/page.tsx` before route discovery, and the production proof rejects both EngineDebug UI markers and the isolation marker from emitted server/client bundles.
