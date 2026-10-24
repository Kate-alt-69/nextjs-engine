export const ENGINE_DEBUG_RUNTIME_SCRIPT = String.raw`(function () {
"use strict";
var bootKey = "__NEXT_ENGINE_DEBUG_INLINE_ACTIVE__";
var currentUrl = new URL(window.location.href);
if (window.parent !== window || currentUrl.searchParams.get("__engine_debug") === "1" || window[bootKey]) return;
window[bootKey] = true;

var callouts = new Map();
var recent = new Map();
var MAX_CALLOUTS = 8;
var handoffKey = "nextjs-engine:debug:diagnostic-handoff";
var SOURCE_LOCATION = /(?:^|[(/])((?:app|pages|src|components|lib|docs)\\/[A-Za-z0-9_./@()[\\]-]+\\.(?:tsx?|jsx?|mjs|cjs|json|css|md)):(\\d+)(?::(\\d+))?/g;
var SECRET_PATTERNS = [
	[/\\bBearer\\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]"],
	[/\\b(access[_-]?token|refresh[_-]?token|api[_-]?key|secret|password|authorization)\\s*[:=]\\s*([^\\s,;]+)/gi, "$1=[redacted]"],
	[/\\b(cookie|set-cookie)\\s*:\\s*[^\\r\\n]+/gi, "$1: [redacted]"]
];

function redact(value, limit) {
	var result;
	if (value && typeof value === "object") {
		try {
			result = value.stack && value.message ? String(value.name || "Error") + ": " + String(value.message) + "\\n" + String(value.stack) : JSON.stringify(value);
		} catch (_) {
			result = String(value);
		}
	} else {
		result = String(value == null ? "" : value);
	}
	SECRET_PATTERNS.forEach(function (entry) { result = result.replace(entry[0], entry[1]); });
	return result.length > limit ? result.slice(0, limit) + "\\n…[truncated]" : result;
}

function parseSource(diagnostic) {
	var text = [diagnostic.location || "", diagnostic.message || "", diagnostic.detail || ""].join("\\n");
	SOURCE_LOCATION.lastIndex = 0;
	var match = SOURCE_LOCATION.exec(text);
	if (!match) return null;
	var line = Number(match[2]);
	var column = match[3] ? Number(match[3]) : undefined;
	if (!Number.isSafeInteger(line) || line < 1) return null;
	return { path: match[1].replace(/^\\.\\//, "").replace(/\\\\/g, "/"), line: line, column: column };
}

function parseSchemaPath(diagnostic) {
	var text = [diagnostic.location || "", diagnostic.message || "", diagnostic.detail || ""].join("\\n");
	var match = text.match(/(?:\\[schema:|schema(?:\\s+path)?\\s*[=:]\\s*)(root(?:\\.children\\[\\d+\\])*)/i);
	if (match && match[1]) return match[1];
	var location = String(diagnostic.location || "").trim();
	return /^root(?:\\.children\\[\\d+\\])*$/.test(location) ? location : null;
}

function findTarget(diagnostic) {
	var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-engine-debug-path][data-engine-debug-name]"));
	var schemaPath = parseSchemaPath(diagnostic);
	if (schemaPath) {
		var schemaMatches = nodes.filter(function (node) { return node.dataset.engineDebugPath === schemaPath; });
		if (schemaMatches.length === 1) return schemaMatches[0];
	}
	var names = [];
	var pattern = /\\b(?:at|in)\\s+([A-Z][A-Za-z0-9_$]*)\\b/g;
	var stackText = [diagnostic.message, diagnostic.detail].join("\\n");
	var match;
	while ((match = pattern.exec(stackText))) {
		if (!["Error", "Object", "Promise", "Array", "Function", "React", "Next", "Suspense", "Unknown"].includes(match[1]) && names.indexOf(match[1]) < 0) names.push(match[1]);
	}
	for (var i = 0; i < names.length; i++) {
		var matchedNodes = nodes.filter(function (node) {
			return String(node.dataset.engineDebugName || "").toLowerCase() === names[i].toLowerCase()
				|| String(node.dataset.engineDebugType || "").toLowerCase() === names[i].toLowerCase();
		});
		if (matchedNodes.length === 1) return matchedNodes[0];
	}
	return null;
}

function diagnose(source, message, detail, location) {
	var safeMessage = redact(message || "(empty diagnostic)", 1600).trim();
	var safeDetail = redact(detail || "", 6000).trim();
	var combined = (safeMessage + "\\n" + safeDetail).toLowerCase();
	var hydration = /hydration|hydrating|server html|did not match|text content does not match|hydration failed/.test(combined);
	var ssr = /server.?side render|server render|server component|error occurred prerender|failed to render on the server|ssr error/.test(combined);
	var warning = source === "console" && /\\bwarn(?:ing)?\\b|deprecated|will be removed/.test(combined) && !/uncaught|unhandled|fatal|error:|mismatch|hydration|did not match|failed|exception|server error/.test(combined);
	var owner = "Unknown";
	if (/src\\/engine\\/|\\/engine\\/debug\\/|nextjs-engine\\/(?:src\\/)?engine/i.test(combined)) owner = "Likely NE source";
	else if (/(^|[\\s("'\\\\])(?:src\\/)?(?:app|pages|components|lib)\\/|\\bat\\s+(?:async\\s+)?(?:Home|Page|Layout|RootLayout)\\b/.test(combined)) owner = "Likely application code";
	else if (/react-dom|react\\.production|next\\/dist|next\\.js|nextjs\\.org\\/docs\\/messages|react\\.dev\\/errors/.test(combined)) owner = "Likely React / Next.js";
	var now = Date.now();
	var safeLocation = location ? redact(location, 500) : undefined;
	var fingerprint = source + "|" + safeMessage + "|" + (safeLocation || "");
	var previous = recent.get(fingerprint);
	if (previous && now - previous.at < 1500) return previous.diagnostic;
	var stable = source + "|" + (hydration ? "Hydration" : ssr ? "SSR" : source === "console" ? "Console" : "Runtime") + "|" + safeMessage + "|" + (safeLocation || "");
	var hash = 2166136261;
	for (var index = 0; index < stable.length; index++) hash = Math.imul(hash ^ stable.charCodeAt(index), 16777619);
	var diagnostic = {
		id: (hash >>> 0).toString(16) + "-" + String(now),
		at: now,
		severity: warning ? "warning" : "error",
		category: hydration ? "Hydration" : ssr ? "SSR" : source === "console" ? "Console" : "Runtime",
		source: source,
		ownerHint: owner,
		message: safeMessage,
		detail: safeDetail,
		location: safeLocation
	};
	recent.set(fingerprint, { at: now, diagnostic: diagnostic });
	if (recent.size > 50) recent.delete(recent.keys().next().value);
	return diagnostic;
}

function element(tag, className, text) {
	var node = document.createElement(tag);
	node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function renderCode(pre, preview) {
	pre.replaceChildren();
	preview.lines.forEach(function (entry) {
		var row = element("div", "code-line" + (entry.number === preview.highlightLine ? " is-error-line" : ""));
		row.append(element("span", "line-number", String(entry.number)));
		row.append(element("span", "line-text", entry.text || " "));
		pre.append(row);
	});
	var highlighted = pre.querySelector(".is-error-line");
	if (highlighted) highlighted.scrollIntoView({ block: "nearest" });
}

function openCallout(diagnostic, target, route) {
	var source = parseSource(diagnostic);
	var schemaPath = parseSchemaPath(diagnostic);
	var previous = target.getAttribute("data-engine-debug-error-target");
	target.setAttribute("data-engine-debug-error-target", "true");
	var styleId = "__engine_debug_error_callout_style__";
	var sharedStyle = document.getElementById(styleId);
	if (!sharedStyle) {
		sharedStyle = element("style", "");
		sharedStyle.id = styleId;
		sharedStyle.textContent = "[data-engine-debug-error-target='true']{outline:2px solid #f04452!important;outline-offset:3px!important}";
		document.head.append(sharedStyle);
	}
	var host = document.createElement("div");
	host.setAttribute("data-engine-debug-inline-callout", diagnostic.id);
	host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none";
	document.body.append(host);
	var shadow = host.attachShadow({ mode: "open" });
	var style = element("style", "");
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
		"@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}"
	].join("\\n");
	var anchor = element("div", "anchor");
	anchor.setAttribute("role", "group");
	anchor.setAttribute("aria-label", "EngineDebug error marker");
	var badge = element("button", "badge", "! Error");
	badge.type = "button";
	badge.title = diagnostic.message;
	var panel = element("section", "panel");
	panel.setAttribute("aria-label", "Error source preview");
	var sourcePath = source
		? source.path + ":" + source.line + (source.column ? ":" + source.column : "")
		: schemaPath ? "Schema · " + schemaPath : "Source mapping unavailable · " + route;
	var header = element("header", "source-path", sourcePath);
	var problem = element("div", "problem", diagnostic.category + " · " + diagnostic.message);
	var codeLabel = element("div", "code-label", "Source preview");
	var code = element("pre", "code");
	code.append(element("span", "unavailable", source ? "Loading source…" : "No trustworthy file/line mapping is available. Open the dashboard to inspect the full stack and details."));
	var footer = element("footer", "footer");
	var dashboard = element("button", "dashboard", "View on Dashboard");
	dashboard.type = "button";
	dashboard.addEventListener("click", function () {
		try {
			window.sessionStorage.setItem(handoffKey, JSON.stringify({ expiresAt: Date.now() + 60000, route: route, diagnostic: diagnostic }));
		} catch (_) {}
		var dashboardUrl = new URL("/_engine/debug", window.location.href);
		dashboardUrl.searchParams.set("route", route);
		dashboardUrl.searchParams.set("issue", diagnostic.id);
		window.location.assign(dashboardUrl.href);
	});
	footer.append(dashboard);
	panel.append(header, problem, codeLabel, code, footer);
	anchor.append(badge, panel);
	shadow.append(style, anchor);

	var updatePosition = function () {
		if (!target.isConnected || !host.isConnected) return;
		var rect = target.getBoundingClientRect();
		var x = Math.max(8, Math.min(window.innerWidth - 38, rect.right - 10));
		var y = Math.max(8, Math.min(window.innerHeight - 38, rect.top - 10));
		anchor.style.left = x + "px";
		anchor.style.top = y + "px";
		var badgeRect = badge.getBoundingClientRect();
		var panelWidth = Math.min(390, Math.max(220, window.innerWidth - 24));
		panel.style.left = Math.max(8, Math.min(window.innerWidth - panelWidth - 8, badgeRect.right - panelWidth)) + "px";
		var panelHeight = panel.getBoundingClientRect().height || Math.min(360, window.innerHeight - 24);
		var panelTop = badgeRect.bottom - 1;
		if (panelTop + panelHeight > window.innerHeight - 8) panelTop = Math.max(8, badgeRect.top - panelHeight + 1);
		panel.style.top = panelTop + "px";
	};
	var scheduleUpdate = function () { window.requestAnimationFrame(updatePosition); };
	updatePosition();
	window.addEventListener("resize", scheduleUpdate);
	window.addEventListener("scroll", scheduleUpdate, true);

	if (source) {
		var params = new URLSearchParams({ file: source.path, line: String(source.line) });
		fetch("/_engine/debug/source?" + params.toString(), { credentials: "same-origin", cache: "no-store" })
			.then(function (response) { if (!response.ok) throw new Error("Source preview unavailable"); return response.json(); })
			.then(function (preview) {
				if (!host.isConnected) return;
				header.textContent = preview.path + ":" + preview.highlightLine + (source.column ? ":" + source.column : "");
				renderCode(code, preview);
				scheduleUpdate();
			})
			.catch(function () {
				if (host.isConnected) {
					code.replaceChildren(element("span", "unavailable", "Source preview unavailable. Ensure the file is inside the current workspace and EngineDebug is running locally in development mode."));
				}
			});
	}
	callouts.set(diagnostic.id, { target: target, host: host, cleanup: function () {
		window.removeEventListener("resize", scheduleUpdate);
		window.removeEventListener("scroll", scheduleUpdate, true);
		host.remove();
		if (previous === null) target.removeAttribute("data-engine-debug-error-target");
		else target.setAttribute("data-engine-debug-error-target", previous);
		if (!document.querySelector("[data-engine-debug-error-target='true']") && sharedStyle && sharedStyle.isConnected) sharedStyle.remove();
	}});
	while (callouts.size > MAX_CALLOUTS) {
		var oldest = callouts.keys().next().value;
		var oldCallout = callouts.get(oldest);
		if (oldCallout) oldCallout.cleanup();
		callouts.delete(oldest);
	}
}

function report(source, message, detail, location) {
	var diagnostic = diagnose(source, message, detail, location);
	var target = findTarget(diagnostic);
	if (!target) return;
	var existing = callouts.get(diagnostic.id);
	if (existing) existing.cleanup();
	callouts.delete(diagnostic.id);
	openCallout(diagnostic, target, window.location.pathname);
}

window.addEventListener("error", function (event) {
	report("runtime", event.message || "Uncaught browser runtime error", event.error, event.filename ? event.filename + (event.lineno ? ":" + event.lineno : "") + (event.colno ? ":" + event.colno : "") : window.location.pathname);
});
window.addEventListener("unhandledrejection", function (event) {
	report("unhandled-rejection", "Unhandled promise rejection", event.reason, window.location.pathname);
});
var originalConsoleError = window.console.error;
window.console.error = function () {
	var args = Array.prototype.slice.call(arguments);
	var detail = args.map(function (value) { return redact(value, 1500); }).join("\\n");
	report("console", typeof args[0] === "string" ? args[0] : detail || "console.error", detail, window.location.pathname);
	return originalConsoleError.apply(window.console, args);
};
var scanOverlay = function () {
	Array.prototype.forEach.call(document.querySelectorAll("nextjs-portal, nextjs-error, [data-nextjs-dialog], [data-nextjs-error], [data-nextjs-error-message]"), function (node) {
		var text = String(node.shadowRoot && node.shadowRoot.textContent || node.innerText || node.textContent || "").trim();
		if (text && /(error|exception|failed|hydration|mismatch|digest)/i.test(text)) report("next-overlay", "Next.js development error overlay", text, window.location.pathname);
	});
};
var observer = new MutationObserver(scanOverlay);
if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
scanOverlay();
})();`;