"use strict";

const fs = require("fs");
const path = require("path");

const SAFE_ROUTE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const RESERVED_MODULE_BINDINGS = new Set([
	"createEndpoint",
	"response",
	"error",
	"__engineApiStaticRoute",
	"__engineApiStaticGlobal",
]);
const RESERVED_RUN_BINDINGS = new Set(["__context", "query", "body", "input", "proxy"]);
let cachedTypeScript = null;

function getTypeScript() {
	if (cachedTypeScript) return cachedTypeScript;
	try {
		cachedTypeScript = require("typescript");
		return cachedTypeScript;
	} catch {
		throw new Error(
			"[APIStaticCompiler] TypeScript is required to compile .route files. Install nextjs-engine with its dependencies or add typescript to the project.",
		);
	}
}

function normalizeRouteId(routeId) {
	const normalized = String(routeId).trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
	if (!normalized) throw new Error("[APIStaticCompiler] Route id cannot be empty.");
	for (const segment of normalized.split("/")) {
		if (!segment || segment === "." || segment === ".." || !SAFE_ROUTE_SEGMENT.test(segment)) {
			throw new Error(`[APIStaticCompiler] Invalid route segment: ${segment || "<empty>"}`);
		}
	}
	return normalized;
}

function getRouteHash(routeId) {
	const normalized = normalizeRouteId(routeId);
	let hash = 0x811c9dc5;
	for (let index = 0; index < normalized.length; index += 1) {
		hash ^= normalized.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(36).padStart(7, "0").slice(-7);
}

function isIdentifierStart(char) {
	return /[A-Za-z_$]/.test(char || "");
}

function isIdentifierPart(char) {
	return /[A-Za-z0-9_$-]/.test(char || "");
}

function isJavaScriptIdentifierPart(char) {
	return /[A-Za-z0-9_$]/.test(char || "");
}

function skipQuoted(source, index, quote) {
	index += 1;
	while (index < source.length) {
		if (source[index] === "\\") {
			index += 2;
			continue;
		}
		if (quote === "`" && source[index] === "$" && source[index + 1] === "{") {
			const expressionEnd = findMatching(source, index + 1, "{", "}");
			index = expressionEnd + 1;
			continue;
		}
		if (source[index] === quote) return index + 1;
		index += 1;
	}
	throw new Error("[APIStaticCompiler] Unterminated string literal.");
}

function skipLineComment(source, index) {
	const newline = source.indexOf("\n", index + 2);
	return newline === -1 ? source.length : newline + 1;
}

function skipBlockComment(source, index) {
	const end = source.indexOf("*/", index + 2);
	if (end === -1) throw new Error("[APIStaticCompiler] Unterminated block comment.");
	return end + 2;
}

function previousSignificantIndex(source, index) {
	let cursor = index - 1;
	while (cursor >= 0 && /\s/.test(source[cursor])) cursor -= 1;
	return cursor;
}

function previousSignificantWord(source, index) {
	let cursor = previousSignificantIndex(source, index);
	if (source[cursor] === "*") cursor = previousSignificantIndex(source, cursor);
	const end = cursor + 1;
	while (cursor >= 0 && isJavaScriptIdentifierPart(source[cursor])) cursor -= 1;
	return source.slice(cursor + 1, end);
}

function isRegexStart(source, index) {
	if (source[index] !== "/" || source[index + 1] === "/" || source[index + 1] === "*") return false;
	const previousIndex = previousSignificantIndex(source, index);
	if (previousIndex < 0) return true;
	const previous = source[previousIndex];
	if (/[([{,:;=!?&|+\-*%^~<>]/.test(previous)) return true;

	const wordEnd = previousIndex + 1;
	let wordStart = previousIndex;
	while (wordStart >= 0 && /[A-Za-z]/.test(source[wordStart])) wordStart -= 1;
	const word = source.slice(wordStart + 1, wordEnd);
	return ["return", "throw", "case", "delete", "void", "typeof", "instanceof", "in", "of", "yield", "await"].includes(word);
}

function skipRegex(source, index) {
	index += 1;
	let inClass = false;
	while (index < source.length) {
		const char = source[index];
		if (char === "\\") {
			index += 2;
			continue;
		}
		if (char === "[") {
			inClass = true;
			index += 1;
			continue;
		}
		if (char === "]" && inClass) {
			inClass = false;
			index += 1;
			continue;
		}
		if (char === "/" && !inClass) {
			index += 1;
			while (/[A-Za-z]/.test(source[index] || "")) index += 1;
			return index;
		}
		if (char === "\n" || char === "\r") break;
		index += 1;
	}
	throw new Error("[APIStaticCompiler] Unterminated regular expression literal.");
}

function skipTrivia(source, index, allowComma = true) {
	while (index < source.length) {
		const char = source[index];
		if (/\s/.test(char) || (allowComma && char === ",")) {
			index += 1;
			continue;
		}
		if (source.startsWith("//", index)) {
			index = skipLineComment(source, index);
			continue;
		}
		if (source.startsWith("/*", index)) {
			index = skipBlockComment(source, index);
			continue;
		}
		break;
	}
	return index;
}

function findMatching(source, openIndex, openChar, closeChar) {
	let depth = 0;
	for (let index = openIndex; index < source.length; index += 1) {
		const char = source[index];
		if (char === '"' || char === "'" || char === "`") {
			index = skipQuoted(source, index, char) - 1;
			continue;
		}
		if (source.startsWith("//", index)) {
			index = skipLineComment(source, index) - 1;
			continue;
		}
		if (source.startsWith("/*", index)) {
			index = skipBlockComment(source, index) - 1;
			continue;
		}
		if (isRegexStart(source, index)) {
			index = skipRegex(source, index) - 1;
			continue;
		}
		if (char === openChar) depth += 1;
		else if (char === closeChar) {
			depth -= 1;
			if (depth === 0) return index;
		}
	}
	throw new Error(`[APIStaticCompiler] Unclosed ${openChar}.`);
}

function readIdentifier(source, index) {
	index = skipTrivia(source, index, false);
	if (!isIdentifierStart(source[index])) {
		throw new Error(`[APIStaticCompiler] Expected identifier near: ${source.slice(index, index + 24)}`);
	}
	const start = index;
	index += 1;
	while (isIdentifierPart(source[index])) index += 1;
	return { value: source.slice(start, index), end: index };
}

function readString(source, index) {
	index = skipTrivia(source, index, false);
	const quote = source[index];
	if (quote !== '"' && quote !== "'") {
		throw new Error(`[APIStaticCompiler] Expected string near: ${source.slice(index, index + 24)}`);
	}
	const end = skipQuoted(source, index, quote);
	const raw = source.slice(index, end);
	let value;
	if (quote === '"') value = JSON.parse(raw);
	else {
		value = raw.slice(1, -1)
			.replace(/\\'/g, "'")
			.replace(/\\\\/g, "\\");
	}
	return { value, end };
}

function findCreateEndpoint(source) {
	let index = 0;
	let braceDepth = 0;
	let parenDepth = 0;
	let bracketDepth = 0;

	while (index < source.length) {
		const char = source[index];
		if (char === '"' || char === "'" || char === "`") {
			index = skipQuoted(source, index, char);
			continue;
		}
		if (source.startsWith("//", index)) {
			index = skipLineComment(source, index);
			continue;
		}
		if (source.startsWith("/*", index)) {
			index = skipBlockComment(source, index);
			continue;
		}
		if (isRegexStart(source, index)) {
			index = skipRegex(source, index);
			continue;
		}

		const isTopLevel = braceDepth === 0 && parenDepth === 0 && bracketDepth === 0;
		if (isTopLevel && source.startsWith("createEndpoint", index)) {
			const before = source[index - 1];
			const after = source[index + "createEndpoint".length];
			const isIdentifier = !isIdentifierPart(before) && before !== "." && !isIdentifierPart(after);
			if (isIdentifier && previousSignificantWord(source, index) !== "function") {
				const cursor = skipTrivia(source, index + "createEndpoint".length, false);
				if (source[cursor] === "(") {
					const callEnd = findMatching(source, cursor, "(", ")");
					return { start: index, open: cursor, end: callEnd + 1 };
				}
			}
		}

		if (char === "{") braceDepth += 1;
		else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
		else if (char === "(") parenDepth += 1;
		else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
		else if (char === "[") bracketDepth += 1;
		else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
		index += 1;
	}
	throw new Error("[APIStaticCompiler] Missing top-level createEndpoint([...]) declaration.");
}

function parseSchema(source, start, end) {
	const schema = {};
	let index = start;
	while (index < end) {
		index = skipTrivia(source, index);
		if (index >= end) break;
		let key;
		if (source[index] === '"' || source[index] === "'") {
			const parsed = readString(source, index);
			key = parsed.value;
			index = parsed.end;
		} else {
			const parsed = readIdentifier(source, index);
			key = parsed.value;
			index = parsed.end;
		}
		index = skipTrivia(source, index, false);
		if (source[index] !== ":") throw new Error(`[APIStaticCompiler] Expected ':' after schema key ${key}.`);
		index = skipTrivia(source, index + 1, false);
		const rule = readString(source, index);
		schema[key] = rule.value;
		index = rule.end;
	}
	return schema;
}

function hasDeclareModifier(node, typescript) {
	return node.modifiers?.some((modifier) => modifier.kind === typescript.SyntaxKind.DeclareKeyword) ?? false;
}

function addBindingName(name, typescript, output) {
	if (typescript.isIdentifier(name)) {
		output.add(name.text);
		return;
	}
	if (!typescript.isObjectBindingPattern(name) && !typescript.isArrayBindingPattern(name)) return;
	for (const element of name.elements) {
		if (typescript.isOmittedExpression(element)) continue;
		addBindingName(element.name, typescript, output);
	}
}

function isRuntimeScopeBoundary(node, typescript) {
	return typescript.isFunctionDeclaration(node)
		|| typescript.isFunctionExpression(node)
		|| typescript.isArrowFunction(node)
		|| typescript.isMethodDeclaration(node)
		|| typescript.isConstructorDeclaration(node)
		|| typescript.isGetAccessorDeclaration(node)
		|| typescript.isSetAccessorDeclaration(node)
		|| typescript.isClassDeclaration(node)
		|| typescript.isClassExpression(node)
		|| typescript.isModuleDeclaration(node);
}

function collectFunctionScopedVarBindings(node, typescript, output, rootNode = node) {
	if (node !== rootNode && isRuntimeScopeBoundary(node, typescript)) return;
	if (typescript.isVariableDeclarationList(node) && (node.flags & typescript.NodeFlags.BlockScoped) === 0) {
		for (const declaration of node.declarations) addBindingName(declaration.name, typescript, output);
	}
	typescript.forEachChild(node, (child) => collectFunctionScopedVarBindings(child, typescript, output, rootNode));
}

function collectImportBindings(statement, typescript, output) {
	const clause = statement.importClause;
	if (!clause || clause.isTypeOnly) return;
	if (clause.name) output.add(clause.name.text);
	const bindings = clause.namedBindings;
	if (!bindings) return;
	if (typescript.isNamespaceImport(bindings)) {
		output.add(bindings.name.text);
		return;
	}
	for (const element of bindings.elements) {
		if (!element.isTypeOnly) output.add(element.name.text);
	}
}

function collectDirectRuntimeBindings(scopeNode, typescript) {
	const output = new Set();
	for (const statement of scopeNode.statements ?? []) {
		if (hasDeclareModifier(statement, typescript)) continue;
		if (typescript.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				addBindingName(declaration.name, typescript, output);
			}
			continue;
		}
		if (
			typescript.isFunctionDeclaration(statement)
			|| typescript.isClassDeclaration(statement)
			|| typescript.isEnumDeclaration(statement)
		) {
			if (statement.name) output.add(statement.name.text);
			continue;
		}
		if (typescript.isModuleDeclaration(statement)) {
			if (typescript.isIdentifier(statement.name)) output.add(statement.name.text);
			continue;
		}
		if (typescript.isImportDeclaration(statement)) {
			collectImportBindings(statement, typescript, output);
			continue;
		}
		if (typescript.isImportEqualsDeclaration(statement) && !statement.isTypeOnly) {
			output.add(statement.name.text);
		}
	}
	collectFunctionScopedVarBindings(scopeNode, typescript, output);
	return output;
}

function createTypeScriptSource(source, fileName) {
	const typescript = getTypeScript();
	const sourceFile = typescript.createSourceFile(
		fileName,
		source,
		typescript.ScriptTarget.Latest,
		true,
		typescript.ScriptKind.TS,
	);
	return { typescript, sourceFile };
}

function unwrapCallableInitializer(expression, typescript) {
	let current = expression;
	while (
		current
		&& (
			typescript.isParenthesizedExpression(current)
			|| typescript.isAsExpression(current)
			|| typescript.isTypeAssertionExpression(current)
			|| typescript.isNonNullExpression(current)
		)
	) {
		current = current.expression;
	}
	return current;
}

function collectFunctionNames(source) {
	const { typescript, sourceFile } = createTypeScriptSource(source, "api-static-user.ts");
	const runtimeBindings = collectDirectRuntimeBindings(sourceFile, typescript);
	const names = new Set(["proxy"]);
	if (!runtimeBindings.has("fetch")) names.add("fetch");

	for (const statement of sourceFile.statements) {
		if (hasDeclareModifier(statement, typescript)) continue;
		if (typescript.isFunctionDeclaration(statement) && statement.name) {
			names.add(statement.name.text);
			continue;
		}
		if (!typescript.isVariableStatement(statement)) continue;
		for (const declaration of statement.declarationList.declarations) {
			if (!typescript.isIdentifier(declaration.name) || !declaration.initializer) continue;
			const initializer = unwrapCallableInitializer(declaration.initializer, typescript);
			if (initializer && (typescript.isFunctionExpression(initializer) || typescript.isArrowFunction(initializer))) {
				names.add(declaration.name.text);
			}
		}
	}
	return names;
}

function ensureNoReservedModuleBindings(source) {
	const { typescript, sourceFile } = createTypeScriptSource(source, "api-static-user.ts");
	const bindings = collectDirectRuntimeBindings(sourceFile, typescript);
	for (const name of RESERVED_MODULE_BINDINGS) {
		if (!bindings.has(name)) continue;
		throw new Error(
			`[APIStaticCompiler] Top-level binding "${name}" is reserved by the .route runtime. Local bindings inside functions or nested blocks are allowed.`,
		);
	}
}

function collectRunScopeBindings(source) {
	const wrapped = `async function __engineApiStaticRun(__context) {\n${source}\n}`;
	const { typescript, sourceFile } = createTypeScriptSource(wrapped, "api-static-run.ts");
	const declaration = sourceFile.statements.find((statement) => typescript.isFunctionDeclaration(statement));
	if (!declaration?.body) return new Set();
	return collectDirectRuntimeBindings(declaration.body, typescript);
}

function ensureNoReservedRunBindings(run, operationName) {
	if (run.kind !== "block") return;
	const bindings = collectRunScopeBindings(run.code);
	for (const name of RESERVED_RUN_BINDINGS) {
		if (!bindings.has(name)) continue;
		throw new Error(
			`[APIStaticCompiler] Run block for ${operationName} redeclares runtime binding "${name}". Use the provided binding or shadow it only inside a nested block/function scope.`,
		);
	}
}

function previousSignificantChar(source) {
	for (let index = source.length - 1; index >= 0; index -= 1) {
		if (!/\s/.test(source[index])) return source[index];
	}
	return "";
}

function transformTemplateBracketCalls(source, index, functionNames) {
	let output = "`";
	index += 1;

	while (index < source.length) {
		if (source[index] === "\\") {
			output += source.slice(index, index + 2);
			index += 2;
			continue;
		}
		if (source[index] === "`") {
			return { code: `${output}\``, end: index + 1 };
		}
		if (source[index] === "$" && source[index + 1] === "{") {
			const close = findMatching(source, index + 1, "{", "}");
			const inner = transformBracketCalls(source.slice(index + 2, close), functionNames);
			output += "${" + inner + "}";
			index = close + 1;
			continue;
		}
		output += source[index];
		index += 1;
	}

	throw new Error("[APIStaticCompiler] Unterminated template literal.");
}

function transformBracketCalls(expression, functionNames) {
	let output = "";
	let index = 0;

	while (index < expression.length) {
		const char = expression[index];

		if (char === '"' || char === "'") {
			const end = skipQuoted(expression, index, char);
			output += expression.slice(index, end);
			index = end;
			continue;
		}
		if (char === "`") {
			const transformed = transformTemplateBracketCalls(expression, index, functionNames);
			output += transformed.code;
			index = transformed.end;
			continue;
		}
		if (expression.startsWith("//", index)) {
			const end = skipLineComment(expression, index);
			output += expression.slice(index, end);
			index = end;
			continue;
		}
		if (expression.startsWith("/*", index)) {
			const end = skipBlockComment(expression, index);
			output += expression.slice(index, end);
			index = end;
			continue;
		}
		if (isRegexStart(expression, index)) {
			const end = skipRegex(expression, index);
			output += expression.slice(index, end);
			index = end;
			continue;
		}
		if (!isIdentifierStart(char)) {
			output += char;
			index += 1;
			continue;
		}

		const start = index;
		index += 1;
		while (isJavaScriptIdentifierPart(expression[index])) index += 1;
		const name = expression.slice(start, index);
		let bracketIndex = index;
		while (/\s/.test(expression[bracketIndex] || "")) bracketIndex += 1;
		const previous = previousSignificantChar(output);
		const isBareCallable = functionNames.has(name) && previous !== ".";

		if (isBareCallable && expression[bracketIndex] === "[") {
			const close = findMatching(expression, bracketIndex, "[", "]");
			const inner = transformBracketCalls(expression.slice(bracketIndex + 1, close), functionNames);
			output += `${name}${expression.slice(index, bracketIndex)}(${inner})`;
			index = close + 1;
			continue;
		}

		output += name;
	}

	return output;
}

function parseRun(source, index, functionNames) {
	index += "run.".length;
	const sourceType = readIdentifier(source, index);
	if (!["query", "body", "input", "proxy"].includes(sourceType.value)) {
		throw new Error(`[APIStaticCompiler] Unsupported run source: ${sourceType.value}`);
	}
	index = skipTrivia(source, sourceType.end, false);

	if (source[index] === "(") {
		const close = findMatching(source, index, "(", ")");
		let expression = source.slice(index + 1, close).trim();
		if (/^return\b/.test(expression)) expression = expression.replace(/^return\b/, "").trim();
		if (!expression) throw new Error("[APIStaticCompiler] run.<source>(...) needs an expression.");
		return {
			source: sourceType.value,
			kind: "expression",
			code: transformBracketCalls(expression, functionNames),
			end: close + 1,
		};
	}

	if (source[index] === "{") {
		const close = findMatching(source, index, "{", "}");
		return {
			source: sourceType.value,
			kind: "block",
			code: transformBracketCalls(source.slice(index + 1, close), functionNames),
			end: close + 1,
		};
	}

	throw new Error("[APIStaticCompiler] run.<source> must use (...) or { ... }.");
}

function parseOperation(source, start, end, functionNames) {
	let index = start;
	let name = "";
	const schemas = {};
	let run = null;

	while (index < end) {
		index = skipTrivia(source, index);
		if (index >= end) break;

		if (source.startsWith("run.", index)) {
			if (run) throw new Error("[APIStaticCompiler] An endpoint operation can only contain one run.* declaration.");
			run = parseRun(source, index, functionNames);
			index = run.end;
			continue;
		}

		const keyToken = readIdentifier(source, index);
		const key = keyToken.value;
		index = skipTrivia(source, keyToken.end, false);
		if (source[index] !== ":") throw new Error(`[APIStaticCompiler] Expected ':' after ${key}.`);
		index = skipTrivia(source, index + 1, false);

		if (key === "name") {
			const value = readString(source, index);
			name = value.value;
			index = value.end;
			continue;
		}

		if (["query", "body", "input"].includes(key)) {
			if (source[index] !== "{") throw new Error(`[APIStaticCompiler] ${key} must be an input schema object.`);
			const close = findMatching(source, index, "{", "}");
			schemas[key] = parseSchema(source, index + 1, close);
			index = close + 1;
			continue;
		}

		throw new Error(`[APIStaticCompiler] Unknown createEndpoint property: ${key}`);
	}

	if (!name.trim()) throw new Error("[APIStaticCompiler] Every endpoint operation needs name: \"...\".");
	if (!run) throw new Error(`[APIStaticCompiler] Operation ${name} needs run.query(...), run.body(...), run.input(...), or run.proxy(...).`);
	ensureNoReservedRunBindings(run, name);
	const schema = schemas[run.source] || schemas.input;
	return { name, source: run.source, schema, run };
}

function parseEndpointArray(source, start, end, functionNames) {
	const operations = [];
	let index = start;
	while (index < end) {
		index = skipTrivia(source, index);
		if (index >= end) break;
		if (source[index] !== "{") throw new Error("[APIStaticCompiler] createEndpoint expects an array of { ... } operations.");
		const close = findMatching(source, index, "{", "}");
		operations.push(parseOperation(source, index + 1, close, functionNames));
		index = close + 1;
	}
	if (operations.length === 0) throw new Error("[APIStaticCompiler] createEndpoint needs at least one operation.");
	const names = new Set();
	for (const operation of operations) {
		if (names.has(operation.name)) throw new Error(`[APIStaticCompiler] Duplicate operation name: ${operation.name}`);
		names.add(operation.name);
	}
	return operations;
}

function makeRunFunction(run) {
	const aliases = [
		"const query = __context.query;",
		"const body = __context.body;",
		"const input = __context.input;",
		"const proxy = __context.proxy;",
	].join("\n\t\t\t");
	const body = run.kind === "expression"
		? `return (${run.code});`
		: run.code.trim();
	return `async (__context) => {\n\t\t\t${aliases}\n\t\t\t${body}\n\t\t}`;
}

function generateModuleSource(routeId, routeHash, userSource, operations) {
	const call = findCreateEndpoint(userSource);
	const userCode = `${userSource.slice(0, call.start)}\n${userSource.slice(call.end)}`.trim();
	ensureNoReservedModuleBindings(userCode);
	try {
		findCreateEndpoint(userCode);
		throw new Error("[APIStaticCompiler] A .route file may only contain one top-level createEndpoint([...]) declaration.");
	} catch (reason) {
		if (!(reason instanceof Error) || !reason.message.includes("Missing top-level createEndpoint")) throw reason;
	}
	const operationSource = operations.map((operation) => {
		return `\t{\n\t\tname: ${JSON.stringify(operation.name)},\n\t\tsource: ${JSON.stringify(operation.source)},\n\t\tschema: ${JSON.stringify(operation.schema || {})},\n\t\trun: ${makeRunFunction(operation.run)},\n\t}`;
	}).join(",\n");

	return `${userCode}\n\nfunction response(options = {}) {\n\treturn {\n\t\t__engine_api_static_response__: true,\n\t\tstatus: options.status,\n\t\theaders: options.headers,\n\t\tbody: options.body,\n\t};\n}\n\nfunction error(status, message, details) {\n\tconst reason = new Error(message);\n\treason.__engine_api_static_error__ = true;\n\treason.status = status;\n\treason.details = details;\n\tthrow reason;\n}\n\nconst __engineApiStaticRoute = {\n\troute: ${JSON.stringify(routeId)},\n\thash: ${JSON.stringify(routeHash)},\n\toperations: [\n${operationSource}\n\t],\n};\n\nconst __engineApiStaticGlobal = globalThis;\nif (!__engineApiStaticGlobal.__NEXTJS_ENGINE_API_STATIC__) {\n\t__engineApiStaticGlobal.__NEXTJS_ENGINE_API_STATIC__ = new Map();\n}\n__engineApiStaticGlobal.__NEXTJS_ENGINE_API_STATIC__.set(${JSON.stringify(routeId)}, __engineApiStaticRoute);\n`;
}

function transpileRoute(moduleSource, fileName) {
	const typescript = getTypeScript();
	const result = typescript.transpileModule(moduleSource, {
		fileName,
		reportDiagnostics: true,
		compilerOptions: {
			target: typescript.ScriptTarget.ES2020,
			module: typescript.ModuleKind.ES2020,
			isolatedModules: true,
			removeComments: false,
		},
	});
	const errors = (result.diagnostics || []).filter((diagnostic) => diagnostic.category === typescript.DiagnosticCategory.Error);
	if (errors.length > 0) {
		const text = errors.map((diagnostic) => typescript.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n");
		throw new Error(`[APIStaticCompiler] TypeScript error in ${fileName}:\n${text}`);
	}
	return result.outputText;
}

function compileAPIStaticSource(source, routeId, fileName = `${routeId}.route`) {
	const normalizedRoute = normalizeRouteId(routeId);
	const call = findCreateEndpoint(source);
	const cursor = skipTrivia(source, call.open + 1, false);
	if (source[cursor] !== "[") throw new Error("[APIStaticCompiler] createEndpoint must receive an array: createEndpoint([ ... ]).");
	const arrayEnd = findMatching(source, cursor, "[", "]");
	const afterArray = skipTrivia(source, arrayEnd + 1, false);
	if (afterArray !== call.end - 1) throw new Error("[APIStaticCompiler] createEndpoint accepts exactly one array argument.");
	const userCode = `${source.slice(0, call.start)}\n${source.slice(call.end)}`;
	const functionNames = collectFunctionNames(userCode);
	const operations = parseEndpointArray(source, cursor + 1, arrayEnd, functionNames);
	const hash = getRouteHash(normalizedRoute);
	const moduleSource = generateModuleSource(normalizedRoute, hash, source, operations);
	return {
		route: normalizedRoute,
		hash,
		operations: operations.map((operation) => operation.name),
		code: transpileRoute(moduleSource, fileName),
	};
}

function walkRouteFiles(directory) {
	if (!fs.existsSync(directory)) return [];
	const output = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) output.push(...walkRouteFiles(absolute));
		else if (entry.isFile() && entry.name.endsWith(".route")) output.push(absolute);
	}
	return output.sort();
}

function outputPathForRoute(outputDirectory, routeId, hash) {
	const segments = routeId.split("/");
	const baseName = segments.pop();
	return path.join(outputDirectory, ...segments, `${baseName}-${hash}.js`);
}

function swapCompiledOutput(stagingDirectory, outputDirectory) {
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
		if (backedUp) fs.rmSync(backupDirectory, { recursive: true, force: true });
	} catch (reason) {
		if (!installed) {
			if (fs.existsSync(outputDirectory)) fs.rmSync(outputDirectory, { recursive: true, force: true });
			if (backedUp && fs.existsSync(backupDirectory)) fs.renameSync(backupDirectory, outputDirectory);
		}
		throw reason;
	} finally {
		if (fs.existsSync(stagingDirectory)) fs.rmSync(stagingDirectory, { recursive: true, force: true });
		if (installed && fs.existsSync(backupDirectory)) fs.rmSync(backupDirectory, { recursive: true, force: true });
	}
}

function compileAPIStaticDir(options = {}) {
	const projectRoot = options.projectRoot || process.cwd();
	const endpointDir = path.resolve(projectRoot, options.endpointDir || "data/endpoint");
	const outputDir = path.resolve(projectRoot, options.outputDir || "public/_static/endpoint");
	const routeFiles = walkRouteFiles(endpointDir);

	if (routeFiles.length === 0) {
		fs.rmSync(outputDir, { recursive: true, force: true });
		return [];
	}

	const stagingDirectory = `${outputDir}.staging-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	fs.rmSync(stagingDirectory, { recursive: true, force: true });
	fs.mkdirSync(stagingDirectory, { recursive: true });

	const compiled = [];
	try {
		for (const filePath of routeFiles) {
			const relative = path.relative(endpointDir, filePath).replace(/\\/g, "/");
			const routeId = relative.slice(0, -".route".length);
			const source = fs.readFileSync(filePath, "utf8");
			const result = compileAPIStaticSource(source, routeId, relative);
			const stagedDestination = outputPathForRoute(stagingDirectory, result.route, result.hash);
			const finalDestination = outputPathForRoute(outputDir, result.route, result.hash);
			fs.mkdirSync(path.dirname(stagedDestination), { recursive: true });
			fs.writeFileSync(stagedDestination, result.code, "utf8");
			compiled.push({ route: result.route, hash: result.hash, operations: result.operations, output: finalDestination });
		}
		swapCompiledOutput(stagingDirectory, outputDir);
		return compiled;
	} catch (reason) {
		fs.rmSync(stagingDirectory, { recursive: true, force: true });
		throw reason;
	}
}

module.exports = {
	compileAPIStaticDir,
	compileAPIStaticSource,
	getRouteHash,
	normalizeRouteId,
};
