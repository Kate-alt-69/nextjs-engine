# EngineForms (EF)

Schema types: `"form"`, `"input"`, `"textarea"`, `"checkbox"`, `"label"` —
schema-native HTML form primitives. They behave identically to their HTML
counterparts while staying fully schema-driven. Use `cprop.bind` to wire
fields directly into `EngineAPIResolver` so the engine assembles and fires
the request without any manual `FormData` or `fetch` calls.

---

## How field binding works

```
input / textarea / checkbox
  props.name = "email"          ← sets data-engine-bind="email"
        │
        ▼
EngineAPIResolver.resolveRequest({ formData: { email, password } })
        │
        ▼
POST body: { "email": "...", "password": "..." }
```

Every form element sets a `data-engine-bind` attribute on the rendered DOM
node. When the form's `onSubmit` handler fires, `EngineAPIResolver` walks
the form's DOM subtree, collects all bound values by name, and passes them
as `formData` automatically. No manual `new FormData()` needed.

---

## `form`

| Prop | Type | Description |
|------|------|-------------|
| `onSubmit` | `string` | Handler name from `createPage({ handlers })`. Receives bound field values. |
| `onReset` | `string` | Handler name called when the form resets. |
| `method` | `"get" \| "post"` | Native form HTTP method (used when `action` is set). |
| `action` | `string` | Native form action URL — bypasses EngineAPIResolver. |
| `noValidate` | `boolean` | Disables browser built-in validation. Set `true` when using custom validation. |
| `autoComplete` | `string` | HTML `autocomplete` attribute (`"on"`, `"off"`, etc.). |
| `encType` | `string` | Encoding type for file uploads: `"multipart/form-data"`. |

---

## `input`

| Prop | Type | Description |
|------|------|-------------|
| `type` | `InputType` | `"text"`, `"email"`, `"password"`, `"search"`, `"url"`, `"tel"`, `"number"`, `"hidden"`, `"date"`, `"time"`, `"color"`, `"range"`, `"file"` |
| `name` | `string` | Field name — becomes the key in `formData`. Also sets `data-engine-bind`. |
| `placeholder` | `string` | Placeholder text. |
| `defaultValue` | `string \| number` | Initial value (uncontrolled). |
| `value` | `string \| number` | Controlled value. |
| `disabled` | `boolean` | Disables the field. |
| `required` | `boolean` | Makes the field required. |
| `pattern` | `string` | HTML5 regex validation pattern. |
| `min` / `max` | `string \| number` | Range for `number` and `date` inputs. |
| `step` | `string \| number` | Step increment for `number` and `range`. |
| `minLength` / `maxLength` | `number` | Character length constraints. |
| `multiple` | `boolean` | Allow multiple file selections. |
| `accept` | `string` | Accepted file types: `"image/*"`, `".pdf"`, etc. |
| `autoComplete` | `string` | Per-field autocomplete hint. |
| `readOnly` | `boolean` | Read-only field. |
| `autoFocus` | `boolean` | Focus this field on page load. |
| `tabIndex` | `number` | Tab order. |
| `onChange` | `string` | Handler name called on every keystroke. |
| `ariaLabel` | `string` | Accessible label when no visible label exists. |
| `ariaDescribedBy` | `string` | Id of an element describing this field. |

---

## `textarea`

| Prop | Type | Description |
|------|------|-------------|
| `name` | `string` | Field name. |
| `placeholder` | `string` | Placeholder text. |
| `defaultValue` | `string` | Initial value (uncontrolled). |
| `value` | `string` | Controlled value. |
| `rows` | `number` | Visible row count. |
| `cols` | `number` | Visible column count. |
| `minLength` / `maxLength` | `number` | Character constraints. |
| `resizable` | `"none" \| "both" \| "horizontal" \| "vertical" \| "block" \| "inline"` | CSS resize behaviour. |
| `disabled` | `boolean` | |
| `required` | `boolean` | |
| `readOnly` | `boolean` | |
| `autoFocus` | `boolean` | |
| `tabIndex` | `number` | |
| `onChange` | `string` | Handler name. |
| `autoComplete` | `string` | |
| `ariaLabel` / `ariaDescribedBy` | `string` | Accessibility. |

---

## `checkbox`

| Prop | Type | Description |
|------|------|-------------|
| `name` | `string` | Field name — value is `"on"` / `"off"` in `formData`. |
| `value` | `string` | Custom value submitted when checked (default `"on"`). |
| `checked` | `boolean` | Controlled checked state. |
| `defaultChecked` | `boolean` | Initial checked state (uncontrolled). |
| `disabled` | `boolean` | |
| `required` | `boolean` | |
| `onChange` | `string` | Handler name. |
| `autoFocus` | `boolean` | |
| `tabIndex` | `number` | |
| `ariaLabel` / `ariaDescribedBy` | `string` | Accessibility. |

---

## `label`

| Prop | Type | Description |
|------|------|-------------|
| `htmlFor` | `string` | Id of the associated form element. |
| `forInput` | `string` | Shorthand — sets `htmlFor` to `for-${forInput}`. |

---

## Full example — login form with EngineAPI

```ts
// page.tsx
export default createPage({
  schema: LoginSchema,
  handlers: {
    async handleLogin(formData: Record<string, string>) {
      const resolver = new EngineAPIResolver({
        endpoint: "https://api.example.com/&v1&/auth/login",
        method:   "POST",
        versionMacros: { v1: "v1" },
        auth: { type: "none" },  // login endpoint itself is public
      });

      const res = await resolver.resolveRequest({ formData });
      if (res.ok) {
        const { token } = await res.json();
        localStorage.setItem("token", token);
        window.location.href = "/dashboard";
      }
    },
  },
});

// schema
const LoginSchema = defineSchema({
  root: {
    type: "section",
    props: { contentMaxWidth: "420px", py: "8rem" },
    children: [
      { type: "heading", props: { level: 2, content: "Sign in", align: "center" } },

      {
        type: "form",
        props: { onSubmit: "handleLogin", noValidate: true },
        children: [
          // Email field
          {
            type: "stack",
            props: { direction: "vertical", gap: ".5rem" },
            children: [
              { type: "label", props: { forInput: "email", children: "Email" } },
              {
                type: "input",
                props: {
                  id: "for-email",   // matches label forInput → "for-email"
                  name: "email",     // data-engine-bind="email"
                  type: "email",
                  placeholder: "you@example.com",
                  required: true,
                  autoComplete: "email",
                },
              },
            ],
          },

          // Password field
          {
            type: "stack",
            props: { direction: "vertical", gap: ".5rem", mt: "1rem" },
            children: [
              { type: "label", props: { forInput: "password", children: "Password" } },
              {
                type: "input",
                props: {
                  id: "for-password",
                  name: "password",
                  type: "password",
                  placeholder: "••••••••",
                  required: true,
                  minLength: 8,
                  autoComplete: "current-password",
                },
              },
            ],
          },

          // Remember me
          {
            type: "stack",
            props: { direction: "horizontal", gap: ".5rem", align: "center", mt: "1rem" },
            children: [
              { type: "checkbox", props: { name: "rememberMe", id: "remember" } },
              { type: "label",    props: { htmlFor: "remember", children: "Remember me" } },
            ],
          },

          // Submit
          {
            type: "button",
            props: {
              label:     "Sign in",
              variant:   "solid",
              type:      "submit",
              fullWidth: true,
              mt:        "1.5rem",
            },
          },
        ],
      },
    ],
  },
});
```

When the user clicks "Sign in", the engine:
1. Collects `{ email: "...", password: "...", rememberMe: "on" }` from `data-engine-bind` attributes
2. Passes them to `handleLogin` in your `handlers` map
3. `handleLogin` passes `formData` to `EngineAPIResolver` which serialises it into the POST body

---

## Notes

- The `onSubmit` handler name string maps to a function in `createPage({ handlers })`. The function receives the collected `formData` as its first argument.
- For file uploads: set `encType: "multipart/form-data"` on `form` and `type: "file"` on `input`. `EngineAPIResolver` will detect the `File` objects and build a `FormData` payload automatically.
- `label.forInput: "email"` → sets `htmlFor="for-email"`. The matching input needs `id: "for-email"`. This keeps label/input pairs accessible without writing the id string twice.
