# EngineMobile — Mobile & Device

> Server-side schema patching based on User-Agent.
> Client + server device detection for 12+ hardware brands.

---

## EngineMobilePatcher

## EngineMobile — Server-Side Mobile Schema Patching

`EngineMobile` lets you define a mobile layout alongside the desktop schema in the same `page.tsx`. Patches are applied **server-side** inside `createPage()` when the incoming request UA is a mobile or tablet device — the desktop schema object is never mutated.

### How it works

```
Request UA
    │
    ▼
getServerDevice()             ← reads next/headers User-Agent
    │
    ├── isDesktop → renderPage(schema)          ← original schema untouched
    │
    └── isMobile  → applyMobilePatches(schema, mobile)
                        │
                        ▼
                   patchTree()                  ← walks tree, targets named nodes
                        │
                        ▼
                   renderPage(patchedSchema)    ← mobile-specific tree
```

### Naming nodes — `SchemaNode.name`

Add a `name` field to any node you want to target from a mobile patch:

```ts
{
  type: "grid",
  name: "feature-grid",    // ← stable patch target
  props: { columns: 3, gap: "2rem" },
  children: [
    {
      type: "box",
      name: "pricing-hero",
      props: { px: "4rem", py: "6rem" },
    }
  ]
}
```

`name` is an engine-level field — it is not forwarded to the rendered component as a prop.

### `createPage` mobile option

```ts
export default createPage({
  schema: MySchema,
  mobile: [
    // Entry 1 — hide desktop nav, show mobile menu
    {
      "children#desktop-nav": {
        cprop: { hide: true },          // sets display: none on mobile
      },
    },
    {
      "children#mobile-menu": {
        props: { display: "flex" },
      },
    },
    // Entry 2 — completely replace hero props for mobile
    {
      "children#pricing-hero": {
        "remove-all-prop": true,        // wipe ALL desktop props first
        props: { px: "1rem", py: "2rem" },
      },
    },
    // Entry 3 — change grid columns, wipe cprop only
    {
      "children#feature-grid": {
        "remove-all-cprop": true,       // wipe cprop only, keep other props
        props: { columns: 1 },
        cprop: { onHover: { transform: "none" } },
      },
    },
  ],
});
```

### Selector syntax

| Selector | Effect |
|----------|--------|
| `"children#my-node"` | Finds the node with `name: "my-node"` anywhere in the tree |
| `"#my-node"` | Short form — identical effect |

### Top-level directives

These sit at the **top level** of each patch entry — not inside `props` or `cprop`:

| Directive | Description |
|-----------|-------------|
| `"remove-all-prop": true` | Clears ALL existing `props` (including any nested `cprop`) before merging new values |
| `"remove-all-cprop": true` | Clears only `props.cprop` before merging; all other props are kept |

### Mobile-only `cprop.hide`

| Value | Effect |
|-------|--------|
| `cprop: { hide: true }` | Sets `display: "none"` on the node — invisible on mobile, unchanged on desktop |

### Dev warnings

When a selector doesn't match any named node the engine emits a dev-only warning to stderr with a Levenshtein "did you mean?" suggestion:

```
[engine:mobile] Selector "children#pricng-hero" did not match any node.
                Did you mean "children#pricing-hero"?
```

Silent in production (`NODE_ENV === "production"`).

---

---

## EngineDevice

## EngineDevice — Device Detection

```ts
import { getServerDevice, useMobileDevice, detectDevice } from "@/engine";

// Server Component / Route Handler / Server Action:
const device = await getServerDevice();
// → { isMobile: true, isTablet: false, isDesktop: false, os: "android", brand: "samsung", type: "samsung" }

// Client-side React hook (SSR-safe, updates after mount):
function MyComponent() {
  const device = useMobileDevice();
  if (device.isMobile) return <MobileLayout />;
  return <DesktopLayout />;
}

// Anywhere — parse a UA string directly:
const info = detectDevice("Mozilla/5.0 (Linux; Android 14; SM-S928B) ...");
```

**`DeviceInfo` shape:**

| Field | Type | Description |
|-------|------|-------------|
| `isMobile` | `boolean` | Phone-sized device |
| `isTablet` | `boolean` | Tablet |
| `isDesktop` | `boolean` | Desktop/laptop |
| `os` | `DeviceOS` | `"ios" \| "android" \| "windows-phone" \| "desktop" \| "other"` |
| `brand` | `DeviceBrand` | Detected hardware brand |
| `type` | `string` | `"iphone"`, `"samsung"`, `"xiaomi"`, `"android"`, `"desktop"`, etc. |

**Detected brands:**

| Brand | Detection tokens |
|-------|-----------------|
| Apple | `iPhone`, `iPad`, `iPod`, macOS+touch |
| Samsung | `SamsungBrowser`, `SM-`, `GT-`, `Galaxy` |
| Xiaomi | `MIUI`, `Redmi`, `Mi`, `HMNote`, `Poco` |
| Huawei | `Huawei`, `Honor` |
| OnePlus | `OnePlus`, `OPD-`, `LE2` |
| OPPO | `OPPO` |
| Realme | `Realme` |
| Vivo | `Vivo` |
| Motorola | `Motorola`, `Moto` |
| Nokia | `Nokia`, `HMD` |
| Google | `Pixel`, `Nexus` |
| Generic Android | any other Android UA |

---
