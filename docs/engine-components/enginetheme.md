# EngineTheme

**Status: foundation implemented; template rendering, remote resolution, and production font handling remain pending.**

EngineTheme is the data-only theming layer for Next.js Engine. The current foundation provides a validated createTheme() API, qualified theme IDs, local/global theme resolution for Markdown, static NENC .etr generation, lightweight Pretty-please highlighting, and a typed event-driven Data-API.

## Define a theme group

~~~ts
import { createTheme } from "nextjs-engine";

export const darkFantasy = createTheme({
  id: "dark-fantasy",
  scope: "global",
  name: "Dark Fantasy",
  tokens: {
    colors: {
      surface: "#18181B",
      text: "#F4F4F5"
    }
  },
  markdown: {
    defaults: {
      codeBackground: "#241b38",
      codeColor: "#f5efff"
    },
    styles: {
      codeBlock: {
        borderColor: "#826f9b"
      }
    },
    variants: {
      dark: {
        defaults: {
          codeBackground: "#241b38"
        }
      }
    }
  }
});
~~~

The root ID names a theme group and must be one safe segment. Component configuration is placed underneath a namespace such as markdown; shared tokens can live under tokens.

createTheme() validates the definition as JSON data, clones and deeply freezes it, and never performs network requests, publishes a theme, downloads fonts, or evaluates theme content. Functions, accessors, cycles, symbols, non-finite numbers, reserved keys, excessive nesting, and oversized definitions are rejected.

## Theme IDs

A schema can refer to a component theme or variant by ID:

~~~ts
{
  theme: {
    id: "dark-fantasy.markdown.dark"
  },
  root: {
    type: "markdown",
    props: { content: "# Welcome" }
  }
}
~~~

The grammar is:

- dark-fantasy — group ID
- dark-fantasy.markdown — component theme
- dark-fantasy.markdown.dark — component variant
- dark-fantasy.markdown.1.2.560 — three nested subtheme segments

The limit is three subtheme segments after the component segment. Variants inherit from the prior definition; the resolver merges nested Markdown style slots and defaults. Explicit per-node Markdown props take precedence, and local markdownStyles properties override matching theme style properties.

Local themes can be supplied directly as a theme object. Global themes are registered in-process and can be referenced by ID. Missing global groups or variants produce an error. Remote scope is not fetched or resolved yet; a reference marked remote or carrying sourceUrl fails closed instead of performing an implicit network request.

## Generation 3 .etr artifacts

NENC extracts statically resolvable createTheme({...}) calls during its Gen 3 source pass and writes:

~~~text
.nextjs-engine/gen3/theme/<theme-id>.etr
~~~

The artifact is UTF-8 JSON containing a format/version identifier, group ID, generator metadata, the Next.js and Engine versions used to create it, the definition in content, and a SHA-256 digest of canonical JSON excluding the digest field itself.

The static compiler resolves literal values and local constants. It rejects dynamic calls, spreads, functions, accessors, computed keys, and unsupported expressions instead of executing them to discover a theme definition. Group IDs are validated before they become filenames. Output writes are atomic, unchanged artifacts are not rewritten, symlinked output paths are rejected, and unrelated files are not overwritten. A manifest under the ignored .nextjs-engine/.cache/ directory records generated artifacts.

Generated .etr output is ignored build output by default. Publishing a remote theme means copying or serving the generated JSON through the owner's endpoint; generating an artifact does not publish it automatically.

## Pretty-please highlighting

EngineMarkdown supports prettyPlease configuration in a theme or as a local Markdown prop:

~~~ts
prettyPlease: {
  mode: "auto",
  provider: "engine-lite",
  theme: "vscode-dark",
  palette: {
    foreground: "#f5efff",
    keyword: "#ff85c0",
    string: "#b6f09c",
    comment: "#9a91b8"
  }
}
~~~

The built-in engine-lite tokenizer is intentionally lightweight and bounded for low-memory devices. It offers VS Code-inspired colors for common languages and falls back to plain text for unknown or unsupported syntax. It is not a full TextMate/VS Code grammar engine; projects can register a compatible trusted local provider.

The public provider/list APIs are:
- registerEngineHighlighterProvider()
- listEngineHighlighterProviders()
- listEngineHighlighterLanguages()
- listEngineHighlighterThemes()

Aliases include ts/typescript and nodejs/javascript. The current built-in palettes are vscode-dark and vscode-light.

Custom palettes replace provider token colors authoritatively. If a token category is omitted or invalid, it uses the palette foreground (or the code foreground fallback), never the provider's default color. Supported palette values are HEX, bounded RGB/RGBA, and bounded color(srgb ...) values.

Fences labeled ansi continue through the existing ANSI parser; ANSI is not sent through syntax highlighting. Code is emitted as React text spans, not injected HTML. Code-length and token-count limits trigger plain-text fallback rather than unbounded tokenization.

## Event-driven Data-API

The Data-API dispatches a supported event to a handler registered by trusted project code. It is not a preview or inspection API.

~~~ts
import {
  registerEngineThemeDataHandler,
  dispatchEngineThemeDataEvent
} from "nextjs-engine";

registerEngineThemeDataHandler("docs.table-join", (event) => {
  return {
    operation: "append",
    incoming: event.context.incoming ?? null
  };
});

dispatchEngineThemeDataEvent("join:left", "docs.table-join", {
  themeId: "dark-fantasy.markdown.dark",
  componentId: "markdown",
  slotId: "table.header",
  direction: "left",
  existing: { label: "Name" },
  incoming: { icon: "sort" }
});
~~~

Initial events are join:left, join:right, join:top, and join:bottom. Dispatch validates context as bounded JSON data, clones/freezes it before calling the handler, rejects missing handler IDs, and never imports code based on a theme-provided ID. Handler implementations remain trusted local code.

The UI-template layer that connects these events to actual table/header/code/info-block layout composition is a follow-up phase. This Data-API foundation establishes the event/handler contract; it does not claim that the complete template renderer exists.

## Backwards compatibility and verification

Existing EngineTheme vars, fonts, and globalStyles remain supported. Current EngineMarkdown props/styles and ANSI behavior remain covered by regression tests.

Focused validation commands:

~~~sh
npm run test:theme
npm run type-check
npm run build
npm run test:browser
~~~

Remote .etr retrieval and production font caching are intentionally not enabled yet. Those features need separate URL validation, compatibility policy, build/runtime separation, and cache tests before activation.
