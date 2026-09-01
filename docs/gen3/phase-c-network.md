# Generation 3 Phase C — Network and credential runtime

> Branch: `3_gen_main`  
> Status: foundation in progress

Phase C owns the secure application/network layer described by the Gen 3 master plan: EngineCookies, NENC, EngineCORS, command authorization, replay protection, device binding, and the EngineAPIResolver bridge.

## Foundation now established

### EngineCookies contracts

EngineCookies distinguishes native browser cookies from Engine-managed credential metadata. The first Gen 3 layer intentionally stores **metadata only**:

- logical alias;
- opaque storage id;
- owner and creator;
- purpose;
- creation/expiry times;
- binding mode;
- authorized commands.

Raw or sealed credential payloads do not belong in `EngineCookieIndex`.

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

### Trust list

Trust is granular. CORS permission does not imply cookie or command permission.

```ts
const trust = EngineCookies.trust({
	rules: [{
		origin: "https://app.example.com",
		cors: true,
		commands: ["account.info"],
		cookies: [{
			cookie: "account-session",
			actions: ["use"],
			commands: ["account.info"],
		}],
	}],
});
```

A wildcard origin may grant CORS only. Privileged cookie or command access requires an exact origin.

### EngineCommand foundation

Commands now have a stable developer-facing registration API while transport remains separate:

```ts
const privateSearch = EngineCommand.create("privateSearch", {
	run: "server",
	auth: "account",
	validate(input) {
		if (!input || typeof input !== "object") throw new Error("Invalid input");
		return input as { search: string };
	},
	async execute({ input, api }) {
		return api.resolveRequest({ input });
	},
});
```

`EngineCommand.run()` does not fall back to direct local execution. Until the NENC transport is configured it fails closed. This prevents a client call from accidentally bypassing the command dispatcher.

Production command introspection is also disabled. The later `/_static/command` dispatcher will resolve compiled opaque ids internally without exposing a command-list endpoint.

### EngineCORS

The server-only CORS helper provides exact-origin handling, preflight responses, `Vary: Origin`, allowed method/header configuration, and rejects credentialed wildcard CORS.

## Invariants for the remaining Phase C work

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

## Next implementation order

1. build-specific NENC wire manifest and opaque command/argument ids;
2. input-schema validation and compiled argument mapping;
3. the single `/_static/command` dispatcher;
4. trust/auth/EngineCookie authorization gates;
5. replay nonce/timestamp verification;
6. EngineAPIResolver/private-service bridge;
7. sealed EngineCookie storage and device-key proof;
8. real private login/search proving application;
9. Phase D debug/security inspection surfaces consuming these artifacts.
