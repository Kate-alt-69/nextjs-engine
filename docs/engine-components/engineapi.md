# EngineAPI (EA)

Declarative networking built into the schema engine. Configure providers once
in `.EngineAPIConfig/*.api` files, reference them at runtime via
`EngineAPIResolver`, and bind form fields directly with `cprop.bind` — no
manual `fetch` calls needed.

---

## Architecture

```
.EngineAPIConfig/*.api        ← human-readable config files
        │
        ▼
engineApiPlugin (Next.js build step)
        │
        ▼
.engine-api-compiled.json     ← baked into the build, no runtime file I/O
        │
        ▼
ensureAPIConfig()             ← in-process cache, call once server-side
        │
        ▼
EngineAPIResolver             ← resolves endpoint, auth, version macros, fires fetch
        │
        ▼
onSuccess / onError handlers
```

---

## Authentication methods

### `none` — Anonymous / public

No headers added. Use for completely public endpoints that need no credentials.

```ini
[provider.public]
endpoint = "https://api.example.com"
method   = "GET"

[provider.public.auth]
type = "none"
```

**When to use:** CDN content, public product catalogs, any endpoint that is
open to the internet without a key.

---

### `ak` — API Key

You get a static key string from the service's developer dashboard and send it
on every request. The key proves which application is making the call —
not which user.

**Get it from:** the service's developer portal / settings page.
Usually labelled "API Key", "Access Key", or "Public Key".

**Header sent:** `X-Key: <your-key>` by default, or whatever header the
service specifies (set `destinationHeader`).

```ini
[provider.stripe]
endpoint = "https://api.stripe.com/v1"
method   = "POST"

[provider.stripe.auth]
type              = "ak"
key               = "$STRIPE_KEY"          # pulled from process.env at build time
destinationHeader = "Authorization"        # some services want it in Authorization
```

```ts
auth: {
  type:              "ak",
  key:               process.env.MY_SERVICE_KEY,
  destinationHeader: "X-Api-Key",   // omit to use default "X-Key"
}
```

**If you're using Stripe:** get your key from stripe.com → Developers → API Keys.
Use `Authorization` as the `destinationHeader` with the value prefixed `Bearer sk_...`.

---

### `bearer` — Bearer Token (OAuth / static token)

A token you receive after a login or OAuth flow, then send with every
subsequent request. The token proves which **user** is authenticated.

**Header sent:** `Authorization: Bearer <token>`

```ini
[provider.main.auth]
type  = "bearer"
token = "$USER_TOKEN"
```

```ts
auth: { type: "bearer", token: userToken }
```

**Common flow:** user logs in → your login endpoint returns `{ token: "eyJ..." }` →
you store it → every subsequent EngineAPIResolver call includes it automatically.

**If you're using GitHub API:** tokens look like `github_pat_...`. Go to
GitHub → Settings → Developer Settings → Personal Access Tokens → Generate new.
Then `auth: { type: "bearer", token: process.env.GITHUB_TOKEN }`.

---

### `jwt` — JSON Web Token

Identical to `bearer` in terms of the header sent (`Authorization: Bearer <token>`).
The distinction is semantic — `jwt` signals that the token is a self-describing
JWT (which can be decoded to read claims). The engine treats `jwt` and `bearer`
identically at the transport level.

```ts
auth: { type: "jwt", token: jwtString }
```

**When to use instead of `bearer`:** when your codebase wants to be explicit
that the token is a JWT (e.g. for middleware that reads `auth.type` to decide
whether to decode and verify it locally).

---

### `basic` — HTTP Basic Authentication

Combines a username + password into a single base64 string.
The engine does `btoa(username + ":" + password)` and sets the Authorization header.

**Header sent:** `Authorization: Basic <base64(username:password)>`

```ini
[provider.legacy.auth]
type     = "basic"
username = "$LEGACY_USER"
password = "$LEGACY_PASS"
```

```ts
auth: { type: "basic", username: "admin", password: process.env.ADMIN_PASS }
```

**When to use:** older REST APIs and internal services that still use HTTP Basic.
Never send over plain HTTP — always HTTPS.

**If you're using Twilio:** Twilio uses HTTP Basic with your Account SID as
the username and your Auth Token as the password. Both are in your Twilio console.

---

### `hmac` — HMAC Signature

You and the API share a **secret string**. For every request the engine
signs a message (method + URL + timestamp + body) with that secret using
SHA-256 or SHA-512, producing a short hash called a signature.
The server runs the same algorithm with its copy of the secret and compares
the two signatures — if they match, the request is authentic.

**Headers sent:** `X-Timestamp: <unix-ms>`, `X-Signature: <hex-hash>`

```ini
[provider.webhooks.auth]
type      = "hmac"
secret    = "$HMAC_SECRET"
algorithm = "sha-256"      # or "sha-512"
```

```ts
auth: { type: "hmac", secret: process.env.HMAC_SECRET, algorithm: "SHA-256" }
```

**Get the secret from:** the service's webhook or API settings page.
It is often labelled "Signing Secret" or "Webhook Secret".

**If you're using Shopify webhooks:** go to Shopify Partners → your app →
API credentials → Webhook secret. Use `algorithm: "SHA-256"`.

**Replay protection:** every request includes `X-Timestamp` with the current
Unix time in ms. Services can reject requests where the timestamp is more than
a few minutes old, which prevents an attacker from recording a valid request
and replaying it later.

---

### `pnp` — Public / Private Key Pair (Asymmetric Signature)

You generate a **key pair**: a private key (kept secret, never sent over the
wire) and a public key (shared with the service). For every request the engine
signs a message with your private key. The server verifies with your public key.
This is stronger than HMAC because you never share the secret — the private key
never leaves your server.

**Headers sent:** `X-Key: <public-key-id>`, `X-Timestamp: <unix-ms>`,
`X-Signature: <signature>`

**Supported algorithms:**
- `Ed25519` — modern, fast, 64-byte signatures (recommended)
- `RS256` — RSA PKCS#1 v1.5 with SHA-256 (broader compatibility)

```ini
[provider.kastrick.auth]
type      = "pnp"
algorithm = "Ed25519"
```

```ts
import { generateKey } from "@/engine";   // if exposed — or use Web Crypto

// Generate once, store private key securely (env var / secrets manager):
const { privateKey, publicKey } = await crypto.subtle.generateKey(
  { name: "Ed25519" },
  true,  // extractable
  ["sign", "verify"],
);

// In EngineAPIResolver:
auth: {
  type:       "pnp",
  privateKey: privateKey,    // CryptoKey, JWK, or PEM string
  algorithm:  "Ed25519",
}
```

**When to use:** when you control both client and server and want the highest
security without sharing a secret. Common in microservice-to-microservice auth
and financial APIs.

---

## `.EngineAPIConfig` file format

TOML-inspired. One `.api` file per provider group. Place all files in
`.EngineAPIConfig/` at the project root.

```ini
# .EngineAPIConfig/main.api

[provider.main]
endpoint = "https://api.kastrick.com"
method   = "POST"
cache    = "no-cache"

[provider.main.auth]
type      = "hmac"
secret    = "$API_SECRET"   # ← expanded from process.env.API_SECRET
algorithm = "sha-256"

[provider.cdn]
endpoint = "https://cdn.kastrick.com"
method   = "GET"
cache    = "force-cache"

[versions]
V1 = "/api/v1"
V2 = "/api/v2"
```

Version macros are used in endpoint strings with `&NAME&` syntax:

```
endpoint = "https://api.kastrick.com&V1&/users/login"
→ resolves to: https://api.kastrick.com/api/v1/users/login
```

---

## Next.js plugin setup

```js
// next.config.js
const withEngineAPI = require("./src/engine/plugins/engineApiPlugin");

module.exports = withEngineAPI({
  // your existing config
}, {
  configDir:  ".EngineAPIConfig",          // default
  outputFile: ".engine-api-compiled.json", // default
});
```

The plugin runs at build time, reads all `.api` files, substitutes `$ENV_VAR`
values, and writes the compiled JSON. At runtime, `ensureAPIConfig()` loads it
once and caches it in-process.

---

## Runtime usage

```ts
import { EngineAPIResolver, ensureAPIConfig } from "@/engine";

// In a Route Handler / Server Action / getServerSideProps:
const config = await ensureAPIConfig();

const resolver = new EngineAPIResolver({
  endpoint:       "&V1&/users/login",
  provider:       "main",              // which provider block to use
  compiledConfig: config,
});

const response = await resolver.resolveRequest({
  formData: { email: "...", password: "..." },
  pageOverrides: { method: "POST" },
});

if (response.ok) {
  const data = await response.json();
}
```

---

## Anti-fingerprinting

EngineAPI never emits headers that identify the engine:

```
❌ X-Engine-*
❌ X-Powered-By
❌ X-Framework
```

Only these headers are allowed on outgoing requests:

```
✅ Authorization
✅ X-Key
✅ X-Timestamp
✅ X-Signature
✅ Content-Type
✅ Custom headers defined in your .api config
```

This means a server that logs incoming request headers cannot determine that
the client is running the Next.js Engine.

---

## Configuration cascade

Settings override from broad → specific:

```
Global (.api file defaults)
      ↓
Page-level override (passed to EngineAPIResolver constructor)
      ↓
Request-level override (passed to resolveRequest({ pageOverrides }))
```

Deep merging — unspecified levels inherit from the parent. You can override
only the `method` for one request without repeating the endpoint or auth config.
