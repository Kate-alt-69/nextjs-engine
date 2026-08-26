# EngineAPI (EA)

EngineAPI has two related runtime systems:

- **`EngineAPIResolver`** — calls normal HTTP APIs and keeps the existing `.EngineAPIConfig/*.api` provider configuration system.
- **`APIStatic`** — compiles small in-house API programs from `data/endpoint/**/*.route` into browser-executed static modules under `/_static/endpoint/*`.

The two systems are intentionally separate. `.api` files remain provider configuration. `.route` files are executable static endpoint programs.

## EngineAPIResolver — direct HTTP usage

```ts
import { EngineAPIResolver } from "nextjs-engine";

const resolver = new EngineAPIResolver({
	endpoint: "https://api.example.com/users",
	method: "POST",
	auth: { type: "bearer", token },
});

const response = await resolver.resolveRequest({
	formData: { name: "Kate" },
});
```

Configuration cascades in this order:

```text
constructor config
    ↓
resolveRequest.pageOverrides
    ↓
resolveRequest.nodeOverrides
```

Only plain objects are recursively merged. Browser/platform objects such as
`CryptoKey`, `Blob`, and `FormData` are preserved instead of being recursively
spread apart.

## APIStatic — in-house static endpoints

APIStatic is for logic that belongs to the website but does **not** need its own
server Route Handler. Source files live only under:

```text
data/endpoint/**/*.route
```

The path under `data/endpoint` is the route id:

```text
data/endpoint/math.route
→ route id: math

data/endpoint/nextjs-engine/live.route
→ route id: nextjs-engine/live
```

The Engine plugin compiles them to deterministic same-origin static modules:

```text
public/_static/endpoint/math-<stable-hash>.js
public/_static/endpoint/nextjs-engine/live-<stable-hash>.js
```

The public URL is therefore under `/_static/endpoint/*`. The hash is derived from
the logical route path, so editing the route does not randomly rename it. It is
an identifier/cache namespace, **not authentication**.

### Important runtime boundary

APIStatic is **static browser code**. It is not a hidden Next.js server endpoint.
The compiled module can do JavaScript work, math, parsing, and browser-visible
`fetch()` calls, but its source/constants are downloadable by the browser.

Do not put secrets, private API keys, server environment variables, database
credentials, authenticated server-session assumptions, or private user state in
a `.route` file.

If an operation needs private/user/server behavior, call a real backend through
the injected `proxy()` helper (or a normal public `fetch`) and let that backend
own authentication/secrets.

## `.route` language

A `.route` file is a small TypeScript-like module. Normal top-level `const`,
`let`, `function`, and `async function` declarations are supported. The one
special root declaration is `createEndpoint([ ... ])`.

Inside the `createEndpoint` array, commas between endpoint properties and input
schema fields are optional.

```ts
// data/endpoint/math.route

const TAX_RATE = 0.18

function calculateTotal(price: number, quantity: number) {
	const subtotal = price * quantity

	return {
		subtotal,
		tax: subtotal * TAX_RATE,
		total: subtotal * (1 + TAX_RATE)
	}
}

createEndpoint([
	{
		name: "calculate"

		query: {
			price: "number"
			quantity: "number=1"
		}

		run.query(
			calculateTotal[query.price, query.quantity]
		)
	}
])
```

Inside `run.*`, square-bracket calls are shorthand for top-level functions:

```ts
calculateTotal[query.price, query.quantity]
```

compiles to:

```ts
calculateTotal(query.price, query.quantity)
```

Normal function-call syntax also works.

### Inline operations

You do not need a helper function for small operations:

```ts
createEndpoint([
	{
		name: "add"
		query: {
			a: "number"
			b: "number"
		}
		run.query(query.a + query.b)
	}

	{
		name: "stats"
		query: {
			a: "number"
			b: "number"
		}
		run.query({
			sum: query.a + query.b,
			product: query.a * query.b
		})
	}
])
```

`run.query(return expression)` is also accepted; the parser strips the redundant
`return` and treats the expression as the result.

### Full run blocks

Use a block when the operation needs branching or several statements:

```ts
createEndpoint([
	{
		name: "safeDivide"
		query: {
			a: "number"
			b: "number"
		}

		run.query {
			if (query.b === 0) {
				error(400, "Cannot divide by zero")
			}

			return {
				result: query.a / query.b
			}
		}
	}
])
```

### Operation names

Every entry in `createEndpoint([...])` needs a unique `name`.

A route with one operation can be called without specifying the operation. A
route with multiple operations must choose one by name.

```ts
createEndpoint([
	{ name: "add" run.query(query.a + query.b) }
	{ name: "subtract" run.query(query.a - query.b) }
])
```

### Input namespaces

Supported run forms:

```text
run.query(...)
run.body(...)
run.input(...)
run.proxy(...)
```

They are static execution namespaces, not HTTP request objects. APIStatic receives
one input value from the caller, validates it against the matching schema, and
makes the normalized record available as `query`, `body`, and `input` inside the
run function. `run.*` selects the intended authoring namespace and its schema.

### Input schema rules

Supported rules:

```text
string
number
boolean
array
object
any
```

Append `?` for optional values:

```ts
query: {
	search: "string?"
}
```

Append `=default` for defaults:

```ts
query: {
	page: "number=1"
	limit: "number=20"
	enabled: "boolean=true"
}
```

Missing required inputs become a `400` response. Number/boolean inputs are
coerced when possible.

## Calling APIStatic through EngineAPIResolver

Use an object endpoint instead of a URL:

```ts
import { EngineAPIResolver } from "nextjs-engine";

const resolver = new EngineAPIResolver({
	endpoint: {
		static: "math",
		operation: "calculate",
	},
});

const response = await resolver.resolveRequest({
	input: {
		price: 100,
		quantity: 2,
	},
});

const result = await response.json();
```

`formData` is accepted as a compatibility fallback, but `input` is the clearer
name for APIStatic calls.

The helper below produces the same endpoint object:

```ts
import { EngineAPIResolver, staticEndpoint } from "nextjs-engine";

const resolver = new EngineAPIResolver({
	endpoint: staticEndpoint("math", "calculate"),
});
```

## Using APIStatic directly

```ts
import { APIStatic } from "nextjs-engine";

const api = new APIStatic();

const rawResult = await api.execute("math", {
	operation: "calculate",
	input: { price: 100, quantity: 2 },
});

const response = await api.resolveRequest("math", {
	operation: "calculate",
	input: { price: 100, quantity: 2 },
});
```

`execute()` returns the raw operation value. `resolveRequest()` converts the
result to a standard `Response`.

## Automatic responses

Plain objects, arrays, numbers, booleans, and `null` become JSON responses.
Strings become `text/plain`. `undefined` becomes `204 No Content`. Returning an
existing `Response` passes it through unchanged.

For explicit response control inside a `.route` file:

```ts
run.input(
	response({
		status: 201,
		headers: {
			"X-Created": "yes"
		},
		body: {
			created: true
		}
	})
)
```

## Errors

`.route` files receive an `error()` helper:

```ts
function findItem(id: string) {
	if (!id) {
		error(404, "Item not found")
	}

	return { id }
}
```

`error(status, message, details?)` stops execution and APIStatic converts it to a
JSON error response with that status. Input validation errors use status `400`.
Unexpected exceptions become `500` responses.

## Proxying server/private work

Every run context receives `proxy`.

```ts
createEndpoint([
	{
		name: "profile"
		query: {
			id: "string"
		}

		run.proxy(
			proxy["/api/profile-proxy", { id: query.id }]
		)
	}
])
```

The default proxy helper is still a browser `fetch`: when an input value is
supplied it sends JSON with `POST`; with no input it uses normal fetch defaults.
The target backend remains responsible for cookies, authorization, secrets,
database access, or any other server-only capability.

You can replace proxy behavior globally:

```ts
import { configureAPIStatic } from "nextjs-engine";

configureAPIStatic({
	proxy: async (target, input, init) => {
		// custom bridge implementation
	},
});
```

## Plugin setup

APIStatic compilation is part of `engineApiPlugin` so the existing EngineAPI
provider compiler and the new static endpoint compiler run together.

Installed package:

```js
// next.config.js
const withEngineAPI = require("nextjs-engine/plugin");

module.exports = withEngineAPI({
	// normal Next config
});
```

Source-folder integration:

```js
const withEngineAPI = require("./src/engine/plugins/engineApiPlugin");
module.exports = withEngineAPI(nextConfig);
```

Options:

```js
module.exports = withEngineAPI(nextConfig, {
	configDir: ".EngineAPIConfig",
	outputFile: ".engine-api-compiled.json",
	endpointDir: "data/endpoint",
	staticOutputDir: "public/_static/endpoint",
});
```

The plugin compiles during `next.config` evaluation so it works when Next.js is
running Turbopack, rather than depending only on the webpack hook.

Generated `public/_static/endpoint` files are build artifacts and should not be
committed.

## Compiled `.EngineAPIConfig`

The existing provider system is unchanged:

```ini
[provider.main]
endpoint = "https://api.example.com&V1&"
method = "POST"
cache = "no-cache"

[provider.main.auth]
type = "hmac"
secret = "${API_SECRET}"
algorithm = "SHA-256"

[versions]
V1 = "/api/v1"
```

Both `$NAME` and `${NAME}` environment-variable forms are expanded while the
config is compiled.

To use a compiled provider:

```ts
import { ensureAPIConfig, EngineAPIResolver } from "nextjs-engine";

const compiled = await ensureAPIConfig();
const provider = compiled.providers.main;
if (!provider) throw new Error("Missing provider.main");

const resolver = new EngineAPIResolver({
	...provider,
	versionMacros: compiled.versions,
});

const response = await resolver.resolveRequest({
	formData: { email: "a@example.com" },
});
```

`ensureAPIConfig()`/directory loading uses filesystem APIs and belongs in a
server or build path. Do not put secrets or `.api` compilation into browser code.

## Request bodies for normal HTTP endpoints

For methods other than `GET` and `HEAD`:

- plain form-data objects without binary values are JSON-stringified;
- native `FormData` is passed through;
- objects containing `Blob`, `File`, `FileList`, or arrays of binary values are converted to native `FormData`;
- when native FormData is used, EngineAPI removes a manually supplied `Content-Type` header so `fetch` can generate the correct multipart boundary.

`DELETE` may carry a body when `formData` is explicitly supplied.

An empty normal HTTP endpoint throws before `fetch` is called.

## Authentication for normal HTTP endpoints

Supported auth modes remain `none`, `ak`, `bearer`, `jwt`, `basic`, `hmac`, and
`pnp`.

### HMAC

HMAC supports SHA-256 and SHA-512. Payload:

```text
METHOD\nURL\nTIMESTAMP\nBODY
```

Headers:

```text
X-Timestamp: <Unix milliseconds>
X-Signature: <hex HMAC>
X-Key: <optional key id>
```

### PNP

Asymmetric signing supports Ed25519 and RS256. `privateKey` may be a `CryptoKey`,
JWK object, JSON JWK string, or PKCS#8 PEM string.

## Version macros

Normal HTTP resolver URLs replace every `&NAME&` token from `versionMacros`:

```ts
new EngineAPIResolver({
	endpoint: "https://api.example.com&V1&/users",
	versionMacros: { V1: "/api/v1" },
});
```

becomes:

```text
https://api.example.com/api/v1/users
```

## Header fingerprint filtering

Before a normal HTTP fetch, EngineAPI removes outgoing header names matching:

- `X-Engine-*`
- `X-Powered-By`
- `X-Framework`

This is a small anti-fingerprinting measure, not an anonymity guarantee.
