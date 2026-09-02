# Generation 3 Phase C — Network and credential runtime

> Branch: `3_gen_main`  
> Status: dispatcher, sealed credential, and device-proof foundation in progress

Phase C owns the secure application/network layer described by the Gen 3 master plan: EngineCookies, NENC, EngineCORS, command authorization, replay protection, device binding, and the EngineAPIResolver bridge.

## Completed foundation

### EngineCookies + Trust List

EngineCookies provides a metadata-only index, an AES-256-GCM sealed vault, and granular trust-policy primitives. Raw and sealed credential payloads do not belong in `EngineCookieIndex`; the encrypted record store is separate and keyed by an opaque storage id. Credential metadata is authenticated as AES-GCM additional data, so changing the owner, alias, binding, command list, or device identity invalidates the record.

`EngineCookieVault.use()` releases plaintext only to its supplied operation callback after origin, command, expiry, Trust List, and device-binding checks pass. Keep the vault instance in a controlled runtime capability; ordinary components should receive command handles, not the vault. Native browser cookies remain supported and EngineCookies is an additional controlled store, not a mandatory replacement.

CORS permission does not imply cookie or command permission, and wildcard origins may grant CORS only.

### Device-key binding

`EngineDeviceKey` creates a non-exportable ECDSA P-256 private key through Web Crypto and exposes only its public JWK identity. Device proofs sign the request method, target, destination origin, body hash, timestamp, nonce, and optional environment hash. A copied sealed credential therefore cannot be used with a different private key.

`createNENCTransport()` can attach the proof through the build-specific signature header. `createNENCDeviceSignatureVerifier()` resolves the registered public identity and verifies the exact raw request context before authentication and command execution. Timestamp-window and nonce replay enforcement remain the dispatcher's responsibility, so captured signed requests are rejected by `NENCReplayGuard` before the verifier runs.

Binding modes are:

- `none`: no device proof;
- `device-key`: registered signing key required;
- `device-key+environment`: signing key plus matching environment hash;
- `strict`: reserved strongest binding, currently enforcing the same cryptographic requirements as `device-key+environment`.

### EngineCommand + typed input

Developer commands use readable logical names and typed input descriptors. Schema validation executes before custom validation/command execution. Undeclared fields are discarded, dangerous prototype names are rejected, and malformed values fail generically.

```ts
EngineCommand.create("privateSearch", {
	run: "server",
	auth: "account",
	input: {
		search: { type: "string", maxLength: 120 },
		page: { type: "number", optional: true, min: 1, max: 50 },
	},
	async execute({ input, api }) {
		return api.resolveRequest({ input });
	},
});
```

### Opaque NENC wire compiler

The build compiler maps logical commands, arguments, and protocol header names to build-specific opaque identifiers. A different build id changes the mapping. These IDs are transport obfuscation only, never authorization credentials.

The only command endpoint remains:

```text
/_static/command
```

Client and server manifests are split so the browser receives only what it needs to encode requests while the server retains reverse mappings and command policy metadata.

### NENC browser transport

`createNENCTransport()` maps logical arguments onto compiled body keys, emits the compiled selector/nonce/timestamp headers, generates a cryptographically random nonce, uses same-origin credentials by default, and POSTs only to `/_static/command`.

## Single dispatcher

`createNENCDispatcher()` is the server route-handler factory. Applications can bind the same handler to `POST` and `OPTIONS` at `app/_static/command/route.ts`; no per-command routes are created.

The dispatcher currently enforces this order:

```text
method / CORS
↓
opaque selector resolution
↓
Trust List for cross-origin commands
↓
timestamp + nonce replay guard
↓
request body size limit
↓
opaque argument decoding
↓
optional signature verification
↓
command authentication
↓
permission authorization
↓
EngineCommand registry
↓
EngineAPIResolver
↓
filtered Response / JSON result
```

Security defaults fail closed:

- cross-origin execution requires configured CORS and Trust List authorization;
- non-anonymous commands require an authenticator;
- commands declaring permissions require an authorizer;
- duplicate/stale nonce requests are rejected before execution;
- unknown command ids and unknown argument ids fail generically;
- the dispatcher never returns a command list/schema.

Replay storage is replaceable through `NENCReplayStore`. The included memory store is suitable for a single process; distributed/serverless deployments should provide shared persistence when replay guarantees must span instances.

Signature verification remains an explicit hook. The included device-proof verifier provides the standard EngineCookie/NENC format, while applications resolve public identities from their own account/session store. Enabling a verifier makes signature validation happen before authentication/execution.

## EngineCORS

The server-only CORS helper provides exact-origin handling, preflight responses, `Vary: Origin`, allowed method/header configuration, and rejects credentialed wildcard CORS.

## Phase C invariants

```text
ONE network endpoint
/_static/command

No command list endpoint
No schema endpoint
No route-name endpoint
No production introspection

Compiled ids are obfuscation only
Authorization still comes from:
session + EngineCookie + origin + trust + nonce + signature + rate policy
```

## Remaining implementation order

1. concrete session/auth policy helpers for account commands;
2. command-specific replay and rate policy;
3. NENC plugin integration that emits manifests and the single route;
4. ordinary/private backend proving flows through EngineAPIResolver;
5. real private login/search proving application;
6. Phase D debug/security inspection surfaces consuming these artifacts.
