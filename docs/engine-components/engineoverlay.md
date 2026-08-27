# EngineOverlay

> **Status:** first-class Overlay UI is implemented and available through both schema nodes and direct React exports.
>
> **Built-ins:** `dialog`, `drawer`, `popover`
>
> **React exports:** `EngineDialog`, `EngineDrawer`, `EnginePopover`

EngineOverlay is Next.js Engine's shared interaction layer for UI that visually sits above the normal document flow. It provides modal dialogs, edge drawers and anchored popovers without requiring every page to rebuild focus handling, portals, Escape behavior, stacking and positioning by hand.

The three primitives share one runtime, but each keeps a different interaction model:

| Primitive | Best for | Modal by default | Anchored |
|---|---|---:|---:|
| `dialog` | confirms, editors, prompts, command surfaces | yes | no |
| `drawer` | settings, inspectors, filters, mobile sheets | yes | screen edge |
| `popover` | menus, options, small contextual panels | no | yes |

The overlay components are lazy-loaded through the Engine registry. A page that never renders an overlay does not eagerly load the Overlay React component modules.

---

## Mental model

```text
Schema / JSX
	↓
EngineDialog / EngineDrawer / EnginePopover
	↓
shared EngineOverlay runtime
	├── overlay stack
	├── Escape ownership
	├── focus discovery / focus trap
	├── focus restoration
	├── body scroll locking
	└── popover collision positioning
	↓
React portal
	↓
document.body or portalTargetId
```

This makes Overlay UI a primitive system. Higher-level patterns such as command palettes and context menus should normally be compositions built from these primitives rather than additional Engine node types.

---

## Quick start

### Dialog

```ts
{
	type: "dialog",
	props: {
		triggerLabel: "Delete project",
		title: "Delete project?",
		description: "This cannot be undone.",
		actions: [
			{ label: "Cancel" },
			{
				label: "Delete",
				variant: "danger",
				onClick: "deleteProject",
			},
		],
	},
}
```

Named actions resolve through `createPage({ handlers })`:

```ts
export default createPage({
	schema,
	handlers: {
		deleteProject: () => {
			console.log("delete");
		},
	},
});
```

### Drawer

```ts
{
	type: "drawer",
	props: {
		triggerLabel: "Settings",
		title: "Project settings",
		side: "right",
		size: "26rem",
	},
	children: [
		{ type: "text", props: { content: "Settings content" } },
	],
}
```

### Popover

```ts
{
	type: "popover",
	props: {
		triggerLabel: "Options",
		placement: "bottom",
		align: "start",
		offset: 8,
	},
	children: [
		{ type: "text", props: { content: "Profile" } },
		{ type: "text", props: { content: "Settings" } },
	],
}
```

Popover positioning automatically tries the preferred side, flips to the opposite side when that side has more usable room, then clamps the panel inside the viewport.

---

## Direct React use

```tsx
"use client";

import { EngineDialog, EngineDrawer, EnginePopover } from "nextjs-engine";

export function OverlayExamples() {
	return (
		<>
			<EngineDialog triggerLabel="Open dialog" title="Hello">
				Dialog content
			</EngineDialog>

			<EngineDrawer triggerLabel="Open drawer" side="left">
				Drawer content
			</EngineDrawer>

			<EnginePopover triggerLabel="Open popover" placement="top">
				Popover content
			</EnginePopover>
		</>
	);
}
```

All three also accept normal Engine styling props through `BaseNodeProps`.

---

## Shared props

These props are shared by Dialog, Drawer and Popover unless noted otherwise.

| Prop | Type | Default / behavior |
|---|---|---|
| `open` | `boolean` | controlled open state |
| `defaultOpen` | `boolean` | `false` |
| `onOpenChange` | handler name or function | called with the new boolean state |
| `trigger` | `ReactNode` | custom trigger content |
| `triggerLabel` | `string` | generated trigger text |
| `triggerClassName` | `string` | class for generated trigger button |
| `triggerStyle` | `CSSProperties` | style for generated trigger button |
| `triggerDisabled` | `boolean` | disables generated trigger |
| `triggerAriaLabel` | `string` | accessible trigger label |
| `title` | `ReactNode` | visible heading + ARIA label source |
| `description` | `ReactNode` | visible description + ARIA description source |
| `actions` | `EngineOverlayAction[]` | footer actions |
| `showCloseButton` | `boolean` | Dialog/Drawer `true`, Popover `false` |
| `closeLabel` | `string` | accessible close-button label |
| `closeOnEscape` | `boolean` | `true` |
| `restoreFocus` | `boolean` | `true` |
| `initialFocus` | `string` | selector searched inside the panel |
| `duration` | `number` | transition ms, clamped to `0..1200` |
| `portalTargetId` | `string` | portal element id; falls back to `document.body` |
| `ariaLabel` | `string` | fallback label when there is no visible title |
| `style` | Engine style | styles the panel |
| `className` | `string` | panel class |
| `cprop` | Engine CPROP | state styling for the panel |
| `zIndex` | `number` | Dialog/Drawer `1000`, Popover `1100` by default |

If both `trigger` and `triggerLabel` are missing, no generated trigger button is rendered. That is useful when the overlay is controlled by external application state.

---

## Controlled and uncontrolled state

Use `defaultOpen` when EngineOverlay should own the state:

```tsx
<EngineDialog
	defaultOpen
	triggerLabel="Open"
	title="Welcome"
/>
```

Use `open` + `onOpenChange` when the application owns the state:

```tsx
<EngineDialog
	open={open}
	onOpenChange={setOpen}
	triggerLabel="Open"
/>
```

Schema can point `onOpenChange` at a named Engine handler:

```ts
{
	type: "drawer",
	props: {
		open: drawerOpen,
		onOpenChange: "drawerChanged",
	},
}
```

The named handler receives the new boolean value.

---

## Actions

```ts
props: {
	actions: [
		{ label: "Later", variant: "ghost" },
		{ label: "Save", variant: "primary", onClick: "save" },
		{ label: "Delete", variant: "danger", onClick: "remove" },
	],
}
```

Action variants:

```text
primary
secondary
danger
ghost
```

An action closes the overlay after running unless `close: false` is set:

```ts
{
	label: "Apply",
	onClick: "applySettings",
	close: false,
}
```

Use `disabled: true` to disable an action.

---

## Dialog

Dialog is the default primitive for modal interaction.

| Prop | Default | Meaning |
|---|---|---|
| `role` | `dialog` | `dialog` or `alertdialog` |
| `closeOnBackdrop` | `true` | backdrop press closes |
| `lockScroll` | `true` | locks document scrolling while open |
| `trapFocus` | `true` | Tab stays inside the panel |
| `duration` | `180` | animation duration in ms |

Use `alertdialog` for a decision that needs immediate user attention:

```ts
{
	type: "dialog",
	props: {
		role: "alertdialog",
		triggerLabel: "Remove account",
		title: "Remove this account?",
		description: "This action cannot be undone.",
	},
}
```

---

## Drawer

Drawer uses the same modal behavior as Dialog but enters from a screen edge.

| Prop | Default | Meaning |
|---|---|---|
| `side` | `right` | `left`, `right`, `top`, `bottom` |
| `size` | `min(26rem, 92vw)` | drawer width/height depending on side |
| `closeOnBackdrop` | `true` | backdrop press closes |
| `lockScroll` | `true` | locks document scrolling |
| `trapFocus` | `true` | keeps focus inside |
| `duration` | `220` | animation duration in ms |

A mobile sheet is simply a bottom Drawer:

```ts
{
	type: "drawer",
	props: {
		triggerLabel: "Filters",
		title: "Filters",
		side: "bottom",
		size: "70vh",
	},
}
```

There is intentionally no separate `sheet` primitive because it would duplicate Drawer behavior.

---

## Popover

Popover is anchored to its generated trigger and is non-modal by default.

| Prop | Default | Meaning |
|---|---|---|
| `placement` | `bottom` | `top`, `right`, `bottom`, `left` |
| `align` | `center` | `start`, `center`, `end` |
| `offset` | `8` | trigger-to-panel distance |
| `viewportPadding` | `8` | minimum viewport edge gap |
| `closeOnOutsideClick` | `true` | outside pointer closes the top popover |
| `matchTriggerWidth` | `false` | panel min-width follows trigger width |
| `autoFocus` | `false` | focuses the first panel control |
| `trapFocus` | `false` | keeps Tab inside the popover |
| `role` | `dialog` | `dialog`, `menu`, `listbox` |
| `duration` | `140` | animation duration in ms |

The open Popover repositions when:

- the viewport resizes;
- the page or a scroll container scrolls;
- the trigger changes size;
- the panel changes size.

Resize/scroll updates are coalesced through `requestAnimationFrame`, and `ResizeObserver` exists only while the Popover is present.

---

## Focus behavior

`initialFocus` accepts a CSS selector searched inside the panel:

```tsx
<EngineDialog
	triggerLabel="Edit project"
	title="Edit project"
	initialFocus="#project-name"
>
	<input id="project-name" />
</EngineDialog>
```

Focus selection order is:

```text
initialFocus match
	↓
first focusable descendant
	↓
panel itself
```

When a modal closes, focus returns to its trigger when possible. If the trigger is unavailable, EngineOverlay falls back to the element that was focused before opening.

Dialog and Drawer trap Tab by default. Popover does not, because a normal contextual menu should not automatically behave like a modal dialog.

---

## Overlay stacking

EngineOverlay maintains one shared stack. The latest registered overlay is considered the top overlay for keyboard and contextual outside-click handling.

This allows combinations such as:

```text
Dialog
	└── Popover
		└── contextual controls
```

Escape is handled by the top overlay first. Body scroll locking is reference-counted, so nested modal overlays cannot accidentally unlock document scrolling while another modal still needs the lock.

---

## Portals

Overlay panels portal to `document.body` by default. This prevents a parent element's `overflow`, transform or stacking context from clipping the overlay.

```tsx
<EngineDialog portalTargetId="app-overlay-root" />
```

When the requested target is missing, EngineOverlay safely falls back to `document.body`.

The portal runtime is client-side only; the trigger can still participate in normal SSR/hydration.

---

## Styling

Normal Engine styling props style the panel. Shared visual defaults use CSS variables:

```css
--e-overlay-bg
--e-overlay-color
--e-overlay-border
--e-overlay-shadow
--e-overlay-radius
--e-overlay-muted
--e-overlay-trigger-bg
--e-overlay-trigger-border
--e-overlay-action-bg
```

Example:

```tsx
<EngineDialog
	triggerLabel="Open"
	style={{
		"--e-overlay-bg": "#07111f",
		"--e-overlay-color": "#f8fafc",
		borderRadius: 20,
	} as React.CSSProperties}
/>
```

`triggerStyle` and `triggerClassName` style the generated trigger. `overlayStyle` styles the Dialog/Drawer backdrop.

---

## Reduced motion

When the browser reports:

```css
@media (prefers-reduced-motion: reduce)
```

EngineOverlay resolves its transition duration to zero. Functionality remains unchanged; only the decorative transition is removed.

---

## Composition recipes

Do not create a new core primitive merely because a product pattern has a familiar name. Compose Overlay primitives with existing Engine components:

```text
Command Palette = Dialog + Input + result list
Context Menu    = Popover(role="menu") + menu actions
Dropdown Menu   = Popover + Stack + Buttons
Account Menu    = Popover + links/actions
Mobile Sheet    = Drawer(side="bottom")
Inspector       = Drawer(side="right")
Navigation Rail = Drawer(side="left")
Confirm Prompt  = Dialog + actions
Edit Form       = Dialog + EngineForm
Filter Panel    = Drawer + EngineForm
```

This is the intended Overlay UI architecture: a small number of strong primitives with reusable compositions on top.

---

## Performance

- Overlay React modules are registry split-points.
- Closed overlays do not keep portal DOM mounted after their exit duration.
- No persistent animation loop runs while overlays are idle.
- Dialog/Drawer share one reference-counted body-scroll lock.
- Popover positioning work is RAF-coalesced.
- Popover `ResizeObserver` instances exist only while the panel is present.
- `prefers-reduced-motion` avoids unnecessary animation work.

---

## Low-level API

Advanced callers can use the positioning runtime directly:

```ts
import {
	computePopoverPosition,
	getFocusableElements,
	isTopOverlay,
	lockBodyScroll,
	registerOverlay,
} from "nextjs-engine";
```

`computePopoverPosition()` accepts trigger and panel rectangles plus viewport width/height, preferred placement, alignment, offset and viewport padding. It returns:

```ts
{
	top: number,
	left: number,
	placement: "top" | "right" | "bottom" | "left"
}
```

The other low-level helpers are exported mainly for advanced integrations. Normal application code should prefer `EngineDialog`, `EngineDrawer` and `EnginePopover`.

---

## Troubleshooting

### The overlay has no button

Provide `triggerLabel` or `trigger`. If neither is supplied, EngineOverlay assumes the open state is controlled externally and intentionally renders no generated trigger.

### A Popover opens on another side

That is collision handling. The requested `placement` is a preference, not a promise. If the opposite side has more usable room, the Popover flips automatically.

### Focus does not move to `initialFocus`

`initialFocus` must be a selector matching an element inside the overlay panel. If it does not match, the runtime uses the first focusable element or the panel itself.

### Page scrolling is locked

Dialog and Drawer lock body scrolling by default. Set `lockScroll: false` only when the product interaction genuinely requires the background page to stay scrollable.

### I need a command palette / context menu / sheet

Build it as a composition. Those are product patterns; Dialog, Popover and Drawer are the core interaction primitives.

---

## CI coverage

The repository includes `scripts/engine-overlay-smoke.js`, and the main Engine CI runs it before TypeScript and the full Next.js integration build. The smoke test covers placement, flipping, viewport clamping and overlay-stack registration behavior.

That keeps the shared runtime protected independently from the React rendering layer.
