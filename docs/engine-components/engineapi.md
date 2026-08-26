# EngineAPI (EA)

EngineAPI provides request configuration, `.api` config parsing, version-macro
replacement, form/body serialization, and several authentication schemes.

The runtime API is intentionally simple: **`EngineAPIResolver` receives one
`EngineAPIConfig`.** It does not accept `provider` or `compiledConfig` constructor
fields. If you load a compiled provider file, select the provider first and pass
that provider config into the resolver.

## Direct usage

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

## Compiled `.EngineAPIConfig`

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

## Request bodies

For methods other than `GET` and `HEAD`:

- plain form-data objects without binary values are JSON-stringified;
- native `FormData` is passed through;
- objects containing `Blob`, `File`, `FileList`, or arrays of binary values are converted to native `FormData`;
- when native FormData is used, EngineAPI removes a manually supplied `Content-Type` header so `fetch` can generate the correct multipart boundary.

`DELETE` may carry a body when `formData` is explicitly supplied.

An empty endpoint throws before `fetch` is called.

## Authentication

### `none`

```ts
auth: { type: "none" }
```

No authentication headers are added.

### `ak`

```ts
auth: {
  type: "ak",
  key: process.env.API_KEY,
  destinationHeader: "X-Api-Key",
}
```

Default destination header is `X-Key`.

### `bearer` / `jwt`

```ts
auth: { type: "bearer", token }
```

Both send:

```text
Authorization: Bearer <token>
```

### `basic`

```ts
auth: {
  type: "basic",
  username,
  password,
}
```

The UTF-8 `username:password` value is base64 encoded and sent through
`Authorization: Basic ...`.

### `hmac`

HMAC requires a **secret**. `key` is optional and is only included when the
remote service needs a key identifier.

```ts
auth: {
  type: "hmac",
  secret: process.env.HMAC_SECRET,
  key: "optional-key-id",
  algorithm: "SHA-256",
}
```

Supported hashes: SHA-256 and SHA-512.

Payload:

```text
METHOD\nURL\nTIMESTAMP\nBODY
```

Headers:

```text
X-Timestamp: <Unix milliseconds>
X-Signature: <hex HMAC>
X-Key: <optional key id>
```

`X-Timestamp` uses `Date.now()` milliseconds, not Unix seconds.

### `pnp`

Asymmetric signing requires `privateKey`; the optional `key` is a public-key id
sent to the remote verifier.

```ts
auth: {
  type: "pnp",
  privateKey,
  key: "optional-public-key-id",
  algorithm: "Ed25519",
}
```

Supported configured algorithms:

- `Ed25519`
- `RS256` (`RSASSA-PKCS1-v1_5` + SHA-256)

`privateKey` may be:

- an already-imported `CryptoKey`;
- a `JsonWebKey` object;
- a JSON string containing a JWK;
- a PKCS#8 PEM string using `BEGIN PRIVATE KEY` / `END PRIVATE KEY`.

EngineAPI does **not** export a `generateKey()` helper. Generate/import keys with
the Web Crypto API or your key-management system.

PNP headers:

```text
X-Timestamp: <Unix milliseconds>
X-Signature: <base64 signature>
X-Key: <optional public-key id>
```

## Version macros

Resolver URLs replace every `&NAME&` token from `versionMacros`:

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

Before `fetch`, EngineAPI removes outgoing header names matching:

- `X-Engine-*`
- `X-Powered-By`
- `X-Framework`

This is a small anti-fingerprinting measure, not an anonymity guarantee.

## `.api` parser notes

Provider roots use `[provider.NAME]`; auth blocks use
`[provider.NAME.auth]`; versions use `[versions]`.

```ini
[provider.main]
endpoint = "https://api.example.com"
method = "POST"
headers = "{\"X-Client\":\"web\"}"

[provider.main.auth]
type = "bearer"
token = "$USER_TOKEN"
```

The optional `headers` field is JSON text. Invalid optional header JSON is
ignored rather than aborting the entire config compilation.
