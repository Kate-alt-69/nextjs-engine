# Generation 3 release hardening

This document records compatibility guarantees tightened during the Generation 3 release audit.

## Server-first parity

Server-first compilation is an execution optimization, not a separate visual API. Static/server primitives now use the same deterministic style compiler as the compatibility/client renderer, including responsive properties, CSS passthrough values, nested at-rules, `cprop` states, and primitive style precedence.

Slot fallbacks are compiled as real schema branches so their runtime, assets, capabilities, security diagnostics, and client-island requirements remain part of the page plan.

See [`server-first-parity.md`](./server-first-parity.md) for the detailed contract.

## Artifact cache safety

Generation 3 artifact fingerprints distinguish function object identity. Different closures with identical source text therefore cannot reuse a compiled artifact containing stale closure or request state. Reusing the same function object remains cacheable.

## Next.js image qualities

`EngineImage` uses these built-in quality presets:

| Preset | Quality |
| --- | ---: |
| `performance` | `65` |
| `balanced` | `78` |
| `sharp` | `90` |

When the combined `withEngine()` plugin is used, it preserves application-provided `images.qualities` and adds `65`, `75`, `78`, and `90`. `75` is retained for normal Next.js image compatibility while the other values cover every built-in EngineImage preset.

An application that supplies an explicit custom `quality`, `qualityMobile`, or `qualityDesktop` outside those values should also include that value in its own Next.js `images.qualities` configuration.

## Regression coverage

The main Generation 3 CI verifies server-first parity, artifact-cache function isolation, EngineImage quality configuration, TypeScript validation, the optimized Next.js integration build, production-only bundle/security proofs, and the browser/device matrix.
