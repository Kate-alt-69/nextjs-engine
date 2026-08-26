// ─────────────────────────────────────────────────────────────────────────────
//  Engine — engineApiPlugin
//
//  Compiles both EngineAPI provider configuration and APIStatic .route files.
//  Provider config is written to .engine-api-compiled.json. Static endpoint
//  programs under data/endpoint are compiled to public/_static/endpoint.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs");
const path = require("path");
const { compileAPIStaticDir } = require("./apiStaticCompiler");

function parseScalar(raw) {
	const value = raw.trim();
	if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
	if (value === "true") return true;
	if (value === "false") return false;
	const numericValue = Number(value);
	if (!Number.isNaN(numericValue)) return numericValue;
	return value;
}

function tokenise(source) {
	const result = {};
	let section = "__root__";
	for (const rawLine of source.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const sectionMatch = line.match(/^\[([^\]]+)\]$/);
		if (sectionMatch) {
			section = sectionMatch[1].trim();
			if (!result[section]) result[section] = {};
			continue;
		}
		const keyValueMatch = line.match(/^([^=]+)=(.+)$/);
		if (!keyValueMatch) continue;
		if (!result[section]) result[section] = {};
		result[section][keyValueMatch[1].trim()] = parseScalar(keyValueMatch[2]);
	}
	return result;
}

function substituteEnv(value) {
	return value.replace(/\$\{([A-Z_][A-Z0-9_]*)\}|\$([A-Z_][A-Z0-9_]*)/g, (_, bracedName, plainName) => {
		const name = bracedName || plainName;
		return name ? process.env[name] ?? "" : "";
	});
}

function substituteSection(section) {
	const output = {};
	for (const [key, value] of Object.entries(section)) {
		output[key] = typeof value === "string" ? substituteEnv(value) : value;
	}
	return output;
}

function normalizeHmacAlgorithm(value) {
	return String(value ?? "SHA-256").toUpperCase().replace(/_/g, "-") === "SHA-512"
		? "SHA-512"
		: "SHA-256";
}

function normalizeAsymmetricAlgorithm(value) {
	return String(value ?? "Ed25519").toUpperCase() === "RS256" ? "RS256" : "Ed25519";
}

function buildAuth(section) {
	const type = String(section.type ?? "none").toLowerCase();
	switch (type) {
		case "ak":
			return {
				type: "ak",
				key: String(section.key ?? ""),
				destinationHeader: String(section.header ?? section.destinationHeader ?? "X-Key"),
			};
		case "bearer":
			return { type: "bearer", token: String(section.token ?? "") };
		case "jwt":
			return { type: "jwt", token: String(section.token ?? "") };
		case "basic":
			return {
				type: "basic",
				username: String(section.username ?? ""),
				password: String(section.password ?? ""),
			};
		case "hmac":
			return {
				type: "hmac",
				key: String(section.key ?? ""),
				secret: String(section.secret ?? ""),
				algorithm: normalizeHmacAlgorithm(section.algorithm),
			};
		case "pnp":
			return {
				type: "pnp",
				key: String(section.key ?? ""),
				privateKey: String(section.privateKey ?? ""),
				algorithm: normalizeAsymmetricAlgorithm(section.algorithm),
			};
		default:
			return { type: "none" };
	}
}

function compileAPIConfig(source) {
	const parsed = tokenise(source);
	const compiled = { providers: {}, versions: {} };

	for (const [sectionKey, rawSection] of Object.entries(parsed)) {
		if (sectionKey === "__root__") continue;
		const section = substituteSection(rawSection);

		const providerRoot = sectionKey.match(/^provider\.([^.]+)$/);
		if (providerRoot) {
			const providerName = providerRoot[1];
			if (!compiled.providers[providerName]) compiled.providers[providerName] = { endpoint: "" };
			const provider = compiled.providers[providerName];
			if (section.endpoint) provider.endpoint = String(section.endpoint);
			if (section.method) provider.method = String(section.method);
			if (section.cache !== undefined) provider.cache = String(section.cache);
			if (section.headers) {
				try {
					const parsedHeaders = JSON.parse(String(section.headers));
					if (parsedHeaders && typeof parsedHeaders === "object" && !Array.isArray(parsedHeaders)) {
						provider.headers = Object.fromEntries(
							Object.entries(parsedHeaders).map(([key, value]) => [key, String(value)]),
						);
					}
				} catch {
					// Invalid optional headers JSON is ignored.
				}
			}
			continue;
		}

		const providerAuth = sectionKey.match(/^provider\.([^.]+)\.auth$/);
		if (providerAuth) {
			const providerName = providerAuth[1];
			if (!compiled.providers[providerName]) compiled.providers[providerName] = { endpoint: "" };
			compiled.providers[providerName].auth = buildAuth(section);
			continue;
		}

		if (sectionKey === "versions") {
			for (const [key, value] of Object.entries(section)) compiled.versions[key] = String(value);
		}
	}
	return compiled;
}

function compileProviderConfig(projectRoot, configDir, outputFile) {
	const absoluteConfigDir = path.resolve(projectRoot, configDir);
	let combinedSource = "";
	if (fs.existsSync(absoluteConfigDir)) {
		const files = fs.readdirSync(absoluteConfigDir)
			.filter((file) => file.endsWith(".api"))
			.sort();
		for (const file of files) {
			combinedSource += `${fs.readFileSync(path.join(absoluteConfigDir, file), "utf8")}\n`;
		}
	}
	const outputPath = path.resolve(projectRoot, outputFile);
	fs.writeFileSync(outputPath, JSON.stringify(compileAPIConfig(combinedSource), null, "\t"), "utf8");
}

function withEngineAPI(nextConfig = {}, pluginOptions = {}) {
	const {
		configDir = ".EngineAPIConfig",
		outputFile = ".engine-api-compiled.json",
		endpointDir = "data/endpoint",
		staticOutputDir = "public/_static/endpoint",
	} = pluginOptions;
	const projectRoot = process.cwd();

	const compileEngineAPI = () => {
		compileProviderConfig(projectRoot, configDir, outputFile);
		compileAPIStaticDir({
			projectRoot,
			endpointDir,
			outputDir: staticOutputDir,
		});
	};

	// next.config is evaluated for both Turbopack and webpack. Compiling here
	// makes APIStatic available to `next dev` without relying on a webpack hook.
	compileEngineAPI();

	return {
		...nextConfig,

		webpack(webpackConfig, context) {
			if (context.isServer) compileEngineAPI();
			if (typeof nextConfig.webpack === "function") {
				return nextConfig.webpack(webpackConfig, context);
			}
			return webpackConfig;
		},
	};
}

module.exports = withEngineAPI;
module.exports.withEngineAPI = withEngineAPI;
module.exports.compileAPIConfig = compileAPIConfig;
module.exports.compileAPIStaticDir = compileAPIStaticDir;
