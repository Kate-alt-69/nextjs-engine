# Generation 3 Phase C — Network and credential runtime

> Branch: `3_gen_main`  
> Status: wire/runtime foundation in progress

Phase C owns the secure application/network layer described by the Gen 3 master plan: EngineCookies, NENC, EngineCORS, command authorization, replay protection, device binding, and the EngineAPIResolver bridge.

## EngineCookies foundation

EngineCookies currently provides metadata/index and granular trust-policy primitives. The index stores logical alias, opaque storage id, ownership, purpose, expiry, binding mode, and authorized commands. Raw or sealed credential payloads do not belong in `EngineCookieIndex`.

```ts
const index = EngineCookies.createIndex();

index.register({
	alias: "account-session",
	owner: "https://api.example.com",
	creator: "account.login",
	binding: "device-key",
	commands: ["account.info", "account.logout"],
});
```

Trust is granular. CORS permission does not imply cookie or command permission. Wildcard origins may grant CORS only; privileged access requires an exact origin.

## EngineCommand + typed input

Developer-facing command names stay readable:

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

Schema validation executes before custom validation/command execution. Undeclared input fields are discarded, dangerous prototype names are rejected, and malformed values fail with a generic invalid-input error.

`EngineCommand.run()` never falls back to direct execution when NENC transport is unavailable.

## NENC wire compiler

The build compiler maps logical command/input names onto build-specific opaque identifiers. The endpoint remains exactly:

```text
/_static/command
```

Conceptually:

```text
privateSearch
	→ cQx9...

search
	→ aL7p...

page
	→ aN2k...

selector header
	→ x-hJ4...
```

IDs are derived from a build seed/build id with HMAC-SHA-256 and collision checking. A different build id produces a different mapping. These identifiers are **obfuscation only**, never authorization credentials.

The compiler emits separate manifests:

- client manifest: logical command → opaque id/argument names;
- server manifest: opaque id → logical command/runtime/auth/permissions and reverse argument mapping.

There is no command-list/help/schema endpoint.

## Browser transport

`createNENCTransport()` accepts the compiled client manifest and:

- POSTs only to `/_static/command`;
- maps logical arguments to opaque body keys;
- emits the compiled selector header;
- generates a cryptographically random nonce per request;
- emits a timestamp;
- defaults credentials to same-origin;
- returns generic transport errors instead of exposing command metadata.

The next dispatcher/replay layer will verify nonce/timestamp/signature server-side. Merely sending these values is not security by itself.

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

1. single `/_static/command` dispatcher and opaque argument decoder;
2. trust/auth/EngineCookie authorization gates;
3. nonce/timestamp replay verification and signing policy;
4. EngineAPIResolver/private-service bridge;
5. sealed EngineCookie storage and device-key proof;
6. Engine plugin integration that emits the NENC artifacts/route;
7. real private login/search proving application;
8. Phase D debug/security inspection surfaces consuming these artifacts.
