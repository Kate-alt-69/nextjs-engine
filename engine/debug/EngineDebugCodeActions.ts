import type { EngineDebugDiagnostic } from "./EngineDebugDiagnostics";

export interface EngineDebugCodeAction {
	id: string;
	title: string;
	description: string;
	confidence: "high" | "medium";
	replacement: string;
	beforePreview: string;
	afterPreview: string;
}

const REACT_HOOKS = [
	"useState", "useEffect", "useMemo", "useRef", "useCallback", "useReducer",
	"useId", "useTransition", "useDeferredValue", "useLayoutEffect", "useOptimistic",
] as const;
const NEXT_NAVIGATION_HOOKS = ["useRouter", "usePathname", "useSearchParams", "useParams"] as const;

function getDirectiveInsertionIndex(source: string): number {
	const lines = source.split(/(?<=\n)/);
	let offset = 0;
	let index = 0;
	if (lines[0]?.startsWith("#!")) {
		offset += lines[0].length;
		index += 1;
	}
	let inBlockComment = false;
	while (index < lines.length) {
		const line = lines[index];
		const trimmed = line.trim();
		if (inBlockComment) {
			offset += line.length;
			index += 1;
			if (trimmed.includes("*/")) inBlockComment = false;
			continue;
		}
		if (!trimmed || trimmed.startsWith("//")) {
			offset += line.length;
			index += 1;
			continue;
		}
		if (trimmed.startsWith("/*")) {
			offset += line.length;
			index += 1;
			if (!trimmed.includes("*/")) inBlockComment = true;
			continue;
		}
		if (/^(['"])use (?:client|server)\1;?\s*$/.test(trimmed)) offset += line.length;
		break;
	}
	return offset;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
}

function hasNamedImport(source: string, moduleName: string, symbol: string): boolean {
	const escaped = escapeRegExp(moduleName);
	const matcher = new RegExp("import\\s*\\{([^}]*)\\}\\s*from\\s*(['\"])" + escaped + "\\2", "g");
	for (const match of source.matchAll(matcher)) {
		const names = match[1].split(",").map((entry) => entry.trim().replace(/^type\s+/, "").split(/\s+as\s+/).at(-1)).filter(Boolean);
		if (names.includes(symbol)) return true;
	}
	const defaultMatcher = new RegExp("import\\s+" + escapeRegExp(symbol) + "\\s*(?:,|\\s+from)\\s*(['\"])" + escaped + "\\1");
	return defaultMatcher.test(source);
}

function hasDefaultImport(source: string, moduleName: string, symbol: string): boolean {
	const escapedModule = escapeRegExp(moduleName);
	if (symbol === "React" && new RegExp("import\\s+\\*\\s+as\\s+React\\s+from\\s*(['\"])"+escapedModule+"\\1").test(source)) return true;
	return new RegExp("import\\s+" + escapeRegExp(symbol) + "\\s+from\\s*(['\"])"+escapedModule+"\\1").test(source);
}

function insertDefaultImport(source: string, moduleName: string, symbol: string): string {
	if (hasDefaultImport(source, moduleName, symbol)) return source;
	const insertion = getDirectiveInsertionIndex(source);
	const before = source.slice(0, insertion);
	const after = source.slice(insertion);
	const separatorBefore = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
	const separatorAfter = after.length > 0 && !after.startsWith("\n") ? "\n" : "";
	return before + separatorBefore + 'import ' + symbol + ' from "' + moduleName + '";\n' + separatorAfter + after;
}

function insertImport(source: string, moduleName: string, symbols: readonly string[]): string {
	const missing = symbols.filter((symbol) => !hasNamedImport(source, moduleName, symbol));
	if (missing.length === 0) return source;
	const escaped = escapeRegExp(moduleName);
	const namedImport = new RegExp("(import\\s*\\{)([^}]*)(\\}\\s*from\\s*(['\"])" + escaped + "\\4\\s*;?)");
	const match = source.match(namedImport);
	if (match) {
		const existing = match[2].trim();
		const joiner = existing ? ", " : "";
		return source.replace(namedImport, (_whole, start, contents, end) => start + contents + joiner + missing.join(", ") + end);
	}
	const insertion = getDirectiveInsertionIndex(source);
	const before = source.slice(0, insertion);
	const after = source.slice(insertion);
	const separatorBefore = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
	const separatorAfter = after.length > 0 && !after.startsWith("\n") ? "\n" : "";
	return before + separatorBefore + "import { " + missing.join(", ") + ' } from "' + moduleName + '";\n' + separatorAfter + after;
}

function createAction(id: string, title: string, description: string, confidence: EngineDebugCodeAction["confidence"], before: string, after: string): EngineDebugCodeAction | null {
	if (before === after) return null;
	const beforeLines = before.split(/\r?\n/);
	const afterLines = after.split(/\r?\n/);
	let prefix = 0;
	while (prefix < beforeLines.length && prefix < afterLines.length && beforeLines[prefix] === afterLines[prefix]) prefix += 1;
	let suffix = 0;
	while (suffix < beforeLines.length - prefix && suffix < afterLines.length - prefix
		&& beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]) suffix += 1;
	const start = Math.max(0, prefix - 2);
	const endBefore = Math.min(beforeLines.length, Math.max(prefix + 6, beforeLines.length - suffix + 2));
	const endAfter = Math.min(afterLines.length, Math.max(prefix + 6, afterLines.length - suffix + 2));
	const preview = (lines: string[], end: number) => lines.slice(start, Math.max(start + 1, Math.min(end, start + 12))).join("\n");
	return { id, title, description, confidence, replacement: after, beforePreview: preview(beforeLines, endBefore), afterPreview: preview(afterLines, endAfter) };
}

function getImportCompletions(source: string): EngineDebugCodeAction[] {
	const actions: EngineDebugCodeAction[] = [];
	const missingHooks = REACT_HOOKS.filter((hook) => new RegExp("\\b" + hook + "\\s*\\(").test(source) && !hasNamedImport(source, "react", hook));
	if (missingHooks.length) {
		const action = createAction("react-hooks-import", "Import missing React hooks", "Add " + missingHooks.join(", ") + " to the React imports. Review the preview before saving.", "high", source, insertImport(source, "react", missingHooks));
		if (action) actions.push(action);
	}
	const missingNavigationHooks = NEXT_NAVIGATION_HOOKS.filter((hook) => new RegExp("\\b" + hook + "\\s*\\(").test(source) && !hasNamedImport(source, "next/navigation", hook));
	if (missingNavigationHooks.length) {
		const action = createAction("next-navigation-hooks-import", "Import Next.js navigation hooks", "Add " + missingNavigationHooks.join(", ") + " from next/navigation.", "high", source, insertImport(source, "next/navigation", missingNavigationHooks));
		if (action) actions.push(action);
	}
	if (/<Link(?:\s|>)/.test(source) && !hasNamedImport(source, "next/link", "Link")) {
		const action = createAction("next-link-import", "Import next/link", "Add the default Link component import for the JSX element.", "high", source, insertDefaultImport(source, "next/link", "Link"));
		if (action) actions.push(action);
	}
	if (/<Image(?:\s|>)/.test(source) && !hasNamedImport(source, "next/image", "Image")) {
		const action = createAction("next-image-import", "Import next/image", "Add the default Image component import for the JSX element.", "high", source, insertDefaultImport(source, "next/image", "Image"));
		if (action) actions.push(action);
	}
	if (/\bReact\s*\./.test(source) && !hasDefaultImport(source, "react", "React")) {
		const insertion = getDirectiveInsertionIndex(source);
		const before = source.slice(0, insertion);
		const after = source.slice(insertion);
		const replacement = before + (before && !before.endsWith("\n") ? "\n" : "") + 'import React from "react";\n' + (after && !after.startsWith("\n") ? "\n" : "") + after;
		const action = createAction("react-namespace-import", "Import React namespace", "Add the React default import for React.* references.", "high", source, replacement);
		if (action) actions.push(action);
	}
	return actions;
}

export function getEngineDebugAutoCompletions(filePath: string, source: string): EngineDebugCodeAction[] {
	if (!/\.(?:tsx?|jsx?)$/i.test(filePath)) return [];
	return getImportCompletions(source);
}

export function getEngineDebugFixSuggestions(
	diagnostic: Pick<EngineDebugDiagnostic, "message" | "detail" | "location" | "source" | "category">,
	filePath: string,
	source: string,
): EngineDebugCodeAction[] {
	if (!/\.(?:tsx?|jsx?)$/i.test(filePath)) return [];
	const combined = [diagnostic.message, diagnostic.detail, diagnostic.location ?? ""].join("\n");
	const actions: EngineDebugCodeAction[] = [];
	const clientComponentError = /(client component|only works in client|needs.{0,30}client|use client directive|server component)/i.test(combined)
		&& /\b(useState|useEffect|useLayoutEffect|useReducer|useRef|useMemo|useCallback)\b/.test(combined);
	if (clientComponentError && !/^\s*["']use client["'];?\s*$/m.test(source)) {
		const insertion = getDirectiveInsertionIndex(source);
		const before = source.slice(0, insertion);
		const after = source.slice(insertion);
		const replacement = before + (before && !before.endsWith("\n") ? "\n" : "") + '"use client";\n' + (after && !after.startsWith("\n") ? "\n" : "") + after;
		const action = createAction("add-use-client", "Add the use client directive", "This diagnostic mentions a Client Component requirement. The change stays in the editor buffer until you save.", "high", source, replacement);
		if (action) actions.push(action);
	}
	const missingMatch = combined.match(/(?:ReferenceError:\s*)?([A-Za-z_$][\w$]*)\s+is not defined|Cannot find (?:name|variable)\s+['"]([A-Za-z_$][\w$]*)['"]/i);
	const missing = missingMatch?.[1] ?? missingMatch?.[2];
	if (missing) {
		for (const action of getImportCompletions(source)) {
			if (new RegExp("\\b" + escapeRegExp(missing) + "\\b").test(action.title + " " + action.description)) actions.push(action);
		}
	}
	const typo = combined.match(/Cannot find (?:name|variable)\s+['"]([A-Za-z_$][\w$]*)['"][\s\S]{0,100}?Did you mean\s+['"]([A-Za-z_$][\w$]*)['"]/i);
	if (typo && new RegExp("\\b" + escapeRegExp(typo[1]) + "\\b").test(source)) {
		const replacement = source.replace(new RegExp("\\b" + escapeRegExp(typo[1]) + "\\b", "g"), typo[2]);
		const action = createAction("replace-suggested-identifier", "Replace " + typo[1] + " with " + typo[2], "The compiler suggested this identifier. Review every changed occurrence before saving.", "medium", source, replacement);
		if (action) actions.push(action);
	}
	return actions.filter((action, index, list) => list.findIndex((entry) => entry.replacement === action.replacement) === index);
}
