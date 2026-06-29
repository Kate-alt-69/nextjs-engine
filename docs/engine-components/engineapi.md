# EngineAPI — Networking

> Declarative fetch orchestration with multi-tier auth, versioning, and overrides.
> Configure via `.EngineAPIConfig/*.api` files; resolve at runtime via `EngineAPIResolver`.

---

## Networking

### EngineAPIResolver

A centralized class for handling fetch requests with multi-tier evaluation (Global → Page → Node).

```ts
const resolver = new EngineAPIResolver({ 
	endpoint: "https://api.kastrick.com/&v&/", 
	versionMacros: { v: "v1" } 
});

const res = await resolver.resolveRequest({
	formData: { username: "admin" },
	pageOverrides: { 
		endpoint: "https://api.kastrick.com/&v&/login", // Macros still apply to overrides
		method: "POST" 
	}
});
```

**Configuration (`EngineAPIConfig`):**
- `endpoint`: Base URL.
- `method`: HTTP Verb.
- `auth`: Authentication config (`type: "bearer" | "basic" | "hmac" | "pnp"`).
- `headers`: Request headers.
- `versionMacros`: URL macro map (e.g., `&v&` -> `v1`).

---

### EngineAPIConfigParser — `.EngineAPIConfig` file format

Place `.api` files inside a `.EngineAPIConfig/` directory at your project root. The plugin compiles them at build time; the parser can also be called at runtime server-side.

**File format (TOML-inspired):**

```ini
# .EngineAPIConfig/main.api

[provider.main]
endpoint = "https://api.kastrick.com"
method   = "POST"
cache    = "no-cache"

[provider.main.auth]
type      = "hmac"
secret    = "$API_SECRET"
algorithm = "sha-256"

[provider.cdn]
endpoint = "https://cdn.kastrick.com"
method   = "GET"
cache    = "force-cache"

[versions]
V1 = "/api/v1"
V2 = "/api/v2"
```

Environment variables are substituted with `$VAR_NAME` syntax. All `$VAR` values are resolved from `process.env` at compile time (plugin) or at `ensureAPIConfig()` call time (runtime).

**Next.js plugin setup:**

```js
// next.config.js
const withEngineAPI = require("./src/engine/plugins/engineApiPlugin");

module.exports = withEngineAPI({
  // your existing next config
}, {
  configDir:  ".EngineAPIConfig",          // default
  outputFile: ".engine-api-compiled.json", // default
});
```

**Runtime usage (server-side):**

```ts
import { ensureAPIConfig } from "@/engine";

// In getServerSideProps / Route Handler / Server Component:
const config = await ensureAPIConfig(); // reads + caches on first call

const resolver = new EngineAPIResolver({
  endpoint:      "&V1&/users/login",
  provider:      "main",
  compiledConfig: config,
});
```

**Supported auth types:**

| Type | Required fields | Header emitted |
|------|----------------|----------------|
| `none` | — | — |
| `ak` | `key`, `header?` | `X-Key: <key>` (or custom header) |
| `bearer` | `token` | `Authorization: Bearer <token>` |
| `jwt` | `token` | `Authorization: Bearer <token>` |
| `basic` | `username`, `password` | `Authorization: Basic <base64>` |
| `hmac` | `secret`, `algorithm?` | `X-Timestamp`, `X-Signature` (SHA-256 or SHA-512 HMAC) |
| `pnp` | `privateKey` (JWK), `algorithm?` | `X-Key`, `X-Timestamp`, `X-Signature` (Ed25519 or RS256) |

---
