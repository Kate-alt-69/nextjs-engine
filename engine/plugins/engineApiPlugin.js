// ─────────────────────────────────────────────────────────────────────────────
//  Engine — engineApiPlugin
//
//  Next.js plugin wrapper that compiles .EngineAPIConfig/*.api files into
//  .engine-api-compiled.json at build time, making the resolved config
//  available for EngineAPIResolver without runtime file I/O.
//
//  Usage (next.config.js / next.config.mjs):
//    const withEngineAPI = require("./src/engine/plugins/engineApiPlugin");
//    module.exports = withEngineAPI({ /* your next config */ });
//
//  Options:
//    configDir  — path to .api config folder  (default: ".EngineAPIConfig")
//    outputFile — compiled output path         (default: ".engine-api-compiled.json")
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require("fs");
const path = require("path");

// ── Inline TOML-inspired parser (mirrors EngineAPIConfigParser.ts) ─────────────

function parseScalar(raw) {
	const t = raw.trim();
	if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
	if (t === "true")  return true;
	if (t === "false") return false;
	const n = Number(t);
	if (!Number.isNaN(n)) return n;
	return t;
}

function tokenise(source) {
	const result  = {};
	let   section = "__root__";
	for (const rawLine of source.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const sectionMatch = line.match(/^\[([^\]]+)\]$/);
		if (sectionMatch) {
			section = sectionMatch[1].trim();
			if (!result[section]) result[section] = {};
			continue;
		}
		const kvMatch = line.match(/^([^=]+)=(.+)$/);
		if (kvMatch) {
			if (!result[section]) result[section] = {};
			result[section][kvMatch[1].trim()] = parseScalar(kvMatch[2]);
		}
	}
	return result;
}

function substituteEnv(value) {
	return value.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_, name) => process.env[name] ?? "");
}

function substituteSection(section) {
	const out = {};
	for (const [k, v] of Object.entries(section)) {
		out[k] = typeof v === "string" ? substituteEnv(v) : v;
	}
	return out;
}

function buildAuth(section) {
	const type = String(section["type"] ?? "none");
	switch (type) {
		case "ak":
			return { type: "ak", key: String(section["key"] ?? ""), destinationHeader: String(section["header"] ?? section["destinationHeader"] ?? "X-Key") };
		case "bearer":
			return { type: "bearer", token: String(section["token"] ?? "") };
		case "jwt":
			return { type: "jwt",    token: String(section["token"] ?? "") };
		case "basic":
			return { type: "basic", username: String(section["username"] ?? ""), password: String(section["password"] ?? "") };
		case "hmac":
			return { type: "hmac", secret: String(section["secret"] ?? ""), algorithm: section["algorithm"] ?? "sha-256" };
		case "pnp":
			return { type: "pnp", privateKey: String(section["privateKey"] ?? ""), algorithm: section["algorithm"] ?? "Ed25519" };
		default:
			return { type: "none" };
	}
}

function compileAPIConfig(source) {
	const parsed   = tokenise(source);
	const compiled = { providers: {}, versions: {} };

	for (const [sectionKey, rawSection] of Object.entries(parsed)) {
		if (sectionKey === "__root__") continue;
		const section = substituteSection(rawSection);

		const providerRoot = sectionKey.match(/^provider\.([^.]+)$/);
		if (providerRoot) {
			const name = providerRoot[1];
			if (!compiled.providers[name]) compiled.providers[name] = { endpoint: "" };
			const prov = compiled.providers[name];
			if (section["endpoint"]) prov.endpoint = String(section["endpoint"]);
			if (section["method"])   prov.method   = section["method"];
			if (section["cache"] !== undefined) prov.cache = section["cache"];
			if (section["headers"]) { try { prov.headers = JSON.parse(String(section["headers"])); } catch { /* noop */ } }
			continue;
		}

		const providerAuth = sectionKey.match(/^provider\.([^.]+)\.auth$/);
		if (providerAuth) {
			const name = providerAuth[1];
			if (!compiled.providers[name]) compiled.providers[name] = { endpoint: "" };
			compiled.providers[name].auth = buildAuth(section);
			continue;
		}

		if (sectionKey === "versions") {
			for (const [k, v] of Object.entries(section)) {
				compiled.versions[k] = String(v);
			}
		}
	}

	return compiled;
}

// ── Plugin factory ────────────────────────────────────────────────────────────

function withEngineAPI(nextConfig = {}, pluginOptions = {}) {
	const {
		configDir  = ".EngineAPIConfig",
		outputFile = ".engine-api-compiled.json",
	} = pluginOptions;

	return {
		...nextConfig,

		webpack(webpackConfig, context) {
			// Only compile once per build on the server pass
			if (context.isServer) {
				const absConfigDir = path.join(process.cwd(), configDir);
				let combined       = "";

				if (fs.existsSync(absConfigDir)) {
					const files = fs.readdirSync(absConfigDir).filter((f) => f.endsWith(".api"));
					for (const file of files) {
						combined += fs.readFileSync(path.join(absConfigDir, file), "utf8") + "\n";
					}
				}

				const compiledConfig = compileAPIConfig(combined);
				const outputPath     = path.join(process.cwd(), outputFile);
				fs.writeFileSync(outputPath, JSON.stringify(compiledConfig, null, "\t"), "utf8");
			}

			// Chain with existing webpack config
			if (typeof nextConfig.webpack === "function") {
				return nextConfig.webpack(webpackConfig, context);
			}
			return webpackConfig;
		},
	};
}

module.exports = withEngineAPI;
module.exports.withEngineAPI = withEngineAPI;
