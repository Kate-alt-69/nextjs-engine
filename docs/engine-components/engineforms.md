# EngineForms (EF)

Schema types: `"form"`, `"input"`, `"textarea"`, `"checkbox"`, and `"label"`.

EngineForms are native form elements with engine styling and named-handler
resolution. **Field binding is currently driven by `name`, not by
`cprop.bind`.**

## Submit flow

```text
input/textarea/checkbox props.name
        ↓
data-engine-bind="name"
        ↓
EngineForm collects bound values on submit
        ↓
named createPage handler receives (values, submitEvent)
        ↓
your handler may pass values to EngineAPIResolver
```

EngineAPIResolver does not walk the form DOM itself.

## Form

```ts
{
  type: "form",
  props: {
    onSubmit: "handleLogin",
    noValidate: false,
  },
  children: [/* fields */],
}
```

| Prop | Type | Notes |
|---|---|---|
| `onSubmit` | `string` | Named handler from `createPage({ handlers })` |
| `onReset` | `string` | Named reset handler |
| `method` | `"get" \| "post"` | Native form method |
| `action` | `string` | Native action URL |
| `noValidate` | `boolean` | Native validation control |
| `autoComplete` | `string` | Native autocomplete |
| `encType` | `string` | Native encoding type |

When a named submit handler exists and no native `action` is supplied,
EngineForm prevents the browser's default navigation and calls:

```ts
handler(values, event)
```

If an `action` is present, the named handler may still observe the submission,
but EngineForm does not automatically cancel the native action.

## Input / Textarea

`name` is both the native form field name and EngineForms binding key.

```ts
{
  type: "input",
  props: {
    id: "email",
    name: "email",
    type: "email",
    required: true,
    onChange: "emailChanged",
  },
}
```

A named `onChange` handler receives:

```ts
handler(currentValue, changeEvent)
```

File inputs contribute a `File` for a single selection or `File[]` when
`multiple` is enabled. Disabled fields are skipped.

## Checkbox values

Checkbox binding currently produces:

- checked → the checkbox `value`, or `"on"` when no value was supplied;
- unchecked → `"off"`.

Repeated fields with the same binding name are accumulated into an array.

## Label

```ts
{ type: "label", props: { forInput: "email", children: "Email" } }
```

`forInput: "email"` maps to `htmlFor="for-email"`. Use a matching input id:

```ts
{ type: "input", props: { id: "for-email", name: "email" } }
```

You may use `htmlFor` directly instead.

## EngineAPI example

```ts
export default createPage({
  schema: LoginSchema,
  handlers: {
    async handleLogin(values: Record<string, unknown>) {
      const resolver = new EngineAPIResolver({
        endpoint: "https://api.example.com/login",
        method: "POST",
      });

      const response = await resolver.resolveRequest({ formData: values });
      // handle response
    },
  },
});
```

For binary values EngineAPIResolver creates native `FormData` and lets `fetch`
set the multipart boundary. For non-binary object values it sends JSON by
default.

## Current binding API

Do not rely on old docs/examples that say `cprop.bind` automatically talks to
EngineAPIResolver. In the current API:

1. set `name` on the field;
2. set `onSubmit` on the EngineForm to a named page handler;
3. receive the collected object in that handler;
4. pass it to EngineAPIResolver if the form is network-backed.

This keeps form collection and network orchestration separate and explicit.
