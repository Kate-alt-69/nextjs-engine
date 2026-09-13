"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
	compileNENCManifest,
	discoverNENCCommands,
} = require("../src/engine/plugins/nencCompiler");

const root = path.resolve(__dirname, "..");
let failures = 0;

function read(relativePath) {
	return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function check(condition, message) {
	if (condition) {
		console.log(`PASS ${message}`);
		return;
	}
	failures += 1;
	console.error(`FAIL ${message}`);
}

const requiredFiles = [
	"app/engine-private-search/page.tsx",
	"app/engine-private-search/login/route.ts",
	"app/engine-private-search/backend/route.ts",
	"app/%5Fstatic/command/route.ts",
	"src/example/private-search/commands.ts",
	"src/example/private-search/demoStore.server.ts",
	"src/example/private-search/nenc.server.ts",
	"src/example/private-search/privateBackend.server.ts",
	".nextjs-engine/nenc/client.ts",
	".nextjs-engine/nenc/server.ts",
];
for (const file of requiredFiles) check(fs.existsSync(path.join(root, file)), `private-search proving file exists: ${file}`);

const commandSource = read("src/example/private-search/commands.ts");
const commands = discoverNENCCommands(commandSource, "src/example/private-search/commands.ts");
const manifest = compileNENCManifest(commands, {
	seed: "private-search-app-smoke",
	buildId: "private-search-app-smoke",
});
check(commands.length === 1, "proving application declares exactly one browser command");
check(commands[0]?.name === "privateSearch", "privateSearch is discovered statically");
check(commands[0]?.auth === "account", "privateSearch requires account authentication");
check(commands[0]?.permissions.includes("catalog.read"), "privateSearch requires catalog permission");
check(manifest.client.commands.privateSearch.id !== "privateSearch", "compiled command selector is opaque");
check(manifest.client.commands.privateSearch.args.query !== "query", "compiled query field is opaque");

const page = read("app/engine-private-search/page.tsx");
const login = read("app/engine-private-search/login/route.ts");
const backend = read("app/engine-private-search/backend/route.ts");
const handler = read("src/example/private-search/nenc.server.ts");
const store = read("src/example/private-search/demoStore.server.ts");
const clientManifest = read(".nextjs-engine/nenc/client.ts");
const serverManifest = read(".nextjs-engine/nenc/server.ts");
const route = read("app/%5Fstatic/command/route.ts");

check(page.includes('EngineCommand.run<{ readonly query: string }, PrivateSearchResult>('), "browser runs privateSearch through EngineCommand");
check(page.includes("EngineDeviceKey.create"), "browser creates a non-exportable device key");
check(page.includes("createNENCTransport(NENC_CLIENT_MANIFEST"), "browser uses the compiled client manifest");
check(!page.includes("PRIVATE_SEARCH_BACKEND_TOKEN"), "client page cannot import the backend credential");
check(!page.includes("demoStore.server"), "client page cannot import the session store");

check(login.includes("HttpOnly; Secure; SameSite=Strict"), "login issues a hardened host-only session cookie");
check(login.includes("isEngineDevicePublicIdentity"), "login accepts only validated public device identities");
check(login.includes("resolveNENCRequestDestinationOrigin"), "login validates the browser-facing destination origin");
check(store.includes("hashNENCSessionToken(token)"), "session store indexes only the token hash");
check(store.includes("sessions.set(tokenHash, session)"), "session records are keyed by the token hash");
check(!store.includes("sessions.set(token, session)"), "session records do not retain the raw token");

check(handler.includes("createNENCDeviceSignatureVerifier"), "dispatcher verifies the device proof");
check(handler.includes("createNENCAccountSessionPolicy"), "dispatcher authenticates the account session");
check(handler.includes("createNENCCommandAPIResolverFactory"), "dispatcher selects a server-only backend resolver");
check(handler.includes("NENCCommandSecurityPolicy"), "privateSearch has command rate policy");
check(backend.includes("Bearer ${PRIVATE_SEARCH_BACKEND_TOKEN}"), "ordinary private backend requires its server credential");
check(commandSource.includes("publicCatalogItems(payload)"), "command returns an explicit sanitized projection");
check(!commandSource.includes("privateBackend.server"), "command declaration remains credential-free");

check(clientManifest.includes('"privateSearch"'), "browser manifest maps the logical call to wire metadata");
check(!clientManifest.includes('"auth"'), "browser manifest omits authentication policy");
check(!clientManifest.includes('"permissions"'), "browser manifest omits permission policy");
check(serverManifest.includes('"auth": "account"'), "server manifest retains authentication policy");
check(route.includes("handler as POST, handler as OPTIONS"), "generated route owns POST and OPTIONS only");
check(!route.includes("PRIVATE_SEARCH_BACKEND_TOKEN"), "generated route contains no backend credential");

if (failures > 0) {
	console.error(`\nGeneration 3 private-search application smoke failed with ${failures} issue(s).`);
	process.exit(1);
}

console.log("\nGeneration 3 live Next.js private-search application smoke passed.");
