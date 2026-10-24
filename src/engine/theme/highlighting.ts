import type { EngineHighlighterTokenKind, EngineMarkdownTokenPalette } from "../schema/types";
export type { EngineHighlighterTokenKind } from "../schema/types";

export interface EngineHighlighterToken {
	kind: EngineHighlighterTokenKind;
	text: string;
}

export interface EngineHighlighterProvider {
	/** Stable provider identifier used in createTheme().markdown.prettyPlease.provider. */
	id: string;
	name: string;
	/** Supported language IDs; aliases are normalized before checking. */
	languages: readonly string[];
	/** Synchronous tokenization; output is rendered as safe React text spans, never HTML. */
	highlight(code: string, language: string): readonly EngineHighlighterToken[] | null;
}

export interface EngineHighlighterProviderInfo {
	id: string;
	name: string;
	languages: string[];
}

export interface EngineHighlighterThemeInfo {
	id: string;
	name: string;
}

const MAX_CODE_LENGTH = 80_000;
const MAX_TOKEN_COUNT = 10_000;
const SAFE_PROVIDER_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const providers = new Map<string, EngineHighlighterProvider>();

const LANGUAGE_ALIASES: Record<string, string> = {
	ts: "typescript",
	typescript: "typescript",
	js: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	node: "javascript",
	nodejs: "javascript",
	"node.js": "javascript",
	tsx: "tsx",
	jsxs: "jsx",
	py: "python",
	sh: "bash",
	shell: "bash",
	zsh: "bash",
	yml: "yaml",
	htm: "html",
	h: "c",
	hh: "cpp",
	cc: "cpp",
	cxx: "cpp",
	rs: "rust",
};
const BUILTIN_LANGUAGES = [
	"bash", "c", "cpp", "css", "go", "html", "java", "javascript", "json",
	"jsx", "markdown", "python", "rust", "sql", "tsx", "typescript", "yaml",
] as const;

const JS_KEYWORDS = new Set([
	"as", "async", "await", "break", "case", "catch", "class", "const",
	"continue", "debugger", "default", "delete", "do", "else", "enum",
	"export", "extends", "finally", "for", "from", "function", "get", "if",
	"implements", "import", "in", "instanceof", "interface", "let", "new",
	"of", "package", "private", "protected", "public", "readonly", "return",
	"set", "static", "super", "switch", "throw", "try", "type", "typeof",
	"var", "void", "while", "yield", "keyof", "infer", "satisfies", "declare",
]);
const PYTHON_KEYWORDS = new Set([
	"and", "as", "assert", "async", "await", "break", "class", "continue",
	"def", "del", "elif", "else", "except", "finally", "for", "from",
	"global", "if", "import", "in", "is", "lambda", "nonlocal", "not",
	"or", "pass", "raise", "return", "try", "while", "with", "yield",
	"match", "case",
]);
const RUST_KEYWORDS = new Set([
	"as", "async", "await", "break", "const", "continue", "crate", "dyn",
	"else", "enum", "extern", "false", "fn", "for", "if", "impl", "in",
	"let", "loop", "match", "mod", "move", "mut", "pub", "ref", "return",
	"self", "Self", "static", "struct", "super", "trait", "true", "type",
	"unsafe", "use", "where", "while",
]);
const GENERIC_KEYWORDS = new Set([
	"and", "as", "async", "await", "break", "case", "catch", "class", "const",
	"continue", "default", "do", "else", "enum", "export", "extends", "false",
	"finally", "for", "from", "func", "function", "if", "implements", "import",
	"in", "interface", "let", "match", "mod", "mut", "new", "not", "null",
	"of", "or", "package", "private", "protected", "public", "raise", "return",
	"static", "struct", "switch", "throw", "trait", "try", "type", "use", "var",
	"void", "while", "with", "yield",
]);
const CONSTANTS = new Set([
	"true", "false", "null", "undefined", "NaN", "Infinity", "None", "True",
	"False", "this", "super", "self", "nil",
]);
const TYPE_NAMES = new Set([
	"Array", "BigInt", "Boolean", "Date", "Error", "Function", "Map", "Number",
	"Object", "Promise", "Record", "RegExp", "Set", "String", "Symbol", "WeakMap",
	"WeakSet", "any", "unknown", "never", "number", "string", "boolean", "void",
	"object", "bigint", "ReactNode", "ReactElement", "JSX", "Element", "Response",
	"Request", "Headers", "URL", "URLSearchParams", "ReadableStream",
]);
const DARK_PALETTE: Record<EngineHighlighterTokenKind | "foreground" | "background", string> = {
	plain: "#d4d4d4",
	foreground: "#d4d4d4",
	background: "#1e1e1e",
	keyword: "#569cd6",
	string: "#ce9178",
	comment: "#6a9955",
	number: "#b5cea8",
	type: "#4ec9b0",
	function: "#dcdcaa",
	property: "#9cdcfe",
	constant: "#569cd6",
	operator: "#d4d4d4",
	punctuation: "#d4d4d4",
};
const LIGHT_PALETTE: Record<EngineHighlighterTokenKind | "foreground" | "background", string> = {
	plain: "#1e1e1e",
	foreground: "#1e1e1e",
	background: "#ffffff",
	keyword: "#0000ff",
	string: "#a31515",
	comment: "#008000",
	number: "#098658",
	type: "#267f99",
	function: "#795e26",
	property: "#001080",
	constant: "#0000ff",
	operator: "#000000",
	punctuation: "#000000",
};

function isIdentifierStart(char: string): boolean {
	return /[A-Za-z_$]/.test(char);
}

function isIdentifierPart(char: string): boolean {
	return /[A-Za-z0-9_$]/.test(char);
}

function isDigit(char: string): boolean {
	return char >= "0" && char <= "9";
}

function isWhitespace(char: string): boolean {
	return char === " " || char === "\t" || char === "\n" || char === "\r" || char === "\f";
}

function isCommentLanguage(language: string): boolean {
	return ["python", "bash", "yaml", "sql"].includes(language);
}

function canUseSlashComments(language: string): boolean {
	return [
		"typescript", "javascript", "tsx", "jsx", "css", "scss", "c", "cpp",
		"go", "java", "rust", "sql",
	].includes(language);
}

function appendToken(
	tokens: EngineHighlighterToken[],
	kind: EngineHighlighterTokenKind,
	text: string,
): boolean {
	if (!text) return true;
	const last = tokens[tokens.length - 1];
	if (last && last.kind === kind) {
		last.text += text;
		return true;
	}
	if (tokens.length >= MAX_TOKEN_COUNT) return false;
	tokens.push({ kind, text });
	return true;
}

function scanQuotedString(code: string, start: number, quote: string): number {
	const triple = (quote === "'" || quote === "\"") && code.slice(start, start + 3) === quote.repeat(3);
	let index = start + (triple ? 3 : 1);
	while (index < code.length) {
		if (code[index] === "\\") {
			index = Math.min(code.length, index + 2);
			continue;
		}
		if (triple && code.slice(index, index + 3) === quote.repeat(3)) return index + 3;
		if (!triple && code[index] === quote) return index + 1;
		if (!triple && quote !== "\`" && (code[index] === "\n" || code[index] === "\r")) return index;
		index += 1;
	}
	return code.length;
}

function lineCommentStart(code: string, index: number, language: string): number {
	const next = code[index + 1];
	if (canUseSlashComments(language) && code[index] === "/" && (next === "/" || next === "*")) return index;
	if (isCommentLanguage(language) && code[index] === "#") return index;
	if (language === "sql" && code[index] === "-" && next === "-") return index;
	if (language === "html" && code.slice(index, index + 4) === "<!--") return index;
	return -1;
}

function scanCommentEnd(code: string, start: number, language: string): number {
	if (code.slice(start, start + 4) === "<!--") {
		const end = code.indexOf("-->", start + 4);
		return end < 0 ? code.length : end + 3;
	}
	if (code[start] === "/" && code[start + 1] === "*") {
		const end = code.indexOf("*/", start + 2);
		return end < 0 ? code.length : end + 2;
	}
	const newline = code.indexOf("\n", start);
	return newline < 0 ? code.length : newline;
}

function keywordSetFor(language: string): Set<string> {
	if (language === "typescript" || language === "javascript" || language === "tsx" || language === "jsx") return JS_KEYWORDS;
	if (language === "python") return PYTHON_KEYWORDS;
	if (language === "rust") return RUST_KEYWORDS;
	return GENERIC_KEYWORDS;
}

/**
 * Small linear-time tokenizer for common code fences. It deliberately favors
 * readable plain-text fallbacks over expensive parsing; providers can be
 * registered for full TextMate/VS Code-grade highlighting.
 */
export function highlightEngineLite(code: string, language: string): EngineHighlighterToken[] | null {
	if (typeof code !== "string" || code.length > MAX_CODE_LENGTH) return null;
	const normalized = normalizeEngineHighlightLanguage(language);
	if (!BUILTIN_LANGUAGES.includes(normalized as (typeof BUILTIN_LANGUAGES)[number])) return null;
	if (normalized === "markdown") return null;

	const tokens: EngineHighlighterToken[] = [];
	const keywords = keywordSetFor(normalized);
	let index = 0;
	while (index < code.length) {
		const start = index;
		const char = code[index];
		const next = code[index + 1];

		if (isWhitespace(char)) {
			index += 1;
			while (index < code.length && isWhitespace(code[index])) index += 1;
			if (!appendToken(tokens, "plain", code.slice(start, index))) return null;
			continue;
		}

		if (lineCommentStart(code, index, normalized) >= 0) {
			index = scanCommentEnd(code, start, normalized);
			if (!appendToken(tokens, "comment", code.slice(start, index))) return null;
			continue;
		}

		if (char === "'" || char === "\"" || char === "\`") {
			index = scanQuotedString(code, start, char);
			if (!appendToken(tokens, "string", code.slice(start, index))) return null;
			continue;
		}

		if (isDigit(char)) {
			index += 1;
			while (index < code.length && /[A-Za-z0-9_.]/.test(code[index])) index += 1;
			if (!appendToken(tokens, "number", code.slice(start, index))) return null;
			continue;
		}

		if (isIdentifierStart(char)) {
			index += 1;
			while (index < code.length && isIdentifierPart(code[index])) index += 1;
			const word = code.slice(start, index);
			let lookahead = index;
			while (lookahead < code.length && isWhitespace(code[lookahead])) lookahead += 1;
			let kind: EngineHighlighterTokenKind = "plain";
			if (CONSTANTS.has(word)) kind = "constant";
			else if (keywords.has(word)) kind = "keyword";
			else if (TYPE_NAMES.has(word) || (/^[A-Z]/.test(word) && ["typescript", "tsx", "javascript", "jsx", "python", "rust", "go", "java"].includes(normalized))) kind = "type";
			else if (normalized === "json" && code[lookahead] === ":") kind = "property";
			else if (code[lookahead] === "(") kind = "function";
			if (!appendToken(tokens, kind, word)) return null;
			continue;
		}

		if ("(){}[];,.<>".includes(char)) {
			index += 1;
			if (!appendToken(tokens, "punctuation", char)) return null;
			continue;
		}

		if ("+-*/%=!&|?:~^".includes(char)) {
			index += 1;
			while (index < code.length && "+-*/%=!&|?:~^".includes(code[index])) index += 1;
			if (!appendToken(tokens, "operator", code.slice(start, index))) return null;
			continue;
		}

		index += 1;
		if (!appendToken(tokens, "plain", char)) return null;
	}
	return tokens;
}

export function normalizeEngineHighlightLanguage(language: string): string {
	const normalized = String(language ?? "").trim().toLowerCase().replace(/^language-/, "");
	if (!normalized) return "";
	return LANGUAGE_ALIASES[normalized] ?? normalized;
}

/**
 * Accept strict HEX, rgb()/rgba(), and CSS Color 4 sRGB values. Color values
 * remain data and are never interpolated into generated stylesheet text.
 */
function validColorChannel(value: string, maximum: number): boolean {
	const trimmed = value.trim();
	const percentage = trimmed.endsWith("%");
	const raw = percentage ? trimmed.slice(0, -1).trim() : trimmed;
	if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)) return false;
	const number = Number(raw);
	return Number.isFinite(number) && number >= 0 && number <= (percentage ? 100 : maximum);
}

function validColorAlpha(value: string): boolean {
	const trimmed = value.trim();
	const percentage = trimmed.endsWith("%");
	const raw = percentage ? trimmed.slice(0, -1).trim() : trimmed;
	if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)) return false;
	const number = Number(raw);
	return Number.isFinite(number) && number >= 0 && number <= (percentage ? 100 : 1);
}

/**
 * Accept strict HEX, rgb()/rgba(), and CSS Color 4 sRGB values. Numeric
 * channels and alpha are range-checked; arbitrary CSS expressions/URLs are
 * not accepted as palette colors.
 */
export function normalizeEngineThemeColor(value: unknown): string | undefined {
	if (typeof value !== "string" || value.length > 80) return undefined;
	const color = value.trim();
	if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) return color;

	const rgbMatch = /^rgba?\((.*)\)$/i.exec(color);
	if (rgbMatch) {
		const body = rgbMatch[1].trim();
		let channels: string[];
		let alpha: string | undefined;
		if (body.includes(",")) {
			if (body.includes("/")) return undefined;
			const parts = body.split(",").map((part) => part.trim());
			if (parts.length !== 3 && parts.length !== 4) return undefined;
			channels = parts.slice(0, 3);
			alpha = parts[3];
		} else {
			const parts = body.split(/\s*\/\s*/);
			if (parts.length > 2) return undefined;
			channels = parts[0].trim().split(/\s+/);
			alpha = parts[1]?.trim();
			if (channels.length !== 3) return undefined;
		}
		if (!channels.every((channel) => validColorChannel(channel, 255))) return undefined;
		if (alpha !== undefined && !validColorAlpha(alpha)) return undefined;
		return color;
	}

	const srgbMatch = /^color\(\s*srgb\s+(.+)\)$/i.exec(color);
	if (srgbMatch) {
		const parts = srgbMatch[1].trim().split(/\s*\/\s*/);
		if (parts.length > 2) return undefined;
		const channels = parts[0].trim().split(/\s+/);
		if (channels.length !== 3) return undefined;
		if (!channels.every((channel) => validColorChannel(channel, 1))) return undefined;
		if (parts[1] !== undefined && !validColorAlpha(parts[1])) return undefined;
		return color;
	}

	return undefined;
}

export function getEngineHighlighterColor(
	kind: EngineHighlighterTokenKind,
	options: {
		theme?: string;
		palette?: EngineMarkdownTokenPalette;
		fallbackForeground?: string;
	} = {},
): string {
	const customPalette = options.palette;
	const customForeground = normalizeEngineThemeColor(customPalette?.foreground)
		?? normalizeEngineThemeColor(options.fallbackForeground)
		?? "#d4d4d4";
	if (customPalette) {
		// A custom palette is authoritative: unspecified scopes use its base
		// foreground and do not inherit provider defaults.
		return normalizeEngineThemeColor(customPalette[kind]) ?? customForeground;
	}
	const builtIn = options.theme === "vscode-light" ? LIGHT_PALETTE : DARK_PALETTE;
	return normalizeEngineThemeColor(builtIn[kind]) ?? customForeground;
}

function isValidProvider(value: unknown): value is EngineHighlighterProvider {
	if (!value || typeof value !== "object") return false;
	const candidate = value as EngineHighlighterProvider;
	return typeof candidate.id === "string"
		&& SAFE_PROVIDER_ID.test(candidate.id)
		&& typeof candidate.name === "string"
		&& candidate.name.length > 0
		&& candidate.name.length <= 120
		&& Array.isArray(candidate.languages)
		&& candidate.languages.length > 0
		&& candidate.languages.length <= 500
		&& candidate.languages.every((language) => typeof language === "string" && language.length <= 64)
		&& typeof candidate.highlight === "function";
}

const builtinProvider: EngineHighlighterProvider = Object.freeze({
	id: "engine-lite",
	name: "Engine Lite (lightweight)",
	languages: BUILTIN_LANGUAGES,
	highlight: highlightEngineLite,
});
providers.set(builtinProvider.id, builtinProvider);

export function registerEngineHighlighterProvider(provider: EngineHighlighterProvider): void {
	if (!isValidProvider(provider)) {
		throw new TypeError("Highlighter provider requires a safe ID, name, supported languages, and a highlight() function.");
	}
	if (providers.has(provider.id)) {
		if (providers.get(provider.id) === provider) return;
		throw new Error("Engine highlighter provider '" + provider.id + "' is already registered.");
	}
	providers.set(provider.id, Object.freeze({
		id: provider.id,
		name: provider.name,
		languages: Object.freeze([...provider.languages]),
		highlight: provider.highlight,
	}));
}

export function unregisterEngineHighlighterProvider(id: string): boolean {
	if (id === builtinProvider.id) return false;
	return providers.delete(id);
}

export function listEngineHighlighterProviders(): EngineHighlighterProviderInfo[] {
	return [...providers.values()]
		.map((provider) => ({
			id: provider.id,
			name: provider.name,
			languages: [...provider.languages].map(normalizeEngineHighlightLanguage).sort(),
		}))
		.sort((left, right) => left.id.localeCompare(right.id));
}

const BUILTIN_THEME_INFO: readonly EngineHighlighterThemeInfo[] = Object.freeze([
	Object.freeze({ id: "vscode-dark", name: "VS Code Dark (lightweight palette)" }),
	Object.freeze({ id: "vscode-light", name: "VS Code Light (lightweight palette)" }),
]);

export function listEngineHighlighterThemes(): EngineHighlighterThemeInfo[] {
	return BUILTIN_THEME_INFO.map((theme) => ({ ...theme }));
}
export function listEngineHighlighterLanguages(providerId?: string): string[] {
	const selected = providerId ? providers.get(providerId) : undefined;
	if (providerId && !selected) return [];
	const languages = selected
		? selected.languages
		: [...providers.values()].flatMap((provider) => [...provider.languages]);
	return [...new Set(languages.map(normalizeEngineHighlightLanguage).filter(Boolean))].sort();
}

export function highlightEngineCode(
	code: string,
	language: string,
	options: { provider?: string; theme?: string; palette?: EngineMarkdownTokenPalette } = {},
): EngineHighlighterToken[] | null {
	if (typeof code !== "string" || code.length > MAX_CODE_LENGTH) return null;
	const normalizedLanguage = normalizeEngineHighlightLanguage(language);
	if (!normalizedLanguage || normalizedLanguage === "ansi" || normalizedLanguage === "text" || normalizedLanguage === "plain") {
		return null;
	}
	const providerId = !options.provider || options.provider === "auto" ? builtinProvider.id : options.provider;
	const provider = providers.get(providerId);
	if (!provider) return null;
	const normalizedLanguages = new Set(provider.languages.map(normalizeEngineHighlightLanguage));
	if (!normalizedLanguages.has(normalizedLanguage)) return null;

	try {
		const tokens = provider.highlight(code, normalizedLanguage);
		if (!Array.isArray(tokens) || tokens.length > MAX_TOKEN_COUNT) return null;
		let joined = "";
		for (const token of tokens) {
			if (!token || typeof token.text !== "string" || !token.text
				|| !["plain", "keyword", "string", "comment", "number", "type", "function", "property", "constant", "operator", "punctuation"].includes(token.kind)) {
				return null;
			}
			joined += token.text;
			if (joined.length > code.length) return null;
		}
		if (joined !== code) return null;
		return tokens.slice();
	} catch {
		// A faulty custom provider must never take Markdown rendering down.
		return null;
	}
}
