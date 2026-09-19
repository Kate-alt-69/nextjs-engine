# Generation 3 private-search proving application

The application at `/engine-private-search` is the final Phase C integration proof. It joins the independent EngineCookie, device-proof, NENC, account-session, command-policy, and EngineAPIResolver pieces in one real browser flow.

## Run it

```bash
npm run dev
```

Open `http://localhost:3000/engine-private-search` and use the displayed demo credentials:

```text
email: kate@example.com
password: engine-demo
```

The account and catalog are intentionally fake. The in-memory session/device registry is a proving store, not a production database or multi-instance session implementation.

## Actual request path

```text
POST /engine-private-search/login
  → validate account + public device identity
  → store SHA-256(session token), never the raw token
  → issue Secure + HttpOnly + SameSite=Strict cookie

EngineCommand.run("privateSearch", { query })
  → sign request with non-exportable P-256 device key
  → POST /_static/command using compiled selector/argument ids
  → origin + timestamp + nonce checks
  → device proof verification
  → account session + catalog.read authorization
  → command rate policy
  → sanitized EngineAPIResolver factory context
  → ordinary private HTTP backend with server-only bearer credential
  → command projects private records into public result fields
```

Login is a normal authentication operation. Browser commands still use exactly one NENC endpoint; the private backend route is contacted by the server-side resolver, not by browser application code.

## Security boundaries proved

- The session cookie is host-only, `Secure`, `HttpOnly`, and `SameSite=Strict`.
- The session store keys records by a one-way token hash.
- The browser owns a non-exportable device private key and sends only its public identity during login.
- Copying the session cookie into a different browser context fails because the new context cannot produce the registered device signature.
- A wrong-origin command request is rejected before command or backend execution.
- The client wire body and protocol headers use build-derived opaque ids.
- Authentication policy and permissions exist only in the server manifest.
- The private backend bearer token stays in a `server-only` module and the outbound resolver request.
- The command removes database score, partition, host, query-plan, and credential-echo fields before returning JSON.
- The private backend is ordinary HTTP and has no dependency on NENC.

The Playwright regression in `tests/browser/gen3-private-search.spec.ts` exercises the real page, login route, generated command route, private backend, copied-cookie rejection, origin rejection, and response sanitization in Chromium, Firefox, and WebKit.

## Production substitutions

Set these environment variables when replacing the local backend:

```text
ENGINE_NENC_SEED
ENGINE_PRIVATE_SEARCH_URL
ENGINE_PRIVATE_SEARCH_TOKEN
```

Replace `demoStore.server.ts` with durable shared session/device storage. Distributed deployments also need shared atomic replay and rate-limit stores. Do not reuse the included demo password or development backend token.
