export interface EngineDebugDynamicParameter {
	name: string;
	kind: "single" | "catch-all" | "optional-catch-all";
}

export function isEngineDebugDynamicRoute(route: string): boolean {
	return route.split("/").some(segment => segment.startsWith("[") && segment.endsWith("]"));
}

export function getEngineDebugDynamicParameters(route: string): EngineDebugDynamicParameter[] {
	const parameters: EngineDebugDynamicParameter[] = [];
	for (const segment of route.split("/")) {
		const optionalCatchAll = segment.match(/^\[\[\.\.\.([^\]]+)\]\]$/);
		if (optionalCatchAll) {
			parameters.push({ name: optionalCatchAll[1], kind: "optional-catch-all" });
			continue;
		}
		const catchAll = segment.match(/^\[\.\.\.([^\]]+)\]$/);
		if (catchAll) {
			parameters.push({ name: catchAll[1], kind: "catch-all" });
			continue;
		}
		const single = segment.match(/^\[([^\]]+)\]$/);
		if (single) parameters.push({ name: single[1], kind: "single" });
	}
	return parameters;
}

export function matchesEngineDebugRoutePattern(pattern: string, concretePath: string): boolean {
	const expected = pattern.split("/").filter(Boolean);
	const actual = concretePath.split(/[?#]/, 1)[0].split("/").filter(Boolean);
	let index = 0;
	for (const segment of expected) {
		if (/^\[\[\.\.\.[^\]]+\]\]$/.test(segment)) return true;
		if (/^\[\.\.\.[^\]]+\]$/.test(segment)) return actual.length > index;
		if (/^\[[^\]]+\]$/.test(segment)) {
			if (!actual[index]) return false;
			index += 1;
			continue;
		}
		if (actual[index] !== segment) return false;
		index += 1;
	}
	return index === actual.length;
}

export function buildEngineDebugDynamicRoute(pattern: string, values: Record<string, string>): { path: string; error?: string } {
	const output: string[] = [];
	for (const segment of pattern.split("/")) {
		if (!segment) continue;
		const optionalCatchAll = segment.match(/^\[\[\.\.\.([^\]]+)\]\]$/);
		const catchAll = segment.match(/^\[\.\.\.([^\]]+)\]$/);
		const single = segment.match(/^\[([^\]]+)\]$/);
		const match = optionalCatchAll ?? catchAll ?? single;
		if (!match) {
			output.push(segment);
			continue;
		}
		const name = optionalCatchAll ? optionalCatchAll[1] : catchAll ? catchAll[1] : single![1];
		const value = (values[name] ?? "").trim();
		if (!value) {
			if (optionalCatchAll) continue;
			return { path: "", error: "Enter a value for " + name + "." };
		}
		const pieces = catchAll || optionalCatchAll ? value.split("/").map(part => part.trim()).filter(Boolean) : [value];
		if (pieces.length === 0 && !optionalCatchAll) return { path: "", error: "Enter a value for " + name + "." };
		for (const part of pieces) {
			if (part === "." || part === ".." || /[\u0000-\u001f]/.test(part)) return { path: "", error: name + " contains an invalid path segment." };
			output.push(encodeURIComponent(part));
		}
	}
	return { path: "/" + output.join("/") };
}


export function inferEngineDebugOverlayRoute(detail: string, knownPatterns: readonly string[] = []): string | null {
	const text = detail.replace(/\\/g, "/");
	const trigger = /(?:failed to compile|compilation failed|failed compiling|error compiling|failed to render (?:route|page)|error (?:in|on) route)\s*(?:for\s+)?(?:route\s+)?[:\-]?\s*/i;
	const triggerMatch = trigger.exec(text);
	if (triggerMatch) {
		const tail = text.slice(triggerMatch.index + triggerMatch[0].length);
		const explicit = tail.match(/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/\[\]-]+/);
		if (explicit) {
			const route = explicit[0].replace(/[.,;:]+$/, "");
			if (route.startsWith("/") && !route.startsWith("/_engine/debug")) return route || "/";
		}
	}

	const appFile = text.match(/(?:^|[\s"'(\x60])(?:\.\/)?(?:src\/)?app\/((?:[^/\s"'\x60]+\/)*?)(?:page|layout|route)\.(?:tsx?|jsx?)(?::\d+(?::\d+)?)?/i);
	if (appFile) {
		const segments = (appFile[1] ?? "").split("/").filter(Boolean)
			.filter(segment => !(segment.startsWith("(") && segment.endsWith(")")) && !segment.startsWith("@"));
		const route = "/" + segments.join("/");
		if (route !== "/_engine/debug" && !route.startsWith("/_engine/debug/")) return route;
	}

	const pagesFile = text.match(/(?:^|[\s"'(\x60])(?:\.\/)?(?:src\/)?pages\/([^\s"'\x60]+?)\.(?:tsx?|jsx?|mjs|cjs)(?::\d+(?::\d+)?)?/i);
	if (pagesFile) {
		const segments = (pagesFile[1] ?? "").split("/").filter(Boolean);
		if (segments.some(segment => ["_app", "_document", "_error"].includes(segment.replace(/\.[^.]+$/, "")))) return null;
		if (segments[segments.length - 1] === "index") segments.pop();
		const route = "/" + segments.join("/");
		if (route !== "/_engine/debug" && !route.startsWith("/_engine/debug/")) return route;
	}

	const matches = knownPatterns
		.filter(route => route !== "/" && text.includes(route))
		.sort((left, right) => right.length - left.length);
	return matches[0] ?? null;
}
