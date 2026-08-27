# APIStatic

APIStatic is the in-house static API system for Next.js Engine. It is intentionally separate from `.EngineAPIConfig/*.api` provider configuration.

Use APIStatic when the application needs small programmable endpoint modules for browser-safe work such as math, parsing, transformations, public API composition, or explicitly proxied backend work without creating a new Next.js `route.ts` for every operation.

## Source ownership

APIStatic owns every `.route` file under:

```text
data/endpoint/**/*.route
```

The relative file path is the logical endpoint name:

```text
data/endpoint/math.route
→ math

data/endpoint/weather.route
→ weather

data/endpoint/user/profile.route
→ user/profile
```

You do not manually choose or copy the generated hash.

The EngineAPI plugin compiles the files to:

```text
public/_static/endpoint/math-<stable-hash>.js
public/_static/endpoint/weather-<stable-hash>.js
public/_static/endpoint/user/profile-<stable-hash>.js
```

and generates:

```text
public/_static/endpoint/manifest.json
```

The hash is derived from the logical route path, so editing the route body does not randomly rename it. The hash is an identifier/cache namespace, not authentication.

## Static means browser-executed

A `.route` file is compiled static JavaScript. It is **not** converted into a hidden Next.js Route Handler and does not magically gain server state.

Safe examples include:

- math and calculations;
- parsing and formatting;
- arrays/objects and normal JavaScript logic;
- public browser `fetch()` calls where CORS permits them;
- combining public API data;
- calling an explicitly configured backend bridge through `proxy()`.

Do not put secrets, private environment variables, database credentials, server filesystem assumptions, private cookies, or authenticated server-session state in `.route` files. The generated program is downloadable by the browser.

## The `.route` language

A `.route` file is a small TypeScript-like module. Top-level variables and functions are normal. The special root declaration is `createEndpoint([...])`.

```ts
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

Inside endpoint objects and schema objects, commas are optional where the parser can unambiguously separate entries.

Declared functions support the compact bracket-call form inside `run.*`:

```ts
calculateTotal[query.price, query.quantity]
```

which compiles to normal JavaScript:

```ts
calculateTotal(query.price, query.quantity)
```

Normal function-call syntax also works.

## Inline operations

Simple work does not need a wrapper function:

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

`run.query(return expression)` is accepted too; the parser removes the redundant `return`.

For larger operations use a block:

```ts
run.query {
	if (query.b === 0) {
		error(400, "Cannot divide by zero")
	}

	return {
		result: query.a / query.b
	}
}
```

Supported execution namespaces are:

```text
run.query(...)
run.body(...)
run.input(...)
run.proxy(...)
```

They are authoring namespaces, not HTTP `Request` objects. The caller supplies one input value; APIStatic validates it and exposes the normalized record as `query`, `body`, and `input`.

## Input schema

Supported rules:

```text
string
number
boolean
array
object
any
```

Optional values use `?` and defaults use `=`:

```ts
query: {
	search: "string?"
	page: "number=1"
	limit: "number=20"
	enabled: "boolean=true"
}
```

Missing required fields become a `400` response. Numbers and booleans are coerced when possible.

## Logical names: never use the hash manually

Application code should reference the route name from `data/endpoint`, not the generated JavaScript path.

For example:

```text
data/endpoint/math.route
```

is referenced as:

```ts
APIStatic.endpoint("math")
```

and:

```text
data/endpoint/user/profile.route
```

is referenced as:

```ts
APIStatic.endpoint("user/profile")
```

The generated `/_static/endpoint/...-hash.js` URL is an implementation detail.

## EngineAPIResolver usage

`APIStatic.endpoint()` returns the endpoint descriptor already understood by `EngineAPIResolver`.

Single-operation route:

```ts
import { APIStatic, EngineAPIResolver } from "nextjs-engine"

const resolver = new EngineAPIResolver({
	endpoint: APIStatic.endpoint("weather")
})

const response = await resolver.resolveRequest({
	input: {
		city: "Ahmedabad"
	}
})
```

Multiple operations:

```ts
const resolver = new EngineAPIResolver({
	endpoint: APIStatic.endpoint("math", "add")
})

const response = await resolver.resolveRequest({
	input: {
		a: 20,
		b: 30
	}
})
```

The equivalent object form remains valid:

```ts
endpoint: {
	static: "math",
	operation: "add"
}
```

Static endpoint descriptors are atomic across resolver override layers. Replacing `math/add` with `{ static: "weather" }` does not accidentally retain the old `add` operation.

## Convenience resolver

For small calls you do not need to construct `EngineAPIResolver` yourself:

```ts
const response = await APIStatic.resolve(
	"math",
	"add",
	{
		a: 20,
		b: 30
	}
)
```

For a one-operation route:

```ts
const response = await APIStatic.resolve("weather", {
	city: "Ahmedabad"
})
```

`APIStatic.resolve()` dispatches through the default APIStatic runtime and returns the same standard `Response` model as `resolveRequest()`.

If a multi-operation call has no input, pass an explicit third argument such as `{}` so the second string is unambiguously the operation name. For cases where a scalar string input could be confused with an operation name, prefer the explicit `resolveRequest(route, { operation, input })` form.

## Discovering compiled endpoints

The compiler writes a tiny `manifest.json`. It contains only public route metadata:

```json
{
	"version": 1,
	"endpoints": {
		"math": {
			"hash": "1u6n8nj",
			"operations": ["add", "multiply"]
		},
		"user/profile": {
			"hash": "...",
			"operations": ["get"]
		}
	}
}
```

Discovery helpers load that manifest without downloading every endpoint program:

```ts
const names = await APIStatic.names()
// ["math", "user/profile", "weather"]

const exists = await APIStatic.has("math")
// true

const endpoints = await APIStatic.getEndpoints()
```

`getEndpoints()` returns metadata keyed by logical route:

```ts
{
	math: {
		route: "math",
		hash: "1u6n8nj",
		operations: ["add", "multiply"],
		url: "/_static/endpoint/math-1u6n8nj.js"
	}
}
```

Manifest data is validated before it is exposed. Malformed route names, hashes, or operation lists are rejected instead of failing later inside a discovery helper.

The `url` and `hash` are useful for diagnostics/tooling; normal application code should continue using the logical route name.

`APIStatic.endpoint(...)` does **not** require manifest discovery first. Normal execution remains deterministic from the logical route name.

Development discovery uses `no-store`/cache-busting and releases the manifest cache after each completed lookup, so watcher-generated additions/removals can become visible without reloading the page. Production retains the stable manifest cache.

## Direct APIStatic instance

A configured instance is useful when you need a custom proxy or static base path:

```ts
import { APIStatic } from "nextjs-engine"

const api = new APIStatic({
	basePath: "/_static/endpoint"
})

const names = await api.names()
const response = await api.resolve("math", "add", { a: 2, b: 3 })
```

`basePath: "/"` or `basePath: ""` correctly targets generated files at the site root instead of producing a protocol-relative `//...` URL.

`execute()` returns the raw operation result. `resolve()` and `resolveRequest()` return a `Response`.

## Responses and errors

Automatic response conversion:

- object / array / number / boolean / `null` → JSON;
- string → `text/plain`;
- `undefined` → `204 No Content`;
- existing `Response` → passed through.

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

Explicit response statuses must be integer HTTP response statuses from `200` through `599`. `204`, `205`, and `304` are emitted without a body even when a route supplied one. Invalid explicit statuses are converted into a controlled APIStatic validation response instead of letting the `Response` constructor fail outside the API boundary.

Expected failures use:

```ts
error(404, "Item not found")
```

Custom `error()` statuses must be in the error range (`400`–`599`); invalid error statuses fall back to `500`. Validation failures use `400`. Unexpected production failures are sanitized to a generic `500` body. Circular/unserializable error details cannot break the error response itself.

## Public fetch vs proxy

A public browser API can be fetched normally:

```ts
async function getWeather() {
	const response = await fetch("https://example.com/public-weather")
	return response.json()
}
```

`response` and `error` are only reserved as APIStatic runtime helpers at module scope. Normal local variables with those names are valid, including the common `const response = await fetch(...)` pattern inside a function. The same rule applies to the `createEndpoint` DSL name and generated internal bindings: only declarations that would actually collide in the generated module are rejected.

`proxy()` means something different: cross the static boundary through a backend bridge that the application explicitly configures.

There is no fake default proxy. Using `proxy()` before configuring one throws.

```ts
import { configureAPIStatic } from "nextjs-engine"

configureAPIStatic({
	proxy: async (target, input, init) => {
		const response = await fetch("/api/static-proxy", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ target, input, init })
		})

		if (!response.ok) throw new Error("Proxy failed")
		return response.json()
	}
})
```

Then the `.route` program can use:

```ts
run.proxy(
	proxy["profile", { id: query.id }]
)
```

The backend bridge owns authentication, cookies, secrets, databases, private user state, or other server-only capabilities.

## Plugin setup

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
	staticManifestFile: "manifest.json"
})
```

If you customize `staticOutputDir` so its public URL changes, configure APIStatic with the matching `basePath`. If you customize `staticManifestFile`, pass the same `manifestFile` to `APIStatic`/`configureAPIStatic`.

During `next dev`, existing `.route` and `.api` source directories are watched. Editing, creating, or deleting matching files recompiles output without restarting Next. Set `NEXTJS_ENGINE_API_WATCH=0` to disable the watcher or `NEXTJS_ENGINE_API_WATCH=1` to force it for a custom development launcher.

Development endpoint modules and the manifest use cache-busting/no-store behavior where appropriate. Production keeps stable endpoint URLs.

## Runtime loading behavior

Concurrent requests for the same not-yet-loaded endpoint share one in-flight module load. Once the module registers, that temporary promise is released and subsequent calls use the route registry directly. Script load/error/timeout handlers are detached when the request settles, so late browser events cannot retain or re-settle an old load.

## Compiler behavior

The compiler validates every `.route` before replacing generated output. If a route has a syntax/parser failure during development, the previous last-known-good static endpoint output is preserved rather than deleting all working endpoints.

The parser supports normal strings/comments/template expressions, regular-expression literals, declared functions, function expressions, and arrow-function helpers when translating the compact bracket-call syntax.

Runtime binding validation is scope-aware. Module-level declarations that collide with APIStatic's generated runtime (`createEndpoint`, `response`, `error`, and internal `__engineApiStatic*` bindings) are rejected, while the same names inside normal functions or nested lexical blocks are allowed. Destructuring/import/`var` bindings are checked too, so collisions fail with an APIStatic compiler error instead of surfacing later as invalid generated JavaScript.

A `run.* { ... }` block receives `query`, `body`, `input`, `proxy`, and the internal `__context` binding in its function scope. Redeclaring one of those in the same run scope is rejected. A nested block-scoped shadow is valid; function-scoped `var` shadows are not.

Callable discovery for compact `helper[...]` syntax only uses helpers visible from the operation's module scope. A function declared inside an unrelated nested function no longer causes an array access with the same name in a run block to be rewritten into a call.

The root `createEndpoint([...])` search is top-level aware, so nested functions/calls named `createEndpoint` are not mistaken for the route declaration.

TypeScript is required by the package plugin because `.route` files may contain TypeScript annotations and the compiler uses the TypeScript parser for runtime-scope analysis.
