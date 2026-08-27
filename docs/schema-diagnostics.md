# Schema Validation & Diagnostics

Next.js Engine exposes two related schema-checking APIs. They intentionally have
different scopes.

## `validateSchema()` / `validatePageSchema()`

The validator is the lightweight structural check used by the renderer in
development (and optionally with `NEXT_PUBLIC_ENGINE_VALIDATE=1`). It returns:

```ts
interface ValidationResult {
	valid: boolean;
	errors: Array<{
		path: string;
		message: string;
		level: "error" | "warn";
	}>;
}
```

It checks things such as:

- node type shape and registry presence;
- `props` shape;
- required props for built-ins such as image/custom-select/slot;
- Markdown having `content` or `filePath`;
- Canvas having a render source;
- `children` structural shape.

For Canvas, **either** callback mode (`onDraw` / `onSetup`) **or** a `graphics`
configuration is a valid render source. A graphics-only Canvas must not receive
a "blank canvas" warning.

Warnings do not make `valid` false; structural errors do.

## `analyzeSchema()` / `analyzeNode()`

The analyzer is the deeper static-diagnostics pass. In addition to unknown/missing
schema data it checks duplicate navigation targets, ambiguous mobile patch names,
shared node objects, accessibility hints, large child lists, excessive tree depth,
and leaf-node misuse.

Current codes:

| Code | Level | Meaning |
|---|---|---|
| `E001` | error | Unknown/unregistered node type |
| `E002` | error | Missing type-specific required prop |
| `E003` | error | Duplicate navigation target across `id` / `point` |
| `E004` | error | Same schema node object reused in multiple tree positions |
| `E005` | error | Page schema has no root node |
| `W001` | warn | Image has no `alt` |
| `W002` | warn | Button/link has no accessible label/content/children |
| `W003` | warn | Input/checkbox has no explicit `id` or `point` for label association |
| `W004` | warn | More than 100 direct children |
| `W005` | warn | Tree deeper than 15 levels |
| `W006` | warn | Children attached to a runtime leaf node |
| `W007` | warn | Duplicate `SchemaNode.name` makes a MobilePatcher selector ambiguous |

### Navigation target identity

`id` and `point` share one navigation namespace. EngineScroll can resolve a
registered `point` first and then fall back to a literal DOM `id`, so two
different nodes must not claim the same string through either property.

These therefore conflict:

```ts
{
	type: "section",
	props: { id: "pricing" },
}

{
	type: "section",
	props: { point: "pricing" },
}
```

A single node may use the same value for both `id` and `point`; that represents
one anchor and is not reported as a duplicate.

### Mobile patch names

`SchemaNode.name` is the selector identity used by EngineMobilePatcher. Duplicate
names are legal, but a selector for that name patches every matching node. W007
therefore remains advisory instead of making the schema invalid.

Use unique names when a mobile patch should target one specific node.

### Accessible content

W002 understands actual schema content, not only React-style `props.children`.
Any of these satisfy the text-content check:

- `props.label`;
- `props.content`;
- a non-empty string in `node.children`;
- a non-empty schema child array.

### `optgroup`

`optgroup` is **not** a leaf. It is expected to contain `option` children, so the
analyzer continues through its children and does not emit W006 for a normal
option group.

## Analyzer allocation behavior

Unknown-type suggestions still use Levenshtein distance, but the analyzer keeps
only two distance rows instead of allocating a complete matrix for every
candidate. Diagnostic behavior stays the same while temporary memory scales
with the shorter compared name rather than the product of both lengths.

## Why both APIs exist

Use the validator for cheap runtime/development structural checks. Use the
analyzer for tooling, CI, editors, or a more opinionated audit. The analyzer can
produce advisory accessibility/performance warnings that should not become a
runtime rendering dependency.

Both APIs query the live component registry, so custom node types registered with
`registerComponent()` are recognized instead of being hard-coded as unknown.
