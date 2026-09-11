# Generation 3 private login/search proof

This example exercises the complete Phase C path:

```text
browser client
→ EngineCommand.run()
→ one opaque /_static/command endpoint
→ signed device proof
→ server-only EngineAPIResolver
→ ordinary private HTTP backend
→ hashed, device-bound account session
→ permission-authorized private search
→ sanitized browser result
```

## Files

- `commands.ts` declares backend-credential-free login and private-search commands.
- `nenc.server.ts` owns backend URLs/tokens, session authentication, device verification, and rate policy.
- `sessionStore.ts` is the small in-memory proving store. Replace it with shared persistent storage in production.
- `client.ts` creates the browser device key and configures the NENC transport.
- `PrivateSearchPanel.tsx` is a minimal interactive login/search client.
- `next.config.js` enables NENC command discovery and generation.

Copy `.env.example` to `.env.local` and replace every placeholder. Never expose `PRIVATE_BACKEND_TOKEN` through a `NEXT_PUBLIC_` variable.

The private backend is ordinary HTTP and does not need to understand NENC. It exposes two server-to-server endpoints:

```text
POST /login  { email, password }
→ { id, displayName, permissions }

POST /search { search, accountId }
→ { items }
```

Both requests receive `Authorization: Bearer <PRIVATE_BACKEND_TOKEN>` from the server-only resolver. The command selects only safe account and result fields before responding.

## Render the client

After the plugin generates `.nextjs-engine/nenc/client.ts`, a page can pass the frozen browser manifest into the panel:

```tsx
import { NENC_CLIENT_MANIFEST } from "../.nextjs-engine/nenc/client";
import { PrivateSearchPanel } from "./PrivateSearchPanel";

export default function Page() {
	return <PrivateSearchPanel manifest={NENC_CLIENT_MANIFEST} />;
}
```

Do not import `commands.ts`, `nenc.server.ts`, or private environment variables into a Client Component. The generated route imports the command registry on the server.

The sample keeps the non-exportable device key for the current page lifetime. A production application should persist the `CryptoKey` through a browser store that supports structured cloning, or deliberately require a new login after reload. Never export the private key bytes.

## Security properties proved by CI

- the browser uses one endpoint and opaque command/argument identifiers;
- the login request proves possession of its submitted public device identity;
- only a SHA-256 session-token hash is retained by the application store;
- the raw token appears only in a `Secure`, `HttpOnly`, `SameSite=Strict` cookie;
- private search requires the account permission and the original device key;
- replaying a signed request is rejected;
- copying the cookie to a different device key is rejected, even if it reuses the legitimate key id;
- using the proof for a different origin is rejected;
- backend tokens, hostnames, diagnostic fields, and credential echoes never appear in browser results.
