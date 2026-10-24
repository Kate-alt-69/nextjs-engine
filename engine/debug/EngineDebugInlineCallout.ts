import type { EngineDebugDiagnostic } from "./EngineDebugDiagnostics";

interface EngineDebugMappedSource {
	path: string;
	line: number;
	column?: number;
}

interface EngineDebugSourcePreview {
	path: string;
	startLine: number;
	highlightLine: number;
	totalLines: number;
	lines: Array<{ number: number; text: string }>;
}

const TARGET_COUNTS = new WeakMap<HTMLElement, { count: number; previous: string | null }>();
const SOURCE_LOCATION = /(?:^|[\s(/])((?:app|pages|src|components|lib|docs)\/[A-Za-z0-9_./@()[\]-]+\.(?:tsx?|jsx?|mjs|cjs|json|css|md)):(\d+)(?::(\d+))?/g;
const IGNORED_COMPONENTS = new Set(["Error", "Object", "Promise", "Array", "Function", "React", "Next", "Suspense", "Unknown"]);

export function parseEngineDebugSourceLocation(diagnostic: Pick<EngineDebugDiagnostic, "location" | "message" | "detail">): EngineDebugMappedSource | null {
	const text = [diagnostic.location ?? "", diagnostic.message, diagnostic.detail].join("\n");
	SOURCE_LOCATION.lastIndex = 0;
	const match = SOURCE_LOCATION.exec(text);
	if (!match) return null;
	const line = Number(match[2]);
	const column = match[3] ? Number(match[3]) : undefined;
	if (!Number.isSafeInteger(line) || line < 1) return null;
	return { path: match[1].replace(/^\.\//, "").replace(/\\/g, "/"), line, column };
}

export function parseEngineDebugSchemaPath(diagnostic: Pick<EngineDebugDiagnostic, "location" | "message" | "detail">): string | null {
	const text = [diagnostic.location ?? "", diagnostic.message, diagnostic.detail].join("\n");
	const explicit = text.match(/(?:\[schema:|schema(?:\s+path)?\s*[=:]\s*)(root(?:\.children\[\d+\])*)/i);
	if (explicit?.[1]) return explicit[1];
	const location = (diagnostic.location ?? "").trim();
	if (/^root(?:\.children\[\d+\])*$/.test(location)) return location;
	return null;
}

function componentNames(text: string): string[] {
	const names: string[] = [];
	const pattern = /\b(?:at|in)\s+([A-Z][A-Za-z0-9_$]*)\b/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(text))) {
		const value = match[1];
		if (!IGNORED_COMPONENTS.has(value) && !names.includes(value)) names.push(value);
	}
	return names;
}

export function findEngineDebugDiagnosticTarget(
	document: Document,
	diagnostic: Pick<EngineDebugDiagnostic, "location" | "message" | "detail">,
): HTMLElement | null {
	const nodes = [...document.querySelectorAll<HTMLElement>("[data-engine-debug-path][data-engine-debug-name]")];
	const schemaPath = parseEngineDebugSchemaPath(diagnostic);
	if (schemaPath) {
		const exact = nodes.filter((node) => node.dataset.engineDebugPath === schemaPath);
		if (exact.length === 1) return exact[0];
	}

	const names = componentNames([diagnostic.message, diagnostic.detail].join("\n"));
	for (const name of names) {
		const exact = nodes.filter((node) =>
			(node.dataset.engineDebugName ?? "").toLowerCase() === name.toLowerCase()
			|| (node.dataset.engineDebugType ?? "").toLowerCase() === name.toLowerCase(),
		);
		if (exact.length === 1) return exact[0];
	}
	return null;
}

function el<K extends keyof HTMLElementTagNameMap>(document: Document, tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag);
	element.className = className;
	if (text !== undefined) element.textContent = text;
	return element;
}

function renderUnavailableCode(pre: HTMLElement, message: string): void {
	pre.replaceChildren(el(pre.ownerDocument, "span", "unavailable", message));
}

function renderSourceCode(pre: HTMLElement, preview: EngineDebugSourcePreview): void {
	pre.replaceChildren();
	for (const entry of preview.lines) {
		const row = el(pre.ownerDocument, "div", "code-line" + (entry.number === preview.highlightLine ? " is-error-line" : ""));
		row.append(el(pre.ownerDocument, "span", "line-number", String(entry.number)));
		row.append(el(pre.ownerDocument, "span", "line-text", entry.text || " "));
		pre.append(row);
	}
	const highlighted = pre.querySelector(".is-error-line");
	highlighted?.scrollIntoView({ block: "nearest" });
}

export function installEngineDebugInlineCallout(
	document: Document,
	diagnostic: EngineDebugDiagnostic,
	route: string,
): (() => void) | null {
	const target = findEngineDebugDiagnosticTarget(document, diagnostic);
	if (!target || !document.body) return null;
	const view = document.defaultView;
	if (!view) return null;
	const source = parseEngineDebugSourceLocation(diagnostic);
	const schemaPath = parseEngineDebugSchemaPath(diagnostic);
	const previousTargetValue = target.getAttribute("data-engine-debug-error-target");
	const targetState = TARGET_COUNTS.get(target) ?? { count: 0, previous: previousTargetValue };
	targetState.count += 1;
	TARGET_COUNTS.set(target, targetState);
	target.setAttribute("data-engine-debug-error-target", "true");

	let sharedStyle = document.getElementById("__engine_debug_error_callout_style__") as HTMLStyleElement | null;
	if (!sharedStyle) {
		sharedStyle = document.createElement("style");
		sharedStyle.id = "__engine_debug_error_callout_style__";
		sharedStyle.textContent = "[data-engine-debug-error-target='true']{outline:2px solid #f04452!important;outline-offset:3px!important}";
		document.head.append(sharedStyle);
	}

	const host = document.createElement("div");
	host.setAttribute("data-engine-debug-inline-callout", diagnostic.id);
	host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none";
	document.body.append(host);
	const shadow = host.attachShadow({ mode: "open" });
	const style = el(document, "style", "");
	style.textContent = [
		":host{all:initial;color-scheme:dark;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif}",
		".anchor{position:fixed;pointer-events:auto;z-index:2147483647}",
		".badge{display:flex;align-items:center;gap:5px;border:1px solid #f87171;border-radius:99px;background:#991b1b;color:#fff;font:800 12px/1 ui-sans-serif,system-ui;padding:5px 8px;box-shadow:0 2px 12px #0006;cursor:pointer}",
		".badge:hover,.badge:focus-visible{background:#b91c1c;outline:2px solid #fecaca;outline-offset:2px}",
		".panel{display:flex;flex-direction:column;visibility:hidden;pointer-events:none;position:fixed;width:min(390px,calc(100vw - 24px));max-height:min(440px,calc(100vh - 24px));overflow:hidden;border:1px solid #484848;border-radius:8px;background:#1f1f1f;color:#e5e7eb;box-shadow:0 18px 55px #0009;font-size:12px}",
		".anchor:hover .panel,.anchor:focus-within .panel{visibility:visible;pointer-events:auto}",
		".source-path{padding:10px 12px;background:#252526;border-bottom:1px solid #3c3c3c;color:#9cdcfe;font:11px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}",
		".problem{padding:9px 12px 7px;color:#fca5a5;font-weight:650;line-height:1.45;overflow-wrap:anywhere}",
		".code-label{padding:4px 12px;color:#9da0a5;font:10px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.06em}",
		".code{margin:0;padding:7px 0;overflow:auto;max-height:245px;background:#181818;color:#d4d4d4;font:11px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre;tab-size:2}",
		".code-line{display:grid;grid-template-columns:42px minmax(0,1fr);gap:10px;padding:0 12px}",
		".line-number{text-align:right;color:#777;user-select:none}",
		".line-text{white-space:pre;overflow-wrap:normal}",
		".is-error-line{background:#5b252a;border-left:2px solid #f04452;padding-left:10px;color:#fff}",
		".unavailable{display:block;padding:10px 14px;color:#b9b9b9;white-space:normal;line-height:1.55}",
		".footer{display:flex;justify-content:flex-end;gap:8px;padding:9px 10px;background:#252526;border-top:1px solid #3c3c3c}",
		".dashboard{border:1px solid #0e639c;border-radius:4px;padding:7px 10px;background:#007acc;color:white;font:600 11px ui-sans-serif,system-ui;cursor:pointer}",
		".dashboard:hover,.dashboard:focus-visible{background:#168bd2;outline:2px solid #75beff;outline-offset:1px}",
		"@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}",
	].join("\n");
	const anchor = el(document, "div", "anchor");
	anchor.setAttribute("role", "group");
	anchor.setAttribute("aria-label", "EngineDebug error marker");
	const badge = el(document, "button", "badge", "! Error");
	badge.type = "button";
	badge.title = diagnostic.message;
	const panel = el(document, "section", "panel");
	panel.setAttribute("aria-label", "Error source preview");
	const sourcePath = source
		? source.path + ":" + source.line + (source.column ? ":" + source.column : "")
		: schemaPath ? "Schema · " + schemaPath : "Source mapping unavailable · " + route;
	const header = el(document, "header", "source-path", sourcePath);
	const problem = el(document, "div", "problem", diagnostic.category + " · " + diagnostic.message);
	const codeLabel = el(document, "div", "code-label", "Source preview");
	const code = el(document, "pre", "code");
	if (source) {
		renderUnavailableCode(code, "Loading source…");
	} else {
		renderUnavailableCode(code, "This diagnostic has no trustworthy file/line mapping. The element was matched by its Engine schema path or unique component name; open the dashboard to inspect the full stack and details.");
	}
	const footer = el(document, "footer", "footer");
	const dashboard = el(document, "button", "dashboard", "View on Dashboard");
	dashboard.type = "button";
	dashboard.addEventListener("click", () => {
		const handoffKey = "nextjs-engine:debug:diagnostic-handoff";
		const destination = view.top ?? view;
		try {
			destination.sessionStorage.setItem(handoffKey, JSON.stringify({
				expiresAt: Date.now() + 60_000,
				route,
				diagnostic,
			}));
		} catch {
			// The dashboard still opens when session storage is unavailable.
		}
		const dashboardUrl = new URL("/_engine/debug", view.location.href);
		dashboardUrl.searchParams.set("route", route);
		dashboardUrl.searchParams.set("issue", diagnostic.id);
		try {
			destination.location.assign(dashboardUrl.href);
		} catch {
			view.location.assign(dashboardUrl.href);
		}
	});
	footer.append(dashboard);
	panel.append(header, problem, codeLabel, code, footer);
	anchor.append(badge, panel);
	shadow.append(style, anchor);

	const updatePosition = () => {
		if (!target.isConnected || !host.isConnected) return;
		const rect = target.getBoundingClientRect();
		const x = Math.max(8, Math.min(view.innerWidth - 38, rect.right - 10));
		const y = Math.max(8, Math.min(view.innerHeight - 38, rect.top - 10));
		anchor.style.left = x + "px";
		anchor.style.top = y + "px";
		const badgeRect = badge.getBoundingClientRect();
		const panelWidth = Math.min(390, Math.max(220, view.innerWidth - 24));
		const panelLeft = Math.max(8, Math.min(view.innerWidth - panelWidth - 8, badgeRect.right - panelWidth));
		panel.style.left = panelLeft + "px";
		const panelHeight = panel.getBoundingClientRect().height || Math.min(360, view.innerHeight - 24);
		let panelTop = badgeRect.bottom - 1;
		if (panelTop + panelHeight > view.innerHeight - 8) panelTop = Math.max(8, badgeRect.top - panelHeight + 1);
		panel.style.top = panelTop + "px";
	};
	const scheduleUpdate = () => view.requestAnimationFrame(updatePosition);
	updatePosition();
	view.addEventListener("resize", scheduleUpdate);
	view.addEventListener("scroll", scheduleUpdate, true);

	if (source) {
		const params = new URLSearchParams({ file: source.path, line: String(source.line) });
		void view.fetch("/_engine/debug/source?" + params.toString(), { credentials: "same-origin", cache: "no-store" })
			.then(async (response) => {
				if (!response.ok) throw new Error("Source preview unavailable");
				return response.json() as Promise<EngineDebugSourcePreview>;
			})
			.then((preview) => {
				if (!host.isConnected) return;
				header.textContent = preview.path + ":" + preview.highlightLine + (source.column ? ":" + source.column : "");
				renderSourceCode(code, preview);
				scheduleUpdate();
			})
			.catch(() => {
				if (host.isConnected) renderUnavailableCode(code, "The source preview could not be loaded. Check that the reported file is inside the current local workspace and that EngineDebug is running in development mode.");
			});
	}

	let cleaned = false;
	return () => {
		if (cleaned) return;
		cleaned = true;
		view.removeEventListener("resize", scheduleUpdate);
		view.removeEventListener("scroll", scheduleUpdate, true);
		host.remove();
		const state = TARGET_COUNTS.get(target);
		if (state) {
			state.count -= 1;
			if (state.count <= 0) {
				if (state.previous === null) target.removeAttribute("data-engine-debug-error-target");
				else target.setAttribute("data-engine-debug-error-target", state.previous);
				TARGET_COUNTS.delete(target);
			}
		} else if (previousTargetValue === null) {
			target.removeAttribute("data-engine-debug-error-target");
		} else {
			target.setAttribute("data-engine-debug-error-target", previousTargetValue);
		}
		if (sharedStyle && sharedStyle.isConnected && !document.querySelector("[data-engine-debug-error-target='true']")) sharedStyle.remove();
	};
}
