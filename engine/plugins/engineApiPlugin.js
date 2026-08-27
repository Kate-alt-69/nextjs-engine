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

const WATCH_STATE_KEY = Symbol.for("nextjs-engine.engine-api-watch-state");

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

function resolveManifestPath(outputDirectory, staticManifestFile) {
	const manifestName = String(staticManifestFile || "").trim();
	if (!manifestName) throw new Error("[engine:api] staticManifestFile cannot be empty.");
	if (path.isAbsolute(manifestName)) {
		throw new Error("[engine:api] staticManifestFile must stay inside staticOutputDir.");
	}

	const resolvedOutput = path.resolve(outputDirectory);
	const manifestPath = path.resolve(resolvedOutput, manifestName);
	const relative = path.relative(resolvedOutput, manifestPath);
	if (!relative || relative === "." || relative.startsWith("..") || path.isAbsolute(relative)) {
		throw new Error("[engine:api] staticManifestFile must name a file inside staticOutputDir.");
	}
	return manifestPath;
}

function writeAPIStaticManifest(projectRoot, staticOutputDir, staticManifestFile, compiledRoutes) {
	const outputDirectory = path.resolve(projectRoot, staticOutputDir);
	const manifestPath = resolveManifestPath(outputDirectory, staticManifestFile);
	const endpoints = Object.create(null);

	for (const route of compiledRoutes) {
		endpoints[route.route] = {
			hash: route.hash,
			operations: [...route.operations],
		};
	}

	fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
	const nonce = `${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	const temporaryPath = `${manifestPath}.tmp-${nonce}`;
	const backupPath = `${manifestPath}.backup-${nonce}`;
	let backedUp = false;
	let installed = false;

	try {
		fs.writeFileSync(
			temporaryPath,
			`${JSON.stringify({ version: 1, endpoints }, null, "\t")}\n`,
			"utf8",
		);
		if (fs.existsSync(manifestPath)) {
			fs.renameSync(manifestPath, backupPath);
			backedUp = true;
		}
		fs.renameSync(temporaryPath, manifestPath);
		installed = true;
	} catch (reason) {
		if (!installed && backedUp && !fs.existsSync(manifestPath) && fs.existsSync(backupPath)) {
			fs.renameSync(backupPath, manifestPath);
			backedUp = false;
		}
		throw reason;
	} finally {
		if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
		if (installed && backedUp && fs.existsSync(backupPath)) {
			fs.rmSync(backupPath, { force: true });
		}
	}
}

function swapArtifactDirectory(stagingDirectory, outputDirectory) {
	const backupDirectory = `${outputDirectory}.backup-${process.pid}-${Date.now().toString(36)}`;
	const hadExistingOutput = fs.existsSync(outputDirectory);
	let backedUp = false;
	let installed = false;

	try {
		if (hadExistingOutput) {
			fs.renameSync(outputDirectory, backupDirectory);
			backedUp = true;
		}
		fs.renameSync(stagingDirectory, outputDirectory);
		installed = true;
	} catch (reason) {
		if (!installed) {
			if (fs.existsSync(outputDirectory)) fs.rmSync(outputDirectory, { recursive: true, force: true });
			if (backedUp && fs.existsSync(backupDirectory)) {
				fs.renameSync(backupDirectory, outputDirectory);
				backedUp = false;
			}
		}
		throw reason;
	} finally {
		if (fs.existsSync(stagingDirectory)) fs.rmSync(stagingDirectory, { recursive: true, force: true });
		if (installed && backedUp && fs.existsSync(backupDirectory)) {
			fs.rmSync(backupDirectory, { recursive: true, force: true });
		}
	}
}

function compileAPIStaticArtifacts(projectRoot, endpointDir, staticOutputDir, staticManifestFile) {
	const outputDirectory = path.resolve(projectRoot, staticOutputDir);
	// Validate containment before compiling anything so bad config cannot touch
	// the last-known-good output tree.
	resolveManifestPath(outputDirectory, staticManifestFile);

	const stagingDirectory = `${outputDirectory}.artifact-staging-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	fs.rmSync(stagingDirectory, { recursive: true, force: true });

	try {
		const compiledRoutes = compileAPIStaticDir({
			projectRoot,
			endpointDir,
			outputDir: stagingDirectory,
		});
		fs.mkdirSync(stagingDirectory, { recursive: true });
		writeAPIStaticManifest(projectRoot, stagingDirectory, staticManifestFile, compiledRoutes);
		swapArtifactDirectory(stagingDirectory, outputDirectory);
		return compiledRoutes;
	} catch (reason) {
		fs.rmSync(stagingDirectory, { recursive: true, force: true });
		throw reason;
	}
}

function getWatchState() {
	const root = globalThis;
	if (!root[WATCH_STATE_KEY]) root[WATCH_STATE_KEY] = new Map();
	return root[WATCH_STATE_KEY];
}

function watchEngineAPISources({ projectRoot, configDir, endpointDir, compileEngineAPI }) {
	const watchOverride = process.env.NEXTJS_ENGINE_API_WATCH;
	const isNextDev = process.env.NODE_ENV === "development" && process.argv.includes("dev");
	if (watchOverride === "0" || (watchOverride !== "1" && !isNextDev)) return;

	const absoluteConfigDir = path.resolve(projectRoot, configDir);
	const absoluteEndpointDir = path.resolve(projectRoot, endpointDir);
	const stateKey = `${projectRoot}\n${absoluteConfigDir}\n${absoluteEndpointDir}`;
	const state = getWatchState();
	if (state.has(stateKey)) return;

	const watchers = [];
	let timer = null;
	let compiling = false;
	let compileAgain = false;

	const queueCompile = () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			if (compiling) {
				compileAgain = true;
				return;
			}

			compiling = true;
			try {
				compileEngineAPI();
			} catch (reason) {
				console.error("[engine:api] Failed to recompile API sources:", reason);
			} finally {
				compiling = false;
				if (compileAgain) {
					compileAgain = false;
					queueCompile();
				}
			}
		}, 50);
	};

	const addWatcher = (directory, extension, recursive) => {
		if (!fs.existsSync(directory)) return;
		try {
			const watcher = fs.watch(directory, { recursive }, (_eventType, fileName) => {
				const name = typeof fileName === "string" ? fileName : fileName?.toString() || "";
				if (!name || name.endsWith(extension)) queueCompile();
			});
			watcher.on("error", (reason) => {
				console.warn(`[engine:api] Watcher failed for ${directory}:`, reason);
			});
			watcher.unref?.();
			watchers.push(watcher);
		} catch (reason) {
			console.warn(`[engine:api] Could not watch ${directory}:`, reason);
		}
	};

	addWatcher(absoluteEndpointDir, ".route", true);
	addWatcher(absoluteConfigDir, ".api", false);
	state.set(stateKey, watchers);
}

function withEngineAPI(nextConfig = {}, pluginOptions = {}) {
	const {
		configDir = ".EngineAPIConfig",
		outputFile = ".engine-api-compiled.json",
		endpointDir = "data/endpoint",
		staticOutputDir = "public/_static/endpoint",
		staticManifestFile = "manifest.json",
	} = pluginOptions;
	const projectRoot = process.cwd();

	const compileEngineAPI = () => {
		compileProviderConfig(projectRoot, configDir, outputFile);
		compileAPIStaticArtifacts(projectRoot, endpointDir, staticOutputDir, staticManifestFile);
	};

	// next.config is evaluated for both Turbopack and webpack. Compile once here,
	// then keep source directories watched during next dev so .route edits do not
	// require restarting the development server.
	compileEngineAPI();
	watchEngineAPISources({ projectRoot, configDir, endpointDir, compileEngineAPI });

	return {
		...nextConfig,

		webpack(webpackConfig, context) {
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
module.exports.compileAPIStaticArtifacts = compileAPIStaticArtifacts;
module.exports.writeAPIStaticManifest = writeAPIStaticManifest;
