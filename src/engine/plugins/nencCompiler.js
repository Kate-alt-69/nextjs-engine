"use strict";

// Build-only NENC wire compiler. Opaque ids reduce transport readability; they
// are never treated as authorization credentials.

const { createHmac, randomBytes } = require("node:crypto");

const ENDPOINT = "/_static/command";
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;
const AUTH_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/;
const PERMISSION_PATTERN = /^[A-Za-z][A-Za-z0-9_:-]*(?:\.[A-Za-z0-9_:-]+)*$/;
const RUN_VALUES = new Set(["client", "server", "auto"]);
let cachedTypeScript = null;

function getTypeScript() {
	if (cachedTypeScript) return cachedTypeScript;
	try {
		cachedTypeScript = require("typescript");
		return cachedTypeScript;
	} catch {
		throw new Error("[NENC compiler] TypeScript is required to discover EngineCommand declarations.");
	}
}

function sourceError(fileName, node, message) {
	const sourceFile = node.getSourceFile();
	const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
	return new Error(`[NENC compiler] ${fileName}:${position.line + 1}:${position.character + 1} ${message}`);
}

function propertyName(property, typescript, fileName) {
	if (typescript.isIdentifier(property.name) || typescript.isStringLiteral(property.name)) {
		return property.name.text;
	}
	throw sourceError(fileName, property, "Computed command metadata is not supported.");
}

function commandProperties(definition, typescript, fileName) {
	const properties = new Map();
	for (const property of definition.properties) {
		if (typescript.isSpreadAssignment(property)) {
			throw sourceError(fileName, property, "EngineCommand definitions cannot spread security metadata.");
		}
		if (!property.name) continue;
		const name = propertyName(property, typescript, fileName);
		if (properties.has(name)) throw sourceError(fileName, property, `Duplicate EngineCommand property: ${name}`);
		properties.set(name, property);
	}
	return properties;
}

function propertyInitializer(properties, name, typescript, fileName) {
	const property = properties.get(name);
	if (!property) return undefined;
	if (!typescript.isPropertyAssignment(property)) {
		throw sourceError(fileName, property, `EngineCommand ${name} must use a static property value.`);
	}
	return property.initializer;
}

function staticString(node, typescript, fileName, field) {
	if (!typescript.isStringLiteral(node) && !typescript.isNoSubstitutionTemplateLiteral(node)) {
		throw sourceError(fileName, node, `EngineCommand ${field} must be a static string.`);
	}
	return node.text;
}

function staticStringArray(node, typescript, fileName, field) {
	if (!typescript.isArrayLiteralExpression(node)) {
		throw sourceError(fileName, node, `EngineCommand ${field} must be a static string array.`);
	}
	return node.elements.map((element) => staticString(element, typescript, fileName, field));
}

function staticObject(node, typescript, fileName, field) {
	if (!typescript.isObjectLiteralExpression(node)) {
		throw sourceError(fileName, node, `EngineCommand ${field} must be a static object.`);
	}
	const output = Object.create(null);
	for (const property of node.properties) {
		if (!typescript.isPropertyAssignment(property)) {
			throw sourceError(fileName, property, `EngineCommand ${field} cannot contain methods or spreads.`);
		}
		const name = propertyName(property, typescript, fileName);
		if (Object.prototype.hasOwnProperty.call(output, name)) {
			throw sourceError(fileName, property, `Duplicate EngineCommand ${field} property: ${name}`);
		}
		output[name] = property.initializer;
	}
	return output;
}

function inputDescriptor(node, typescript, fileName) {
	const properties = staticObject(node, typescript, fileName, "input");
	return Object.fromEntries(Object.keys(properties).map((name) => [name, {}]));
}

function isEngineCommandCreate(node, typescript) {
	return typescript.isPropertyAccessExpression(node.expression)
		&& typescript.isIdentifier(node.expression.expression)
		&& node.expression.expression.text === "EngineCommand"
		&& node.expression.name.text === "create";
}

function isRegisterEngineCommand(node, typescript) {
	return typescript.isIdentifier(node.expression) && node.expression.text === "registerEngineCommand";
}

function extractCommand(node, typescript, fileName) {
	if (node.arguments.length < 2) {
		throw sourceError(fileName, node, "EngineCommand.create() requires a name and definition.");
	}
	const name = staticString(node.arguments[0], typescript, fileName, "name");
	const definition = node.arguments[1];
	if (!typescript.isObjectLiteralExpression(definition)) {
		throw sourceError(fileName, definition, "EngineCommand definition must be an inline object.");
	}
	const properties = commandProperties(definition, typescript, fileName);
	if (!properties.has("execute")) {
		throw sourceError(fileName, definition, "EngineCommand definition requires execute().");
	}
	for (const runtimePolicy of ["replay", "rateLimit"]) {
		if (properties.has(runtimePolicy)) {
			throw sourceError(
				fileName,
				properties.get(runtimePolicy),
				`EngineCommand ${runtimePolicy} is runtime-only; configure NENCCommandSecurityPolicy instead.`,
			);
		}
	}
	const runNode = propertyInitializer(properties, "run", typescript, fileName);
	const authNode = propertyInitializer(properties, "auth", typescript, fileName);
	const permissionsNode = propertyInitializer(properties, "permissions", typescript, fileName);
	const inputNode = propertyInitializer(properties, "input", typescript, fileName);
	return {
		name,
		...(runNode ? { run: staticString(runNode, typescript, fileName, "run") } : {}),
		...(authNode ? { auth: staticString(authNode, typescript, fileName, "auth") } : {}),
		...(permissionsNode ? { permissions: staticStringArray(permissionsNode, typescript, fileName, "permissions") } : {}),
		...(inputNode ? { input: inputDescriptor(inputNode, typescript, fileName) } : {}),
	};
}

function discoverNENCCommands(source, fileName = "engine-command.ts") {
	const typescript = getTypeScript();
	const sourceFile = typescript.createSourceFile(
		fileName,
		source,
		typescript.ScriptTarget.Latest,
		true,
		fileName.endsWith(".tsx") ? typescript.ScriptKind.TSX : typescript.ScriptKind.TS,
	);
	const parseErrors = sourceFile.parseDiagnostics || [];
	if (parseErrors.length > 0) {
		const message = typescript.flattenDiagnosticMessageText(parseErrors[0].messageText, "\n");
		throw new Error(`[NENC compiler] ${fileName} could not be parsed: ${message}`);
	}
	const commands = [];
	const visit = (node) => {
		if (typescript.isCallExpression(node) && (
			isEngineCommandCreate(node, typescript) || isRegisterEngineCommand(node, typescript)
		)) commands.push(extractCommand(node, typescript, fileName));
		typescript.forEachChild(node, visit);
	};
	visit(sourceFile);
	return commands;
}

function seedBuffer(seed) {
	if (seed === undefined) return randomBytes(32);
	if (Buffer.isBuffer(seed)) return seed;
	if (typeof seed === "string" && seed.length > 0) return Buffer.from(seed, "utf8");
	throw new Error("[NENC compiler] seed must be a non-empty string or Buffer.");
}

function digest(seed, buildId, scope, value) {
	return createHmac("sha256", seed)
		.update(buildId)
		.update("\0")
		.update(scope)
		.update("\0")
		.update(value)
		.digest("base64url");
}

function uniqueId(used, seed, buildId, scope, value, prefix) {
	const hash = digest(seed, buildId, scope, value);
	for (let length = 8; length <= Math.min(hash.length, 28); length += 2) {
		const candidate = `${prefix}${hash.slice(0, length)}`;
		if (!used.has(candidate)) {
			used.add(candidate);
			return candidate;
		}
	}
	throw new Error(`[NENC compiler] Could not allocate a collision-free id for ${scope}.`);
}

function normalizeCommand(command) {
	if (!command || typeof command !== "object" || !NAME_PATTERN.test(String(command.name || ""))) {
		throw new Error("[NENC compiler] Every command requires a valid logical name.");
	}
	const input = command.input && typeof command.input === "object" ? command.input : {};
	for (const field of Object.keys(input)) {
		if (!NAME_PATTERN.test(field)) throw new Error(`[NENC compiler] Invalid input field on ${command.name}.`);
	}
	const run = command.run || "auto";
	const auth = command.auth || "anonymous";
	const permissions = Array.isArray(command.permissions) ? [...command.permissions] : [];
	if (!RUN_VALUES.has(run)) throw new Error(`[NENC compiler] Invalid runtime on ${command.name}.`);
	if (typeof auth !== "string" || !AUTH_PATTERN.test(auth)) {
		throw new Error(`[NENC compiler] Invalid auth policy on ${command.name}.`);
	}
	if (permissions.some((permission) => typeof permission !== "string" || !PERMISSION_PATTERN.test(permission))) {
		throw new Error(`[NENC compiler] Invalid permission on ${command.name}.`);
	}
	return {
		name: command.name,
		run,
		auth,
		permissions,
		input,
	};
}

function compileNENCManifest(rawCommands, options = {}) {
	if (!Array.isArray(rawCommands)) throw new Error("[NENC compiler] commands must be an array.");
	const commands = rawCommands.map(normalizeCommand).sort((left, right) => left.name.localeCompare(right.name));
	const logicalNames = new Set();
	for (const command of commands) {
		if (logicalNames.has(command.name)) throw new Error(`[NENC compiler] Duplicate command: ${command.name}`);
		logicalNames.add(command.name);
	}

	const seed = seedBuffer(options.seed);
	const buildId = options.buildId || randomBytes(8).toString("hex");
	const headerIds = new Set();
	const headers = {
		selector: `x-${uniqueId(headerIds, seed, buildId, "header", "selector", "h")}`,
		nonce: `x-${uniqueId(headerIds, seed, buildId, "header", "nonce", "h")}`,
		timestamp: `x-${uniqueId(headerIds, seed, buildId, "header", "timestamp", "h")}`,
		signature: `x-${uniqueId(headerIds, seed, buildId, "header", "signature", "h")}`,
	};

	const clientCommands = Object.create(null);
	const serverCommands = Object.create(null);
	const commandIds = new Set();

	for (const command of commands) {
		const id = uniqueId(commandIds, seed, buildId, "command", command.name, "c");
		const argsByName = Object.create(null);
		const argsById = Object.create(null);
		const argIds = new Set();
		for (const name of Object.keys(command.input).sort()) {
			const wireId = uniqueId(argIds, seed, buildId, `arg:${command.name}`, name, "a");
			argsByName[name] = wireId;
			argsById[wireId] = name;
		}
		clientCommands[command.name] = { id, args: argsByName };
		serverCommands[id] = {
			id,
			name: command.name,
			run: command.run,
			auth: command.auth,
			permissions: command.permissions,
			argsByName,
			argsById,
		};
	}

	return {
		client: { version: 1, endpoint: ENDPOINT, buildId, headers, commands: clientCommands },
		server: { version: 1, endpoint: ENDPOINT, buildId, headers, commandsById: serverCommands },
	};
}

module.exports = {
	ENDPOINT,
	compileNENCManifest,
	discoverNENCCommands,
};
