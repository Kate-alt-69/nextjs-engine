# Generation 3 Phase C — Network and credential runtime

> Branch: `3_gen_main`  
> Status: dispatcher/auth foundation in progress

Phase C owns the secure application/network layer described by the Gen 3 master plan: EngineCookies, NENC, EngineCORS, command authorization, replay protection, device binding, and the EngineAPIResolver bridge.

## Completed foundation

### EngineCookies + Trust List

EngineCookies currently provides a metadata-only index plus granular trust-policy primitives. Raw/sealed credential payloads do not belong in `EngineCookieIndex`. CORS permission does not imply cookie or command permission, and wildcard origins may grant CORS only.

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

Signature verification is an explicit hook because Phase C still needs the final device-key/EngineCookie proof format. Enabling a verifier makes signature validation happen before authentication/execution.

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

1. sealed EngineCookie storage and device-key proof;
2. concrete session/auth policy helpers for account commands;
3. signature format + command-specific replay policy;
4. NENC plugin integration that emits manifests and the single route;
5. ordinary/private backend proving flows through EngineAPIResolver;
6. real private login/search proving application;
7. Phase D debug/security inspection surfaces consuming these artifacts.
