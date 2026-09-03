"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");
const {
	GENERATED_MARKER,
	compileNENCProject,
} = require("../src/engine/plugins/nencPlugin");
const { discoverNENCCommands } = require("../src/engine/plugins/nencCompiler");

function write(file, content) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, content, "utf8");
}

function commandSource() {
	return [
		'import { EngineCommand } from "nextjs-engine/network";',
		"",
		'EngineCommand.create("privateSearch", {',
		'\trun: "server",',
		'\tauth: "account",',
		'\tpermissions: ["catalog.read"],',
		"\tinput: {",
		'\t\tsearch: { type: "string", maxLength: 120 },',
		'\t\tpage: { type: "number", optional: true },',
		"\t},",
		"\tasync execute({ input, api }) {",
		"\t\treturn api.resolveRequest({ input });",
		"\t},",
		"});",
		"",
	].join("\n");
}

function assertTypeScriptSyntax(source, fileName) {
	const result = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ES2020,
		},
		fileName,
		reportDiagnostics: true,
	});
	const errors = (result.diagnostics || []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
	assert.deepEqual(errors, [], `${fileName} must be valid generated TypeScript`);
}

function run() {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nextjs-engine-nenc-"));
	try {
		const commandFile = path.join(projectRoot, "src", "commands.ts");
		const handlerFile = path.join(projectRoot, "src", "nenc.server.ts");
		write(commandFile, commandSource());
		write(handlerFile, "export default function createHandler() { return async () => new Response(); }\n");

		const discovered = discoverNENCCommands(commandSource(), "src/commands.ts");
		assert.equal(discovered.length, 1);
		assert.equal(discovered[0].name, "privateSearch");
		assert.deepEqual(Object.keys(discovered[0].input).sort(), ["page", "search"]);
		assert.equal(discoverNENCCommands(
			'registerEngineCommand("health.check", { execute() { return true; } });',
			"src/register.ts",
		)[0].name, "health.check");

		const result = compileNENCProject({
			projectRoot,
			commandFiles: ["src/commands.ts"],
			handlerModule: "src/nenc.server.ts",
			seed: "plugin-smoke-seed",
			buildId: "plugin-smoke-build",
		});
		assert.equal(fs.existsSync(result.clientFile), true);
		assert.equal(fs.existsSync(result.serverFile), true);
		assert.equal(fs.existsSync(result.routeFile), true);

		const clientSource = fs.readFileSync(result.clientFile, "utf8");
		const serverSource = fs.readFileSync(result.serverFile, "utf8");
		const routeSource = fs.readFileSync(result.routeFile, "utf8");
		assert.ok(clientSource.startsWith(GENERATED_MARKER));
		assert.ok(clientSource.includes("NENC_CLIENT_MANIFEST"));
		assert.ok(!clientSource.includes('"auth"'), "client artifact must not expose server auth policy");
		assert.ok(serverSource.includes('"auth": "account"'));
		assert.ok(routeSource.startsWith(GENERATED_MARKER));
		assert.ok(routeSource.includes('import "../../../src/commands";'));
		assert.ok(routeSource.includes('from "../../../src/nenc.server"'));
		assert.ok(routeSource.includes("handler as POST, handler as OPTIONS"));
		assert.equal((routeSource.match(/_static\/command/g) || []).length, 0, "generated route must not manufacture child routes");
		assertTypeScriptSyntax(clientSource, "client.ts");
		assertTypeScriptSyntax(serverSource, "server.ts");
		assertTypeScriptSyntax(routeSource, "route.ts");

		const repeat = compileNENCProject({
			projectRoot,
			commandFiles: ["src/commands.ts"],
			handlerModule: "src/nenc.server.ts",
			seed: "plugin-smoke-seed",
			buildId: "plugin-smoke-build",
		});
		assert.deepEqual(repeat.manifest, result.manifest, "explicit build inputs must compile deterministically");

		const lastGoodClient = fs.readFileSync(result.clientFile, "utf8");
		write(commandFile, 'EngineCommand.create("broken", { auth: dynamicAuth, execute() {} });\n');
		assert.throws(() => compileNENCProject({
			projectRoot,
			commandFiles: ["src/commands.ts"],
			handlerModule: "src/nenc.server.ts",
			seed: "plugin-smoke-seed",
			buildId: "plugin-smoke-build",
		}), /auth must be a static string/);
		assert.equal(fs.readFileSync(result.clientFile, "utf8"), lastGoodClient, "failed builds preserve last-known-good artifacts");
		write(commandFile, commandSource());

		write(result.routeFile, "export const POST = customHandler;\n");
		assert.throws(() => compileNENCProject({
			projectRoot,
			commandFiles: ["src/commands.ts"],
			handlerModule: "src/nenc.server.ts",
			seed: "plugin-smoke-seed",
			buildId: "plugin-smoke-build",
		}), /Refusing to overwrite the existing route/);

		assert.throws(() => compileNENCProject({
			projectRoot,
			commandFiles: ["src/commands.ts"],
			handlerModule: "src/nenc.server.ts",
			outputDir: "public/nenc",
			seed: "plugin-smoke-seed",
		}), /cannot be inside public/);

		assert.throws(() => discoverNENCCommands([
			'const authMode = "account";',
			'EngineCommand.create("dynamic", { auth: authMode, execute() {} });',
		].join("\n"), "src/dynamic.ts"), /auth must be a static string/);

		assert.throws(() => compileNENCProject({
			projectRoot,
			commandFiles: ["src/commands.ts"],
			handlerModule: "src/nenc.server.ts",
			outputDir: "src",
			seed: "plugin-smoke-seed",
		}), /cannot contain application or command source files/);

		assert.throws(() => discoverNENCCommands(
			'EngineCommand.create("missingExecute", { auth: "account" });',
			"src/missing.ts",
		), /requires execute/);

		assert.throws(() => discoverNENCCommands(
			'EngineCommand.create("unsafePolicy", { replay: {}, execute() {} });',
			"src/runtime-policy.ts",
		), /runtime-only; configure NENCCommandSecurityPolicy/);

		console.log("Generation 3 NENC plugin integration smoke: ok");
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
}

run();
