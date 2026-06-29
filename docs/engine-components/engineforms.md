# EngineForms

> Form, Input, Textarea, Checkbox, Label — schema-native form primitives.
> Integrate with EngineAPIResolver via `cprop.bind`.

---

### form

A standard `<form>` primitive that bridges the schema to the `EngineAPIResolver`.

| Prop | Type | Description |
|------|------|-------------|
| `onSubmit` | `string` | Handler name. Automatically receives form data |
| `onReset` | `string` | Handler name to trigger on form reset |
| `method` | `string` | `"get" \| "post"`. |
| `action` | `string` | Native form action URL |
| `noValidate` | `boolean` | Disable browser built-in validation. |
| `autoComplete` | `string` | Native autocomplete control |
| `encType` | `string` | Encoding type for multipart/file submissions |

### input / textarea / checkbox / label

Standard form primitives.

- **input**: Supports `type` (text, password, email, number, etc), `name`, `placeholder`, and standard constraints.
- **textarea**: Supports `rows`, `cols`, and `resizable` (`none | both | horizontal | vertical`).
- **checkbox**: Supports `checked`, `defaultChecked`, and `value`.
- **label**: Supports `htmlFor` or `forInput` (shorthand).

**Data Binding:**
Form elements utilize `data-engine-bind` for automatic field mapping during `EngineAPIResolver` orchestration.

---
