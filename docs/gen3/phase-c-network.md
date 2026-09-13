# Generation 3 Phase C — Network and credential runtime

> Branch: `main-3`  
> Status: complete — secure dispatcher, portable proof, real Next.js application, and security regressions

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

### NENC build plugin

NENC integration is explicit. The combined Next.js plugin discovers inline `EngineCommand.create()` and `registerEngineCommand()` declarations with the TypeScript AST, emits separate frozen client/server manifest modules, and generates exactly one App Router route:

```js
const withEngine = require("nextjs-engine/plugin");

module.exports = withEngine({}, {
	nenc: {
		commandFiles: ["src/commands.ts"],
		handlerModule: "src/nenc.server.ts",
		seed: process.env.ENGINE_NENC_SEED,
		buildId: process.env.VERCEL_GIT_COMMIT_SHA,
	},
});
```

The generated artifacts are `.nextjs-engine/nenc/client.ts`, `.nextjs-engine/nenc/server.ts`, a non-public `manifest.json`, and `app/%5Fstatic/command/route.ts`. Next.js decodes the escaped segment into the public `/_static/command` URL; an `app/_static` folder would instead be treated as a private folder and omitted from routing. The handler module default export receives the frozen server manifest and returns the dispatcher route handler:

```ts
export default function createHandler(manifest: NENCServerManifest) {
	return createNENCDispatcher({
		manifest,
		api,
		authenticate: accountSessions.authenticate,
		authorize: accountSessions.authorize,
		commandSecurity,
		verifySignature,
	});
}
```

Command name, `run`, `auth`, permissions, and input field names must be static literals; the command definition must be inline and contain `execute`. Object spreads and dynamic security metadata fail the build. The compiler reads metadata only and never evaluates command code. Existing hand-written routes are never overwritten, and server artifacts cannot be written under `public/`.

Replay windows and rate limits deliberately stay out of generated declarations and manifests. Configure them as server-only `NENCCommandSecurityPolicy` rules so storage and principal-aware rate keys remain runtime capabilities rather than browser-visible build metadata.

### NENC browser transport

`createNENCTransport()` maps logical arguments onto compiled body keys, emits the compiled selector/nonce/timestamp headers, generates a cryptographically random nonce, uses same-origin credentials by default, and POSTs only to `/_static/command`.

## Single dispatcher

`createNENCDispatcher()` is the server route-handler factory. Applications can bind the same handler to `POST` and `OPTIONS` at `app/%5Fstatic/command/route.ts`; no per-command routes are created.

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
per-command rate policy
↓
permission authorization
↓
sanitized API resolver factory
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

## Account session policy

`createNENCAccountSessionPolicy()` supplies fail-closed authentication and authorization for commands declaring `auth: "account"`. Connect both policy functions to the dispatcher:

```ts
import {
	createNENCAccountSessionPolicy,
	createNENCDispatcher,
} from "nextjs-engine/server";

const accountSessions = createNENCAccountSessionPolicy({
	async resolveSession(tokenHash, context) {
		return sessionStore.findActiveByTokenHash(tokenHash, context.commandName);
	},
});

export const handler = createNENCDispatcher({
	manifest,
	api,
	authenticate: accountSessions.authenticate,
	authorize: accountSessions.authorize,
});
```

The default cookie name is `__Host-engine-session`. Issue it as a host-only `Secure`, `HttpOnly`, `SameSite` cookie with `Path=/`; store only a SHA-256 hash of a cryptographically random token server-side. The policy rejects duplicate cookies and malformed tokens, then provides the resolver with the hash and sanitized command metadata rather than the raw request or cookie.

Session records require an id, account subject, and expiry. They can additionally restrict permissions, commands, origins, activation time, revocation state, and a device key id. Device-bound records authenticate only when the dispatcher has already verified the attached proof and its decoded key id matches the session. Successful command execution receives a frozen `NENCAccountPrincipal` through `execute({ principal })`; raw credentials are never added to that principal.

## Command replay and rate policy

`NENCCommandSecurityPolicy` attaches stronger replay windows and fixed-window rate budgets to selected logical commands. Authentication runs before rate-key resolution, allowing account/session identity to key the budget without trusting a client-supplied identifier:

```ts
const privateSearchRate = new NENCRateLimiter({
	limit: 30,
	windowMs: 60_000,
	store: sharedAtomicRateStore,
});

const commandSecurity = new NENCCommandSecurityPolicy({
	rules: {
		privateSearch: {
			replay: new NENCReplayGuard({
				maxClockSkewMs: 15_000,
				store: sharedReplayStore,
			}),
			rate: {
				limiter: privateSearchRate,
				key: ({ principal }) => (principal as NENCAccountPrincipal).sessionId,
			},
		},
	},
});

createNENCDispatcher({ manifest, api, commandSecurity });
```

A rule's replay guard replaces the default guard for that command and namespaces nonce claims by logical command. A configured rate rule fails closed when its key is missing/invalid or its store fails. Rejections use the generic response body with status `429` and `Retry-After`; replay failures remain generic `409` responses. The included memory stores are single-process implementations. Distributed and serverless deployments should supply atomic shared stores—`NENCRateLimitStore.consume()` must increment and return the count as one operation.

## Ordinary and private backend proving flows

The dispatcher accepts an `EngineAPIResolver` or a context-aware resolver factory. The factory runs only after authentication, rate policy, and permission authorization succeed. Keep private backend credentials in the server-only handler module and use `createNENCCommandAPIResolverFactory()` to select a narrowly scoped resolver from sanitized command context:

```ts
import { createNENCCommandAPIResolverFactory } from "nextjs-engine/server";

const api = createNENCCommandAPIResolverFactory({
	resolve({ commandName, principal }) {
		if (commandName === "catalog.publicSearch") {
			return {
				endpoint: "https://api.example.com/search",
				method: "POST",
				auth: { type: "none" },
			};
		}
		if (commandName === "catalog.privateSearch" && principal) {
			return {
				endpoint: process.env.PRIVATE_SEARCH_URL,
				method: "POST",
				auth: { type: "bearer", token: process.env.PRIVATE_SEARCH_TOKEN },
			};
		}
		throw new Error("No backend resolver is configured for this command.");
	},
});

return createNENCDispatcher({
	manifest,
	authenticate: accountSessions.authenticate,
	authorize: accountSessions.authorize,
	api,
});
```

The top-level factory context and permission list are frozen. Its only fields are the logical command name, auth mode, permissions, authenticated principal, normalized origin, and abort signal. It intentionally excludes the raw `Request`, cookie, signature, timestamp, nonce, and command input, so backend selection cannot accidentally retain browser credentials or make policy decisions from unvalidated input. Returning an `EngineAPIConfig` creates an isolated resolver for that command request; an existing `EngineAPIResolver` can also be returned when intentional sharing is safe.

Command declarations stay credential-free and use the resolver selected by the server:

```ts
EngineCommand.create("catalog.privateSearch", {
	run: "server",
	auth: "account",
	permissions: ["catalog.read"],
	input: { search: "string" },
	async execute({ input, api, principal }) {
		const response = await api.resolveRequest({ input });
		const payload = await response.json();
		return {
			account: (principal as NENCAccountPrincipal).subject,
			items: payload.items.map(({ id, title }) => ({ id, title })),
		};
	},
});
```

For ordinary HTTP requests, explicit `input` is serialized as the request body and takes precedence over the legacy `formData` fallback, matching APIStatic behavior. The remote backend does not need to know NENC and may be implemented in any stack.

Commands are responsible for returning an intentional public result. Returning a backend `Response` directly preserves its response semantics, while parsing it and returning a selected object—as above—prevents private fields, diagnostic headers, or credential echoes from reaching the browser. Command files must remain server-only and must not import private credentials into Client Components.

## Private login/search proving application

[`examples/gen3-private-search`](../../examples/gen3-private-search) closes Phase C with a runnable application path rather than an isolated dispatcher fixture. Its browser client creates a non-exportable device key, signs `account.login` through `EngineCommand.run()`, receives a host-only session cookie, and then executes the permission-protected `catalog.privateSearch` command through the same opaque endpoint.

The server handler owns the private backend URL and bearer token. Login credentials reach the ordinary HTTP backend only through a server-scoped resolver. The application retains only the SHA-256 hash of the random session token and binds that session to the submitted public device identity. Private search adds the authenticated account id server-side and whitelists only result `id` and `title` fields before responding.

The end-to-end CI proof verifies:

- invalid credentials issue no session;
- the session token appears only in a `Secure`, `HttpOnly`, `SameSite=Strict` cookie;
- replaying an identical signed request returns `409` before backend access;
- copying the cookie to another device key returns `401` before backend access, even when it reuses the legitimate key id;
- signing for a different destination origin returns `401` before backend access;
- the browser calls only `/_static/command` and never the private backend directly;
- backend tokens, internal hostnames, ranking fields, and credential echoes do not enter the browser result.

The included store and rate limiters are intentionally in-memory for a focused proof. Production multi-instance deployments must replace them with shared persistent and atomic stores. The sample keeps its non-exportable `CryptoKey` for the page lifetime; production clients should persist it through a browser store supporting structured cloning or require a new login after reload.

## Real private-search application

The `/engine-private-search` proving application closes the Phase C integration gate. Its login route registers a browser-created public device identity, stores only the session-token hash, and issues a host-only `Secure`, `HttpOnly`, `SameSite=Strict` cookie. The browser then signs `EngineCommand.run("privateSearch")` with its non-exportable key and sends one opaque `/_static/command` request.

The dispatcher verifies origin, replay data, device proof, account session, `catalog.read`, and the command rate policy before creating the private backend resolver. The ordinary HTTP backend receives a server-only bearer credential. The command returns only `id`, `title`, and `category`; database ranking, partition, host, query-plan, and credential-echo fields are discarded.

Automated browser coverage copies the cookie into a second browser context and proves that it fails without the original device key. It also verifies wrong-origin rejection, opaque wire ids, an HttpOnly cookie, and absence of backend credentials/internals from the browser response. See [`private-search-example.md`](./private-search-example.md) for the runnable flow and production substitutions.

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

## Next implementation phase

Phase C is complete. Phase D begins with the [used-feature compatibility manifest](./phase-d-hardening.md), compatibility fallback compiler, older-browser rendering path, compatibility dialog, and development-only `/_engine/debug` inspection surface.
