# Generation 3 — Overview

> Branch: `main-3`
>
> This is the current Next.js Engine architecture. Start here before reading the older v1/v2 release notes or the large historical `DOCUMENT.md` reference.

## The stack in one minute

Generation 3 turns a schema into a deterministic execution plan before deciding what the browser needs to own.

```text
PageSchema
	↓
compilePage()
	↓
EngineCompiledPage / enginePlan
	├─ runtime ownership: static / server / client
	├─ work class: critical / visible / near / deferred / idle / sleeping
	├─ used-feature manifest
	├─ fallback plan
	├─ asset graph
	└─ diagnostics
	↓
EngineServerRenderer
	├─ durable HTML stays on the server
	├─ browser behavior becomes narrow client islands
	└─ server-rendered children can cross client-island boundaries
	↓
EngineScheduler + EngineViewport + EngineModel
	↓
optional network/security stack
	EngineCommand / NENC / EngineCookies / EngineServer / EngineAPIResolver
```

The design goal is not “move everything to the client and optimize it later.” The compiler decides which parts actually require browser ownership first.

## `createPage()` is the normal Gen 3 entrypoint

You do not need a separate Gen 3 page factory.

```ts
import { createPage, defineSchema } from "nextjs-engine";

const schema = defineSchema({
	root: {
		type: "section",
		children: [
			{ type: "heading", props: { content: "Hello" } },
		],
	},
});

export default createPage({
	schema,
	compiler: {
		pageId: "home",
		strict: true,
	},
});
```

For schemas without the legacy named-handler boundary, `createPage()` uses the Generation 3 compiler and server renderer by default.

Every returned page exposes its base compiler plan:

```ts
const Page = createPage({ schema });
console.log(Page.enginePlan.summary.clientIslands);
```

The temporary migration escape hatch remains available when an older page still needs the v2 renderer:

```ts
createPage({
	schema,
	compiler: {
		serverFirst: false,
	},
});
```

Named `handlers` currently keep the legacy provider path because that API still assumes one shared client-owned handler registry. Slots do not require that fallback; a server-owned page can pass an interactive React component through a slot and keep the surrounding schema on the server.

## Runtime ownership

Typical ownership looks like this:

| Schema work | Normal Gen 3 owner |
| --- | --- |
| text, headings, boxes, grids, sections | server/static |
| ordinary links | server |
| animated Engine links | client island |
| image markup | server with browser resource loading |
| video | client island |
| Canvas / Manim / Shader runtime | client island |
| dialogs, drawers, popovers | client island |
| interactive form controls | client island |
| `slot` boundary | server-owned boundary; slot content owns itself |

The compiler can upgrade an otherwise-static node when browser-only props, transitions, model bindings, handlers, or other client behavior are attached.

## Adaptive phone and tablet compilation

Use normal responsive props for ordinary layout differences. They compile to CSS and do not require request-time device branching.

Use adaptive compilation when the actual schema structure should change by device class:

```ts
createPage({
	schema,
	mobile: "auto",
	tablet: "auto",
});
```

Phone and tablet compilation can compact structure and spacing while preserving intended visual quality. It does not silently reduce image quality, Canvas DPR, shader resolution, or geometry detail.

## Shared runtime

### EngineScheduler

One scheduler coordinates useful work across lazy mounts, images, video, Canvas/Shader monitoring, and near-viewport preparation.

Its six work states are:

```text
critical → visible → near → deferred → idle → sleeping
```

Frame pressure delays speculative work. It does not lower resolution by default.

### EngineViewport

`EngineViewport` is the shared browser viewport source. It tracks layout and visual viewport dimensions, offsets, orientation, scale, and keyboard inset behind one subscription surface.

```ts
const viewport = useEngineViewport();
```

Use it when behavior genuinely depends on live viewport state. Prefer responsive schema/CSS for styling-only differences.

### EngineModel

`EngineModel` provides shared observable state for Engine-owned browser behavior without forcing unrelated server-rendered schema into one page-level client boundary.

## Compatibility and fallbacks

Every compiler plan includes a used-feature manifest and fallback plan.

Compatibility is evaluated only for features the page actually uses. A page that never requests WebGL, camera, speech, or View Transitions does not receive warnings about them.

Current built-in fallback chains include:

- View Transitions → Web Animations → instant navigation;
- IntersectionObserver → eager rendering;
- container queries → media-query layout → normal flow;
- VisualViewport → layout viewport;
- CSS Grid → normal flow.

Advanced graphics features remain native-only unless an application provides an explicit fallback policy.

## Network and credential boundary

Browser-safe networking lives at:

```ts
import { EngineCommand, EngineCookies } from "nextjs-engine/network";
```

Server-only request/security helpers live at:

```ts
import { EngineServer, createNENCDispatcher } from "nextjs-engine/server";
```

NENC compiles logical commands into build-specific opaque wire identifiers and routes them through one `/_static/command` endpoint. Opaque ids are transport obfuscation, not authorization credentials.

For private operations, combine NENC with real authentication/authorization, replay protection, rate policy, origin checks, and device proof when appropriate. `EngineCookieVault` can keep credential material sealed with AES-256-GCM and release plaintext only inside controlled server operations.

## Build integration

The combined Engine build plugin can compose the pieces that are actually configured by the application:

```js
const { withEngine } = require("./src/engine/plugins/enginePlugin");

module.exports = withEngine(nextConfig, {
	api: { /* EngineAPI / APIStatic options */ },
	shader: { /* EngineShader options */ },
	nenc: { /* optional NENC build options */ },
});
```

Do not enable NENC, Shader compilation, or other subsystems merely because they exist. Configure the features the application actually uses.

## Read next

| Goal | Document |
| --- | --- |
| Compiler, server rendering, scheduler, adaptive layout | [`phase-a-b.md`](./phase-a-b.md) |
| NENC, EngineCookies, device proof, sessions, private backends | [`phase-c-network.md`](./phase-c-network.md) |
| Used-feature manifests, fallbacks, legacy durability | [`phase-d-hardening.md`](./phase-d-hardening.md) |
| End-to-end device-bound private-search example | [`private-search-example.md`](./private-search-example.md) |
| Schema/style/component APIs | [`../readme.md`](../readme.md) and [`../engine-components/`](../engine-components/) |
| Historical release contracts | [`../release/index.md`](../release/index.md) |

## Current migration rule

New Generation 3 pages should start with normal `createPage()` and server-first compilation. Keep client ownership narrow and intentional. Use compatibility paths only where an older API still requires them, and remove those fallbacks when the real dependency is migrated.
