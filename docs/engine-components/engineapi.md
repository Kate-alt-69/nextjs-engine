# EngineAPIResolver

Engine networking has two related but separate systems:

- **`EngineAPIResolver`** — normal HTTP requests, auth, config cascading, and `.EngineAPIConfig/*.api` provider configuration.
- **`APIStatic`** — in-house browser-executed endpoint programs from `data/endpoint/**/*.route`.

This page documents EngineAPIResolver and provider configuration. For `.route` syntax, logical endpoint names, discovery, `APIStatic.resolve()`, proxy behavior, and generated `/_static/endpoint/*` modules, see [`apistatic.md`](./apistatic.md).

---

## Basic request

```ts
import { EngineAPIResolver } from "nextjs-engine"

const resolver = new EngineAPIResolver({
	endpoint: "https://api.example.com/users",
	method: "POST",
	auth: {
		type: "bearer",
		token
	}
})

const response = await resolver.resolveRequest({
	formData: {
		name: "Kate"
	}
})
```

Configuration cascades in this order:

```text
constructor config
	↓
resolveRequest.pageOverrides
	↓
resolveRequest.nodeOverrides
```

Only plain option objects are recursively merged. Platform objects such as `CryptoKey`, `Blob`, `FileList`, and `FormData` are preserved. **`endpoint` is an atomic routing field**: a later endpoint replaces the earlier endpoint as a whole. Static endpoint descriptors are never recursively combined, so an `operation` from one route cannot leak into a different overridden route.

For methods other than `GET` and `HEAD`, plain objects are JSON serialized. Native `FormData` passes through unchanged. Plain objects containing browser binary values are converted to native `FormData`; a manually supplied multipart `Content-Type` is removed so the browser can add the correct boundary.

An empty HTTP endpoint throws before `fetch()`.

---

## EngineAPIConfig

```ts
interface EngineAPIConfig {
	endpoint?: string | EngineAPIStaticEndpoint
	method?: string
	cache?: RequestCache
	auth?: EngineAPIAuthConfig
	headers?: Record<string, string>
	versionMacros?: Record<string, string>
}
```

A string endpoint performs a normal HTTP request. An APIStatic descriptor dispatches into the static endpoint runtime:

```ts
const resolver = new EngineAPIResolver({
	endpoint: {
		static: "math",
		operation: "add"
	}
})
```

Prefer the APIStatic helper when authoring application code:

```ts
import { APIStatic, EngineAPIResolver } from "nextjs-engine"

const resolver = new EngineAPIResolver({
	endpoint: APIStatic.endpoint("math", "add")
})
```

The logical name (`math`) comes from `data/endpoint/math.route`. Application code should not hardcode the generated hashed JavaScript URL. See [`apistatic.md`](./apistatic.md).

When dispatching to APIStatic, `resolveRequest({ input })` uses `formData` only when `input` is **undefined**. Explicit values such as `null`, `false`, `0`, and `""` remain real APIStatic input and are not replaced by the compatibility fallback.

---

## Version macros

Macros use `&NAME&` syntax:

```ts
const resolver = new EngineAPIResolver({
	endpoint: "https://api.example.com&V1&/users",
	versionMacros: {
		V1: "/api/v1"
	}
})
```

The resolver replaces every configured macro before fetch.

---

## `.EngineAPIConfig/*.api`

Provider configuration remains separate from APIStatic `.route` programs.

```text
.EngineAPIConfig/*.api
→ external API/provider configuration

data/endpoint/**/*.route
→ in-house APIStatic programs
```

Example provider config:

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

Runtime/server usage:

```ts
import { ensureAPIConfig, EngineAPIResolver } from "nextjs-engine"

const compiled = await ensureAPIConfig()
const provider = compiled.providers.main

if (!provider) {
	throw new Error("Missing provider.main")
}

const resolver = new EngineAPIResolver({
	...provider,
	versionMacros: compiled.versions
})
```

`ensureAPIConfig()` is a server/build helper because it can read files and expand environment variables. Do not call it from client code.

### Config loading and cache identity

The no-argument `ensureAPIConfig()` call represents the default `.EngineAPIConfig` build/runtime configuration. `setCompiledAPIConfig()` may provide that default config directly, and `getCompiledAPIConfig()` reads the same default slot.

Explicit directories are independent:

```ts
const internal = await ensureAPIConfig(".EngineAPIConfig/internal")
const publicApi = await ensureAPIConfig(".EngineAPIConfig/public")
```

A load from one explicit directory cannot become the result for another directory or overwrite the build-injected default config. Concurrent requests for the **same** directory share one in-process load promise instead of repeating filesystem work.

When reading a directory from disk, `.api` filenames are sorted first to preserve deterministic merge order. Their contents are then read concurrently and joined in that sorted order before compilation, avoiding unnecessary serial filesystem latency without changing override semantics.

---

## Authentication

Supported auth types:

| Type | Main fields | Output |
|---|---|---|
| `none` | — | No auth headers |
| `ak` | `key`, `destinationHeader?` | API-key header |
| `bearer` | `token` | `Authorization: Bearer ...` |
| `jwt` | `token` | `Authorization: Bearer ...` |
| `basic` | `username`, `password` | Basic Authorization |
| `hmac` | `secret`, `key?`, `algorithm?` | Timestamp + HMAC signature |
| `pnp` | `privateKey`, `key?`, `algorithm?` | Timestamp + asymmetric signature |

HMAC supports SHA-256 and SHA-512. PNP supports Ed25519 and RS256.

EngineAPI strips outgoing engine/framework fingerprint headers, including matching `X-Engine-*`, `X-Powered-By`, and `X-Framework` values, before the request is sent.

---

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

The same plugin compiles both systems:

```text
.EngineAPIConfig/*.api
	↓
.engine-api-compiled.json

data/endpoint/**/*.route
	↓
public/_static/endpoint/*
	↓
manifest.json
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

The plugin runs during `next.config` evaluation so the compiler is available with Turbopack as well as webpack. During `next dev`, existing `.api` and `.route` source directories are watched for changes.

For all APIStatic authoring/runtime details, continue with [`APIStatic`](./apistatic.md).
