# EngineAPI + APIStatic

Engine networking has two separate systems:

- **`EngineAPIResolver`** — normal HTTP requests and `.EngineAPIConfig/*.api` provider configuration.
- **`APIStatic`** — in-house static API programs authored as `data/endpoint/**/*.route` and compiled to browser-executed modules under `/_static/endpoint/*`.

They can work together, but they are intentionally not the same thing. Existing `.api` files remain provider configuration. `.route` files belong to APIStatic.

---

## EngineAPIResolver

```ts
import { EngineAPIResolver } from "nextjs-engine";

const resolver = new EngineAPIResolver({
	endpoint: "https://api.example.com/users",
	method: "POST",
	auth: {
		type: "bearer",
		token,
	},
});

const response = await resolver.resolveRequest({
	formData: {
		name: "Kate",
	},
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

Only plain objects are recursively merged. Platform objects such as `CryptoKey`, `Blob`, and `FormData` are preserved.

For methods other than `GET` and `HEAD`, plain objects are JSON serialized, native `FormData` is passed through, and objects containing browser binary values are converted to native `FormData`. Multipart requests remove a manually supplied `Content-Type` so the browser can add the correct boundary.

An empty HTTP endpoint throws before `fetch()`.

---

## `.EngineAPIConfig/*.api`

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

Both `$NAME` and `${NAME}` environment-variable forms are expanded when configuration is compiled.

```ts
import { ensureAPIConfig, EngineAPIResolver } from "nextjs-engine";

const compiled = await ensureAPIConfig();
const provider = compiled.providers.main;
if (!provider) throw new Error("Missing provider.main");

const resolver = new EngineAPIResolver({
	...provider,
	versionMacros: compiled.versions,
});
```

`ensureAPIConfig()` is a server/build helper because it can read files and expand environment variables.

Supported auth types are `none`, `ak`, `bearer`, `jwt`, `basic`, `hmac`, and `pnp`. HMAC supports SHA-256/SHA-512. PNP supports Ed25519/RS256. EngineAPI removes outgoing `X-Engine-*`, `X-Powered-By`, and `X-Framework` headers before fetch.

---

# APIStatic

APIStatic is the static cousin of `EngineAPIResolver`.

Source files live under:

```text
data/endpoint/**/*.route
```

Examples:

```text
data/endpoint/math.route
→ route id: math

data/endpoint/nextjs-engine/live.route
→ route id: nextjs-engine/live
```

The Engine plugin compiles them to:

```text
public/_static/endpoint/math-<stable-hash>.js
public/_static/endpoint/nextjs-engine/live-<stable-hash>.js
```

and the browser loads them from `/_static/endpoint/*`.

The hash is derived from the logical route path. Editing code does not randomly rename the endpoint. The hash is an identifier/cache namespace, **not authentication**.

## Static means static

A `.route` file becomes browser-executed JavaScript. It does **not** become a hidden Next.js server Route Handler.

It can safely do math, parsing, normal JavaScript logic, public browser `fetch()` calls, combine public API data, and call a separately configured backend bridge through `proxy()`.

Do not put secret keys, private environment values, database credentials, server-only filesystem assumptions, authenticated server-session state, or private user state in `.route` files. Generated source is downloadable by the browser.

---

## `.route` language

A `.route` file is a small TypeScript-like module. Normal top-level variables and functions are allowed. The special root declaration is `createEndpoint([...])`.

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

Inside the endpoint object, commas between endpoint properties and schema fields are optional.

Inside `run.*`, declared functions may use square-bracket call syntax:

```ts
calculateTotal[query.price, query.quantity]
```

which compiles to normal JavaScript `calculateTotal(query.price, query.quantity)`. Normal function-call syntax also works.

### Inline operations

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

`run.query(return expression)` is also accepted; the parser strips the redundant `return`.

### Full run blocks

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

---

## Operations and input namespaces

Each object in `createEndpoint([...])` needs a unique `name`. A route containing one operation may be executed without naming it. A route containing multiple operations must select one.

Supported run forms:

```text
run.query(...)
run.body(...)
run.input(...)
run.proxy(...)
```

These are APIStatic execution namespaces, not HTTP `Request` objects. The caller supplies one input value. APIStatic validates it and exposes the normalized record as `query`, `body`, and `input` inside the operation.

Supported input rules:

```text
string
number
boolean
array
object
any
```

Optional/default examples:

```ts
query: {
	search: "string?"
	page: "number=1"
	limit: "number=20"
	enabled: "boolean=true"
}
```

Missing required values return `400`. Number and boolean values are coerced when possible.

---

## Calling APIStatic with EngineAPIResolver

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
```

Or use `staticEndpoint("math", "calculate")`. `formData` remains a compatibility fallback for APIStatic, but `input` is preferred.

Direct use is also supported:

```ts
import { APIStatic } from "nextjs-engine";

const api = new APIStatic();
const value = await api.execute("math", {
	operation: "calculate",
	input: { price: 100, quantity: 2 },
});
```

`execute()` returns the raw result. `resolveRequest()` converts it to a standard `Response`.

---

## Automatic responses and errors

- object / array / number / boolean / `null` → JSON;
- string → `text/plain`;
- `undefined` → `204 No Content`;
- existing `Response` → passed through unchanged.

Explicit response control:

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

Expected errors use `error(status, message, details?)`. Validation failures return `400`. Unexpected production exceptions become sanitized `500` responses.

---

## Public API fetch vs proxy

For a public browser API, use normal `fetch()` directly inside the `.route` program:

```ts
async function getWeather() {
	const response = await fetch("https://example.com/public-weather")
	return response.json()
}
```

`proxy()` is deliberately different. It represents a bridge to something outside the static runtime, such as your own real backend.

There is **no fake default server proxy**. Calling `proxy()` before configuring a bridge throws a clear error.

Configure the bridge once in client initialization:

```ts
import { configureAPIStatic } from "nextjs-engine";

configureAPIStatic({
	proxy: async (target, input, init) => {
		const response = await fetch("/api/static-proxy", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ target, input, init }),
		});

		if (!response.ok) throw new Error("Proxy failed")
		return response.json()
	},
});
```

Then a `.route` can use:

```ts
run.proxy(
	proxy["profile", { id: query.id }]
)
```

The actual backend owns cookies, authentication, secrets, database work, and user/session state.

---

# Plugin setup

Installed package:

```js
const withEngineAPI = require("nextjs-engine/plugin")
module.exports = withEngineAPI(nextConfig)
```

Source-folder integration:

```js
const withEngineAPI = require("./src/engine/plugins/engineApiPlugin")
module.exports = withEngineAPI(nextConfig)
```

Options:

```js
module.exports = withEngineAPI(nextConfig, {
	configDir: ".EngineAPIConfig",
	outputFile: ".engine-api-compiled.json",
	endpointDir: "data/endpoint",
	staticOutputDir: "public/_static/endpoint",
})
```

The plugin compiles during `next.config` evaluation, so it works with Turbopack and webpack.

During `next dev`, existing `.route` and `.api` source directories are watched. Editing, adding, or deleting matching files recompiles generated output without restarting the dev server. Set `NEXTJS_ENGINE_API_WATCH=0` to disable the watcher, or `NEXTJS_ENGINE_API_WATCH=1` to force it for custom development launchers.

APIStatic adds a changing query token when loading generated modules in development so `APIStatic.clear()` followed by another call does not get trapped behind the browser ES-module cache. Production keeps the stable URL unchanged.

Generated `public/_static/endpoint` files and `.engine-api-compiled.json` are build artifacts and should not be committed.

The package plugin depends on TypeScript because `.route` files may contain TypeScript annotations. The package sync installs TypeScript as a runtime build dependency for `nextjs-engine/plugin`.
