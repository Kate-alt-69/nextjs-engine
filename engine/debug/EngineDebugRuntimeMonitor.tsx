"use client";

import { useEffect } from "react";
import {
	appendEngineDebugDiagnostics,
	createEngineDebugDiagnostic,
	redactEngineDebugText,
} from "./EngineDebugDiagnostics";
import type { EngineDebugSource } from "./EngineDebugDiagnostics";
import { installEngineDebugInlineCallout } from "./EngineDebugInlineCallout";

export function EngineDebugRuntimeMonitor() {
	useEffect(() => {
		const url = new URL(window.location.href);
		const debugWindow = window as Window & { __NEXT_ENGINE_DEBUG_INLINE_ACTIVE__?: boolean };
		// Capture this document's console object. `window` can act as a WindowProxy
		// across navigation, so teardown must not restore an old handler onto the
		// replacement document's console.
		const debugConsole = console;
		// The injected inline runtime script and this React monitor share the same
		// capture bridge. Only one may patch console.error or they can recursively
		// capture each other's diagnostic reports in development browsers.
		if (url.searchParams.get("__engine_debug") === "1" || debugWindow.__NEXT_ENGINE_DEBUG_INLINE_ACTIVE__) return;
		debugWindow.__NEXT_ENGINE_DEBUG_INLINE_ACTIVE__ = true;

		const callouts = new Map<string, () => void>();
		const calloutRoutes = new Map<string, string>();
		let diagnostics = [] as ReturnType<typeof createEngineDebugDiagnostic>[];
		const report = (source: EngineDebugSource, message: unknown, detail?: unknown, location?: string) => {
			const incoming = createEngineDebugDiagnostic({ source, message, detail, location });
			diagnostics = appendEngineDebugDiagnostics(diagnostics, incoming);
			const diagnostic = diagnostics.find((item) => item.id === incoming.id) ?? incoming;
			const liveIds = new Set(diagnostics.map((item) => item.id));
			for (const [id, cleanup] of callouts) {
				if (!liveIds.has(id)) {
					cleanup();
					callouts.delete(id);
					calloutRoutes.delete(id);
				}
			}
			const activeRoute = window.location.pathname;
			const existingRoute = calloutRoutes.get(diagnostic.id);
			if (callouts.has(diagnostic.id) && existingRoute === activeRoute) return;
			callouts.get(diagnostic.id)?.();
			callouts.delete(diagnostic.id);
			calloutRoutes.delete(diagnostic.id);
			const cleanup = installEngineDebugInlineCallout(document, diagnostic, activeRoute);
			if (cleanup) {
				callouts.set(diagnostic.id, cleanup);
				calloutRoutes.set(diagnostic.id, activeRoute);
			}
		};

		const onError = (event: ErrorEvent) => {
			report(
				"runtime",
				event.message || "Uncaught browser runtime error",
				event.error,
				event.filename ? event.filename + (event.lineno ? ":" + event.lineno : "") + (event.colno ? ":" + event.colno : "") : window.location.pathname,
			);
		};
		const onUnhandledRejection = (event: PromiseRejectionEvent) => {
			report("unhandled-rejection", "Unhandled promise rejection", event.reason, window.location.pathname);
		};

		const originalConsoleError = debugConsole.error;
		let consolePatched = false;
		const patchedConsoleError: typeof debugConsole.error = (...args) => {
			const detail = args.map((argument) => redactEngineDebugText(argument, 1_500)).join("\n");
			report("console", typeof args[0] === "string" ? args[0] : detail || "console.error", detail, window.location.pathname);
			originalConsoleError.apply(debugConsole, args);
		};
		try {
			debugConsole.error = patchedConsoleError;
			consolePatched = true;
		} catch {
			try {
				Object.defineProperty(debugConsole, "error", { configurable: true, writable: true, value: patchedConsoleError });
				consolePatched = true;
			} catch {
				// Browser-owned console methods may reject replacement; runtime error listeners still work.
			}
		}
		window.addEventListener("error", onError);
		window.addEventListener("unhandledrejection", onUnhandledRejection);

		// This observer also sees inline callout mutations. Remember each overlay's
		// last text so those mutations cannot re-capture an unchanged overlay.
		const scannedOverlayText = new WeakMap<HTMLElement, string>();
		const scanNextOverlay = () => {
			for (const element of document.querySelectorAll<HTMLElement>("nextjs-portal, nextjs-error, [data-nextjs-dialog], [data-nextjs-error], [data-nextjs-error-message]")) {
				const text = (element.shadowRoot?.textContent || element.innerText || element.textContent || "").trim();
				if (!text || !/(error|exception|failed|hydration|mismatch|digest)/i.test(text)) continue;
				if (scannedOverlayText.get(element) === text) continue;
				scannedOverlayText.set(element, text);
				report("next-overlay", "Next.js development error overlay", text, window.location.pathname);
			}
		};
		const observer = new MutationObserver(scanNextOverlay);
		if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
		scanNextOverlay();

		return () => {
			window.removeEventListener("error", onError);
			window.removeEventListener("unhandledrejection", onUnhandledRejection);
			if (consolePatched) {
				try {
					debugConsole.error = originalConsoleError;
				} catch {
					try {
						Object.defineProperty(debugConsole, "error", { configurable: true, writable: true, value: originalConsoleError });
					} catch {
						// Ignore teardown when the browser owns the console method.
					}
				}
			}
			observer.disconnect();
			for (const cleanup of callouts.values()) cleanup();
			callouts.clear();
			calloutRoutes.clear();
			delete debugWindow.__NEXT_ENGINE_DEBUG_INLINE_ACTIVE__;
		};
	}, []);

	return null;
}
