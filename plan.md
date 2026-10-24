# EngineTheme / createTheme / Pretty-please — Implementation Plan

**Status:** Implementation in progress on feat/enginetheme-foundation; phases are being delivered incrementally.  
**Repository:** Kate-alt-69/nextjs-engine  
**Baseline inspected:** main-3, 2026-10-24

## 1. Outcome and constraints

Design and then implement a shared EngineTheme system, starting with EngineMarkdown while preserving Gen 3's server-first rendering and existing behavior.

The scope includes:

- A public createTheme() API imported from nextjs-engine.
- Theme groups, component themes, named variants, and local/global/remote scopes.
- A JSON .etr artifact emitted by NENC for every compiled theme group.
- Remote .etr resolution from a user-owned endpoint, with no Engine-operated hosting service required.
- Pretty-please: automatic or user-selected syntax highlighting, a provider/language list, and per-language custom palettes.
- UI templates that define structure, placement, styling, composition, and supported event behavior.
- A small event-driven Data-API that allocates/dispatches events to configured behavior. It is not a preview, inspection, explanation, or comparison API.
- A production font download/cache pipeline; dev mode uses the declared font links and does not download fonts through the Engine build pipeline.
- Existing inline EngineTheme configuration and EngineMarkdown props remain compatible unless a breaking change is explicitly approved.

**Security invariant:** theme data and remote .etr content are never executable JavaScript or JSX. Native React/Next.js components are trusted local code registered as adapters; remote theme data may reference an adapter ID but cannot provide source code for automatic execution.

## 2. Public API and ID rules

The createTheme() API defines a theme group. The root ID is the group's name, not the full component theme ID.

~~~ts
import { createTheme } from "nextjs-engine";

export const myTheme = createTheme({
  id: "mycoolthemes",
  scope: "global",

  markdown: {
    // Pretty-please, code blocks, tables, fonts, templates, etc.
  },

  // Other supported Engine components can be added here.
});
~~~

This illustrates the shape only. Final variant syntax and exact property names must be settled before implementation.

ID model:

- Group: mycoolthemes
- Component theme: mycoolthemes.markdown
- Variant: mycoolthemes.markdown.dark
- Nested variant: mycoolthemes.markdown.1.2.560
- Allow at most three subtheme segments after the component segment.
- Variants inherit their parent and state only the differences.
- Centrally validate IDs, references, duplicates, unknown components, inheritance cycles, and depth.
- Define whether and how group-level naming may contain dots; avoid ambiguous parsing.

A schema can request a theme by ID:

~~~ts
{
  theme: {
    id: "mycoolthemes.markdown.dark"
  }
}
~~~

The current PageSchema.theme is an inline object with vars, fonts, and globalStyles. Preserve that API through a migration-safe union/resolver. The createTheme() call itself should be deterministic and should not perform network requests, publish themes, download fonts, or write build artifacts.

Scope semantics:

- local: available within its declared page/project context.
- global: registered for reuse across the application, but not inherently URL-addressable.
- remote: intended to be fetched by URL and consumed by another project/site.
- Every compiled group can produce .etr. Only remote scope means the artifact is intended for URL-based consumption; compiling and publishing are separate operations.

Define predictable precedence across defaults, inherited variants, shared tokens, component configuration, and explicit per-node overrides. Keep semantic UI tokens separate from syntax-highlight token colors.

## 3. .etr format, remote hosting, and NENC

Generated artifact path:

~~~text
.nextjs-engine/gen3/theme/<theme_name>.etr
~~~

The .etr is UTF-8 JSON representing a compiled theme group. Its envelope should include a format identifier/version, group ID/name, component definitions within a content field, the resolved Next.js and Engine versions used to generate it, and a SHA-256 digest.

Illustrative shape:

~~~json
{
  "format": "nextjs-engine-theme",
  "formatVersion": 1,
  "id": "mycoolthemes",
  "createdWith": {
    "nextjs": "<resolved version>",
    "nextjsEngine": "<resolved version>"
  },
  "sha256": "<digest of canonical payload>",
  "content": {
    "name": "My Cool Themes",
    "components": {
      "markdown": {}
    }
  }
}
~~~

This is not the final schema. Define canonical serialization, including exactly which fields are hashed and excluding the digest field itself. SHA-256 detects content changes relative to the supplied digest; it does not authenticate the publisher.

Remote handling:

- A remote .etr may be hosted at a user-controlled endpoint such as https://example.net/nextjs-engine/theme/dark-fantasy.etr.
- Do not require an Engine-hosted registry for the initial release.
- Decide how an ID resolves to a URL: explicit source URL, configured base URL, registry mapping, or another stable rule.
- Validate the JSON shape, format/schema version, requested ID, checksum, compatibility, and supported component features before use.
- Apply bounded response size, timeout, redirect revalidation, and safe URL rules.
- Cache results with an explicit version/freshness strategy. A production build should not silently change after a remote theme revision unless its configured update policy allows it.
- Remote content can declare schema templates, event rules, and registered adapter IDs, never inline JavaScript, JSX, arbitrary imports, or executable source.

All artifacts should be reproducible and incrementally cached. Theme changes and theme-compiler changes should invalidate the right artifacts without needlessly rebuilding unrelated schema output. Choose a safe deterministic filename and handle collisions. Decide whether generated artifacts are ignored build output, deployment artifacts, or copied by a publishing step.

Repository architecture note: gen3BuildCompiler.js is the Gen 3 source-discovery/schema-worker coordinator and gen3SchemaCache.js owns persistent schema-output caching. nencPlugin.js currently handles command manifests and generated command/favicon routes. Inspect call graphs before choosing the final integration point; prefer a focused theme-compiler module over overloading a command-specific module.

## 4. Theme resolution and type compatibility

Define shared tokens such as semantic colors, font stacks, spacing, borders/radii, and component surfaces. Define component-specific configuration for Markdown and later other Engine components.

Resolution needs deterministic inheritance and override rules, missing-ID errors, duplicate handling, cycle detection, and schema/version validation. Keep the existing vars/fonts/globalStyles behavior functional while ID resolution is introduced.

Relevant existing integration points:

- src/engine/schema/types.ts defines EngineTheme, PageSchema.theme, MarkdownProps, and EngineMarkdown style slots.
- src/engine/createPage.tsx currently emits vars as root CSS variables and handles fonts/globalStyles.
- src/engine/index.ts is the public export barrel.
- src/engine/core/validateSchema.ts is the schema validation path.

## 5. Pretty-please highlighting

Pretty-please should support automatic mode plus explicit provider/language choices. Its available-options list must reflect providers and grammars actually registered in the project.

Requirements:

- A provider/adapter registry supports the built-in option and user-selected compatible providers.
- Evaluate Shiki for the VS Code-like preset, but confirm language loading, bundle impact, and server rendering before adding it as a dependency.
- Normalize language aliases; unsupported language/provider combinations fall back to readable plain text.
- Keep the code-block layout/theme separate from the syntax-highlighting provider/theme.
- A custom palette applies to a selected language/profile and replaces that provider's syntax colors completely. Missing token categories use defined base foreground/background values, not arbitrary provider-default colors.
- Validate and normalize agreed HEX and RGB/sRGB forms.
- Node.js is normally a runtime/profile using JavaScript grammar, not automatically a separate grammar.
- Keep normal syntax highlighting on the Gen 3 server-first path where possible; do not pull a large highlighter bundle into browser routes just to color static code.
- Preserve direct EngineMarkdown compatibility and the existing ANSI path. ANSI fences must continue through parseEngineAnsi, not through a source-language highlighter.
- Preserve whitespace, safe Markdown rendering, language labels, and raw-HTML safety.

Existing files: src/engine/components/EngineMarkdownRenderer.tsx currently special-cases language-ansi while other fenced languages remain plain code; src/engine/core/markdownParser.ts contains ANSI parsing; src/engine/compiler/EngineServerRenderer.tsx is the Gen 3 server-first Markdown integration point.

## 6. UI templates and event-driven Data-API

Theme UI-code must control how a building block is composed and behaves, not just its CSS. Start with named templates/slots for code blocks, table header/body cells, and information blocks (title, icon, content, optional footer/actions).

Templates must describe layout placement (left/right/top/bottom), alignment, spacing, order, wrapping and responsive behavior. Placement and merge rules are separate: a part may append to content, replace a named slot, wrap existing content, or use another explicitly supported composition rule.

Portable Engine Schema is the preferred declarative format. Trusted native React/Next.js code is supported only through explicitly registered project-local adapters. Remote .etr data can reference such adapters by ID but cannot include their source.

The Data-API is a small event-driven dispatch/allocation API:

- Receives a defined event type plus component/slot/context.
- Allocates or dispatches the event to the selected configured behavior/handler.
- Supports composition events such as a table-header part joining from the left, right, top, or bottom; finalize exact event names and semantics before coding.
- Passes enough context for the handler to deal with existing content and the requested composition.
- Routes to a validated Engine Schema behavior or an explicitly registered trusted local React/Next.js handler.
- Defines deterministic missing-handler, unsupported-event, and error behavior.

Do not implement Data-API as inspect/preview/explain/compare tooling. Those operations came from a misunderstanding of the requirement.

EngineMarkdown currently documents CommonMark/GFM, blockquotes, and tables but has no documented dedicated information-block syntax. Decide the authoring syntax for information blocks alongside the template contract.

## 7. Font and static-asset pipeline

Development must keep using the declared font stylesheet/link (including providers such as Google Fonts); the Engine build pipeline must not download font files in dev mode.

During production compilation:

- Resolve the requested font families, weights, and styles to actual font files.
- Download permitted files, cache them, emit them as local production assets, and rewrite generated CSS URLs.
- Use valid cached files without downloading again.
- Key cache entries by canonical source plus relevant font metadata and content SHA-256, not filename alone.
- Use atomic writes and define explicit refresh behavior.
- If a source is unavailable, reuse a valid cache where allowed or emit the documented warning/error.
- Prefer WOFF2/WOFF for web output and document whether TTF is accepted.

Use an Engine-owned cache below .nextjs-engine/.cache/gen3/; select the exact subdirectory after inspecting the build flow. Keep cache metadata separate from emitted build assets. Remote font and ETR fetches need HTTP(S) rules, redirect checks, timeouts, response-size/content-type limits, and protection against localhost/private-network access and arbitrary filesystem writes.

Inspect scripts/gen3-prepare-production.js and the existing production-build hooks before choosing where font work belongs. Do not introduce downloads into runtime rendering or dev-server requests.

## 8. Repository impact map

| Path | Planned role |
|---|---|
| src/engine/schema/types.ts | New typed theme-group, scope, ID reference, variant, template, event, palette and font contracts; retain old props. |
| src/engine/index.ts | Publicly export createTheme and its public types. |
| src/engine/createPage.tsx | Resolve theme IDs and keep legacy inline theme behavior. |
| src/engine/core/validateSchema.ts | Validate declarative theme references and structures. |
| src/engine/components/EngineMarkdownRenderer.tsx | Highlighting, palette application, layout/templates, table and information-block rendering. |
| src/engine/compiler/EngineServerRenderer.tsx | Integrate theme-driven Markdown into server-first output without unnecessary client hydration. |
| src/engine/core/markdownParser.ts | Preserve ANSI; add only language/color normalization that belongs here. |
| src/engine/compiler/EngineCompiler.ts | Check whether theme references/assets must be represented in compiler graph or dependencies. |
| src/engine/plugins/gen3BuildCompiler.js | Coordinate theme discovery/build and ETR generation or invoke a focused theme compiler. |
| src/engine/plugins/gen3SchemaCache.js | Include theme inputs in the correct cache fingerprints/invalidation paths if applicable. |
| src/engine/plugins/nencPlugin.js | Review integration boundary; retain command-manifest responsibility. |
| scripts/gen3-prepare-production.js | Review production asset integration for font compilation. |
| app/engine-markdown-test/page.tsx | Extend demo with theme IDs, highlighting, palettes, templates and information blocks. |
| tests/browser/engine-markdown.spec.ts | Add browser regressions without removing current ANSI/safety assertions. |
| docs/engine-components/enginemarkdown.md | Document public Markdown/theme/highlighting contracts. |
| docs/gen3/build-compiler.md | Document artifact generation, caching and font-build behavior. |
| package.json and existing lockfile, if present | Add only a justified highlighter dependency and focused smoke-test command after evaluation. |
| .gitignore | Decide explicitly how generated .etr artifacts are tracked or published; currently .nextjs-engine/.cache/ is ignored, not the whole theme output directory. |

Proposed new area: src/engine/theme/ for public construction/types, ID resolution, ETR serialization/validation, event dispatch, provider registry, and font cache helpers. Split files only where each has a clear responsibility. A dedicated Gen 3 theme compiler is preferred if it keeps the existing build coordinator manageable.

## 9. Implementation phases

### Phase 0 — Lock API contracts (no production implementation)

Finalize variant declaration syntax, ID grammar/depth cap, scope semantics, inheritance/override precedence, remote ID-to-URL mapping, .etr JSON/hash/version policy, Data-API event names/payload/results, adapter registration, info-block syntax, highlighter/palette fallback semantics, and font source/failure/cache rules.

### Phase 1 — Public theme model and backward compatibility

Add createTheme and public types, ID validation/resolution, scoped registries and subtheme inheritance. Support ID-only schema references without breaking inline EngineTheme. Add targeted tests for IDs, depth limit, conflicts, missing references, inheritance, and legacy behavior.

### Phase 2 — ETR compiler and remote resolver

Implement deterministic JSON serialization and SHA-256 validation. Integrate generation at .nextjs-engine/gen3/theme/<theme_name>.etr, add cache fingerprints/invalidation, resolve user-hosted remote ETR files safely, and add smoke tests in an isolated temporary project.

### Phase 3 — Pretty-please

Add provider/language discovery, automatic and explicit selection, aliases/fallback, a VS Code-like preset, language-specific authoritative palettes, and HEX/RGB/sRGB validation. Preserve ANSI output and Gen 3 server-first rendering. Verify bundle cost before accepting dependencies.

### Phase 4 — Templates and Data-API

Add declarative templates for code blocks, table cells, and information blocks. Implement placement independently from merge behavior; add typed event dispatch and trusted local adapter registration. Reject arbitrary code in remote data and test all supported join directions plus missing-handler behavior.

### Phase 5 — Production fonts

Keep dev links unchanged. Resolve/download permitted fonts during production build, emit local assets, rewrite CSS URLs, and cache by source plus content identity. Test cache hits, changed sources, corrupt cache, remote failures, URL safety and size/type restrictions.

### Phase 6 — Docs, demos, and regression verification

Update EngineMarkdown and Gen 3 compiler docs, extend the demo route, add focused theme/ETR/font smoke coverage, expand Playwright regressions, verify package exports, and review the complete diff for generated/cache files or unrelated changes.

## 10. Acceptance criteria

1. createTheme is exported, typed and side-effect-free with respect to network, publication and font downloads.
2. Existing inline EngineTheme and EngineMarkdown props still work.
3. Qualified component/subtheme references resolve; more than three subtheme segments fail validation.
4. NENC emits deterministic JSON .etr artifacts at the requested path for compiled groups.
5. The ETR contains group/component content, Next.js/Engine/schema version metadata, and a verified canonical SHA-256.
6. Local/global/remote have documented distinct behavior; remote hosting remains user-controlled.
7. Invalid, corrupted, incompatible, oversized or unsafe remote files are rejected; remote data never executes code or arbitrary imports.
8. Pretty-please supports auto/provider choice, discoverable languages, fallback and a VS Code-like preset.
9. Custom language palettes fully replace provider syntax colors and agreed HEX/RGB/sRGB values validate.
10. ANSI handling remains intact.
11. Templates define both appearance and composition; Data-API event dispatch matches its agreed contract and is not preview/inspection tooling.
12. Native React/Next components run only through trusted local adapter registration.
13. Dev does not download font files; production emits local font assets and reuses valid cache entries.
14. Type-check, build, focused smoke tests, and browser regressions pass; skipped checks are reported honestly.

## 11. Verification plan

Package scripts currently include npm run type-check, npm run build, and npm run test:browser. The build runs production preparation, type-check, and Next.js build. A focused Playwright run can target tests/browser/engine-markdown.spec.ts if supported by the installed CLI/config.

Existing smoke-test conventions include scripts/gen3-build-compiler-smoke.js and scripts/gen3-nenc-plugin-smoke.js. Reuse that style rather than adding a new test framework by default. Add theme smoke coverage for ID grammar, stable artifact/checksum output, cache invalidation, remote validation/no execution, palette replacement, ANSI compatibility, event dispatch, and font cache-hit/no-download behavior.

Run browser regressions on Chromium, Firefox, and WebKit wherever the repository's Playwright configuration enables them.

## 12. Decisions to leave open until confirmed

- Exact variant declaration syntax under markdown.
- Remote URL mapping strategy and cache freshness/pinning.
- Final .etr schema, compatibility policy, and whether publisher signatures are required.
- Data-API event names, payload/result contract, and adapter registration API.
- Exact information-block authoring syntax.
- Cross-provider token mapping and palette fallback for omitted token categories.
- Allowed font origins, required/optional failure behavior, and offline-build policy.
- Generated .etr ignore/publish workflow.

## 13. Current status

Implementation is underway on branch feat/enginetheme-foundation.

### Implemented in the current foundation slice
- Public createTheme() and qualified theme-ID parsing, including the three-subtheme-segment limit.
- JSON-only theme validation, bounded nesting and size, deep freezing, and in-process global registration.
- Runtime resolution for direct local theme objects and registered global group/component/subtheme IDs. Markdown defaults and style slots merge with explicit node props taking precedence.
- Static NENC extraction into deterministic JSON .etr artifacts with canonical SHA-256, bounded input, guarded output paths, no-overwrite checks, and no-rewrite behavior for unchanged outputs.
- Pretty-please lightweight syntax highlighting with language aliases, provider registration/listing, built-in VS Code-inspired palettes, plain-text fallback, bounded tokenization, and the existing ANSI path preserved.
- Event-driven Data-API dispatch for join:left/right/top/bottom using registered local handlers. Context is validated as bounded JSON data and copied/frozen before handlers receive it.
- Updated demo/browser regressions and focused compiler/runtime smoke coverage.
- Generated .etr output is ignored as build output by default; publication is separate.

### Verification
- Engine runtime CI passed on commit 61b12759674eedec00e1e71e06a89252958edeaa, including type-check, NENC smoke suites, production build, and its browser tests.
- Dedicated Chromium, Firefox, and WebKit compatibility jobs passed on that same tested commit.
- A follow-up safety/documentation commit is staged and will need a new CI run before its result can be claimed.

### Still pending
- Declarative UI-template rendering and integration with table headers/body cells, code blocks, and information blocks.
- Remote .etr URL mapping, safe retrieval/caching, checksum validation and compatibility checks at resolution time.
- Production font resolution/download, emitted local assets, CSS URL rewriting, and persistent font cache.
- Final versioning/refresh rules and complete public docs/migration guidance.

Remote fetching and production font downloading remain disabled until URL trust policy and cache behavior are implemented and covered by tests. The full plan is not complete while those phases remain open.
