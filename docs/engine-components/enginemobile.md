# EngineMobile + EngineDevice

EngineMobile applies optional schema patches on the server based on the request
User-Agent. Device detection is split into pure/shared, client, and server
modules so `next/headers` does not leak into the browser module graph.

## Server-side mobile patches

```ts
export default createPage({
	schema: MySchema,
	mobile: [
		{
			"children#desktop-nav": {
				cprop: { hide: true },
			},
		},
		{
			"children#feature-grid": {
				props: { columns: 1 },
			},
		},
	],
});
```

`createPage()` only imports the request-aware device helper when a non-empty
`mobile` patch list exists. Pages without mobile patches do not need the
`next/headers` device path.

The desktop schema is not mutated. On phone/tablet requests the patcher creates
the mobile-specific schema and renders that result.

## Naming nodes

Use `SchemaNode.name` as a stable patch target:

```ts
{
	type: "grid",
	name: "feature-grid",
	props: { columns: 3 },
}
```

Selectors:

| Selector | Meaning |
|---|---|
| `"children#feature-grid"` | Find named nodes anywhere in the tree |
| `"#feature-grid"` | Short form |

Whitespace around selectors is ignored.

Patch directives:

| Directive | Meaning |
|---|---|
| `"remove-all-prop": true` | Clear existing props before applying replacements |
| `"remove-all-cprop": true` | Clear only `props.cprop` before merging |

### Repeated patches compose in array order

When the same named node appears more than once in `mobile`, each patch is
applied to the result of the previous patch. Later entries override only the
values they actually specify rather than replacing the earlier directive object.

```ts
mobile: [
	{
		"#feature-grid": {
			props: { columns: 2, gap: "1rem" },
		},
	},
	{
		"#feature-grid": {
			props: { columns: 1 },
			cprop: { onHover: { opacity: 0.9 } },
		},
	},
]
```

The final node keeps `gap: "1rem"`, receives `columns: 1`, and gets the hover
style. `patch.props.cprop` and `patch.cprop` also merge against the same current
cprop value, so combining the two forms does not restore stale pre-patch state.

Unmatched selectors produce development-only warnings with a close-name
suggestion where possible. When named nodes exist but none are close enough, the
warning says that no close match was found rather than claiming the schema has no
named nodes.

Names are not required to be globally unique, but a selector is intentionally
applied to **every** node with that name. `analyzeSchema()` emits W007 when it
finds a duplicate name so accidental multi-target patches are visible before
runtime. Use unique names when a patch is supposed to affect one node only.

## Patch performance

Mobile patching uses structural sharing. The patcher still walks the tree to find
matching named nodes, but it clones only nodes that are directly patched or are
ancestors of a changed node. Untouched branches keep their original node and
children-array references instead of being deep-cloned for every mobile request.

The development-only typo matcher uses two rolling Levenshtein rows rather than
a full distance matrix, keeping suggestion allocations small even in schemas with
many named nodes.

## Device imports

### Shared / browser-safe

```ts
import { detectDevice, useMobileDevice } from "nextjs-engine";
```

`detectDevice(ua)` is a pure parser. `useMobileDevice()` is the client React
hook and starts with desktop-safe SSR defaults until mount.

### Request-aware server helper

Package consumers import request-aware helpers from the dedicated server-only
subpath:

```ts
import { getServerDevice } from "nextjs-engine/server";

const device = await getServerDevice();
```

`nextjs-engine/server` is an explicit package export that maps to
`engine/server.ts`; it is not an undocumented deep import. The server entry also
exports `detectDevice`, `DESKTOP_DEVICE`, and the device information types.

The `main-empty` package-sync workflow validates both the `./server` export map
and the presence of `engine/server.ts`, so a future source/package drift fails CI
instead of silently publishing a broken documented import.

When working directly inside this repository source instead of through the
published package, the equivalent implementation is
`src/engine/core/EngineDeviceServer.ts`.

## DeviceInfo

```ts
interface DeviceInfo {
	isMobile: boolean;
	isTablet: boolean;
	isDesktop: boolean;
	os: "ios" | "android" | "windows-phone" | "desktop" | "other";
	brand: DeviceBrand;
	type: string;
}
```

Detected Android brands include Samsung, Xiaomi/Poco, Huawei/Honor, OnePlus,
OPPO, Realme, Vivo, Google Pixel/Nexus, Motorola, and Nokia/HMD. Apple iPhone,
iPod, and iPad detection is handled separately.

UA detection is a layout hint, not a security boundary. Do not use the detected
brand/type as authentication or authorization evidence.
