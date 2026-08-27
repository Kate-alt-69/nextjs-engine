# EngineOverlay

EngineOverlay adds three first-class interaction primitives to Next.js Engine:

- `dialog` / `EngineDialog` — modal dialogs and confirmation windows;
- `drawer` / `EngineDrawer` — side or edge panels;
- `popover` / `EnginePopover` — anchored floating content.

The three components share one overlay runtime for focus handling, Escape behavior, overlay stacking, scroll locking and popover positioning. They are lazy-loaded through the Engine registry, so pages that do not render overlays do not eagerly load their React modules.

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

The named action is resolved from `createPage({ handlers })`:

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

`side` accepts `left`, `right`, `top` and `bottom`.

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

Popover placement automatically flips to the opposite side when the requested side does not have enough room, then clamps the panel inside the viewport.

## Direct React use

All three components are also public React exports:

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

## Open state

Use `defaultOpen` for uncontrolled state:

```tsx
<EngineDialog defaultOpen triggerLabel="Open" />
```

Use `open` and `onOpenChange` for controlled state:

```tsx
<EngineDialog
	open={open}
	onOpenChange={setOpen}
	triggerLabel="Open"
/>
```

In schema, `onOpenChange` can be a named Engine handler:

```ts
{
	type: "drawer",
	props: {
		open: true,
		onOpenChange: "drawerChanged",
	},
}
```

## Actions

Dialogs and drawers commonly use `actions`, but actions work on all three overlay types.

```ts
props: {
	actions: [
		{ label: "Later", variant: "ghost" },
		{ label: "Save", variant: "primary", onClick: "save" },
		{ label: "Delete", variant: "danger", onClick: "remove" },
	],
}
```

Action variants are `primary`, `secondary`, `danger` and `ghost`.

Actions close the overlay after running by default. Set `close: false` when an action should keep the overlay open:

```ts
{
	label: "Apply",
	onClick: "applySettings",
	close: false,
}
```

## Dialog options

Important dialog props:

| Prop | Default | Meaning |
|---|---|---|
| `closeOnEscape` | `true` | Escape closes the top overlay |
| `closeOnBackdrop` | `true` | clicking the backdrop closes |
| `lockScroll` | `true` | locks document body scrolling |
| `trapFocus` | `true` | Tab stays inside the dialog |
| `restoreFocus` | `true` | returns focus to the trigger |
| `showCloseButton` | `true` | shows the × close control |
| `role` | `dialog` | `dialog` or `alertdialog` |
| `duration` | `180` | transition duration in ms |

## Drawer options

Drawer adds:

```text
side: left | right | top | bottom
size: CSS size or number
```

Example mobile sheet:

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

This is why a separate `sheet` primitive is not necessary: a bottom Drawer is the same interaction model.

## Popover options

Popover adds:

| Prop | Default | Meaning |
|---|---|---|
| `placement` | `bottom` | preferred side |
| `align` | `center` | `start`, `center`, `end` |
| `offset` | `8` | trigger-to-panel distance |
| `viewportPadding` | `8` | minimum viewport edge gap |
| `closeOnOutsideClick` | `true` | outside pointer press closes |
| `matchTriggerWidth` | `false` | panel min-width follows trigger |
| `autoFocus` | `false` | focus first panel control |
| `trapFocus` | `false` | keep Tab inside the popover |
| `role` | `dialog` | `dialog`, `menu`, or `listbox` |

The runtime repositions open popovers on viewport resize, page/container scrolling and trigger/panel ResizeObserver changes. Repeated events are coalesced through `requestAnimationFrame`.

## Initial focus

`initialFocus` is a selector searched inside the panel:

```tsx
<EngineDialog
	triggerLabel="Edit"
	initialFocus="#project-name"
>
	<input id="project-name" />
</EngineDialog>
```

If the selector does not match, EngineOverlay focuses the first focusable control, then the panel itself as a final fallback.

## Nested overlays

The runtime keeps an overlay stack. Escape and outside-click behavior only act on the top overlay. This prevents a Popover inside a Dialog from closing the Dialog first.

Body scroll locking is reference-counted, so closing one modal overlay does not unlock the page while another scroll-locking overlay is still open.

## Styling

Normal Engine props such as `style`, `className`, `bg`, `border`, `borderRadius`, spacing and size props can style the panel.

Shared CSS variables:

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

Use `overlayStyle` on Dialog/Drawer to style the backdrop. `triggerStyle` and `triggerClassName` style the generated trigger button.

## Portals

Overlays portal to `document.body` by default, avoiding clipping from parent `overflow`, transforms and stacking contexts.

To portal into a specific element:

```tsx
<EngineDialog portalTargetId="app-overlay-root" />
```

If the requested target does not exist, EngineOverlay safely falls back to `document.body`.

## Accessibility behavior

EngineDialog and EngineDrawer use modal dialog semantics, focus trapping and focus restoration by default. Titles and descriptions automatically wire `aria-labelledby` and `aria-describedby`. When no visible title exists, `ariaLabel` or the trigger label is used.

Popover is non-modal by default because menus/tooltips/options normally should not lock the rest of the page. Turn on `autoFocus` or `trapFocus` only when the popover behaves like an interactive mini-dialog.

`prefers-reduced-motion: reduce` changes overlay transition duration to zero.

## Composition instead of extra primitive types

Several common UI patterns should be compositions, not new Engine node types:

```text
Command palette = Dialog + Input + list
Context menu    = Popover + menu items
Dropdown menu   = Popover + stack/buttons
Mobile sheet    = Drawer(side="bottom")
Inspector panel = Drawer
Confirm prompt  = Dialog + actions
```

This keeps the Engine primitive set small while making higher-level UI patterns easy to build.

## Performance notes

- Overlay component modules are code-split by the registry.
- Closed overlays do not keep portal DOM mounted.
- Dialog/Drawer scroll locking uses one shared reference-counted runtime.
- Popover resize/scroll positioning is RAF-coalesced.
- ResizeObserver is only attached while a Popover is present.
- no animation loop runs while an overlay is idle.

## Low-level positioning API

Advanced callers can use the same positioning helper:

```ts
import { computePopoverPosition } from "nextjs-engine";
```

It accepts trigger/panel rectangles plus viewport size, placement, alignment, offset and viewport padding, and returns `{ top, left, placement }`.
