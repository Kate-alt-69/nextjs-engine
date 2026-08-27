# CustomSelect

Schema type: `"custom-select"`.

`CustomSelect` is the engine's styled, keyboard-navigable select control. It
renders a visual combobox plus a hidden native input so ordinary form submission
and engine form binding continue to receive the selected value.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | required | Hidden-input field name and `data-engine-bind` key |
| `label` | `string` | — | Visible label for the combobox |
| `options` | `SelectOption[]` | required | `{ value, label, disabled? }[]` |
| `placeholder` | `string` | `"Select an option…"` | Text shown when nothing is selected |
| `defaultValue` | `string` | — | Initially selected option value |
| `searchable` | `boolean` | `false` | Enables the dropdown search field |
| `clearable` | `boolean` | `false` | Adds a separate clear-selection button |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Visual size preset |
| `onChange` | `string` | — | Named handler receiving `(value, option)` |

An empty string is a valid option value. `defaultValue: ""` therefore selects an
option whose `value` is `""` instead of being treated as an omitted default.

## Engine identity

The engine-level `id` / `point` contract applies to the component root:

```ts
{
	type: "custom-select",
	props: {
		id: "plan-select",
		name: "plan",
		options: [
			{ value: "starter", label: "Starter" },
			{ value: "pro", label: "Pro" },
		],
	},
}
```

The wrapper receives `id ?? point`. Internal combobox/listbox/option ids are
derived from that root identity (or from React `useId()` when no engine identity
is supplied), so internal accessibility ids do not consume the public root id.

## Keyboard and accessibility behavior

The trigger exposes `role="combobox"`, `aria-controls`, `aria-expanded`, and an
active option id while the list is open. Options have stable per-render ids and
`role="option"`; the search input mirrors the active-descendant reference while
it owns focus.

Supported keyboard behavior includes:

- Enter / Space to open the non-search trigger and activate the focused option;
- Arrow Up / Arrow Down to move through enabled options;
- Enter to select the focused option;
- Escape to close;
- Tab to leave the trigger and close it.

Disabled options are skipped by keyboard navigation and ignored by selection.

When `clearable` is enabled, the clear affordance is a separate native button.
It is not nested inside the combobox button, so the rendered HTML does not contain
nested interactive controls and the clear action remains independently
keyboard-focusable.

Dropdown motion respects `prefers-reduced-motion: reduce`.

## Search behavior

Filtering is case-insensitive and trims the search query. The filtered option
list is memoized for the current `options`, `searchable`, and search value, and
the same filter helper is used when choosing the next focused option after a
search change.

```ts
{
	type: "custom-select",
	props: {
		name: "country",
		label: "Country",
		searchable: true,
		clearable: true,
		options: countries,
		onChange: "handleCountry",
	},
}
```

## Form value

The component always keeps a hidden input in the DOM:

```html
<input type="hidden" name="..." data-engine-bind="..." />
```

Selecting or clearing the visual control updates that hidden input value. This
preserves normal browser form submission and the engine's existing form-binding
contract without requiring a native `<select>` element.
