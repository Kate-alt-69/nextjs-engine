"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const ACTIVE_ATTRIBUTE = "data-next-engine-debug-active";
const HOST_ATTRIBUTE = "data-next-engine-debug-host";
const BOOTSTRAP_ATTRIBUTE = "data-next-engine-debug-bootstrap";
const SUPPRESSED_ATTRIBUTE = "data-next-engine-debug-suppressed";
const ISOLATION_STYLE_ID = "next-engine-debug-isolation";

const BOOTSTRAP_CSS = `
html:has([${BOOTSTRAP_ATTRIBUTE}="true"]),
html:has([${BOOTSTRAP_ATTRIBUTE}="true"]) body {
	margin: 0 !important;
	padding: 0 !important;
	width: 100% !important;
	height: 100% !important;
	overflow: hidden !important;
	background: #070a12 !important;
}
html:has([${BOOTSTRAP_ATTRIBUTE}="true"]) body > :not(:has([${BOOTSTRAP_ATTRIBUTE}="true"])):not([${BOOTSTRAP_ATTRIBUTE}="true"]),
html:has([${BOOTSTRAP_ATTRIBUTE}="true"]) body :has([${BOOTSTRAP_ATTRIBUTE}="true"]) > :not(:has([${BOOTSTRAP_ATTRIBUTE}="true"])):not([${BOOTSTRAP_ATTRIBUTE}="true"]) {
	display: none !important;
	visibility: hidden !important;
	pointer-events: none !important;
}
[${BOOTSTRAP_ATTRIBUTE}="true"] {
	position: fixed !important;
	inset: 0 !important;
	z-index: 2147483647 !important;
	display: block !important;
	width: 100vw !important;
	height: 100dvh !important;
	background: #070a12 !important;
}
`;

const ACTIVE_CSS = `
html[${ACTIVE_ATTRIBUTE}="true"],
html[${ACTIVE_ATTRIBUTE}="true"] body {
	margin: 0 !important;
	padding: 0 !important;
	width: 100% !important;
	height: 100% !important;
	overflow: hidden !important;
	background: #070a12 !important;
}
html[${ACTIVE_ATTRIBUTE}="true"] body > :not([${HOST_ATTRIBUTE}="true"]) {
	display: none !important;
	visibility: hidden !important;
	pointer-events: none !important;
}
html[${ACTIVE_ATTRIBUTE}="true"] body > [${HOST_ATTRIBUTE}="true"] {
	display: block !important;
	visibility: visible !important;
	pointer-events: auto !important;
}
`;

const SHADOW_CSS = `
:host {
	all: initial;
	display: block;
	width: 100%;
	height: 100%;
	background: #070a12;
	color: #e5e7eb;
	color-scheme: dark;
	font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
[${HOST_ATTRIBUTE}-mount="true"] {
	width: 100%;
	height: 100%;
	min-width: 0;
	min-height: 0;
	overflow: hidden;
	background: #070a12;
}
`;

interface SuppressedElementState {
	hadInert: boolean;
	ariaHidden: string | null;
	suppressedMarker: string | null;
}

export interface EngineDebugIsolationProps {
	children: ReactNode;
}

function suppressHostElement(
	element: HTMLElement,
	host: HTMLElement,
	states: Map<HTMLElement, SuppressedElementState>,
): void {
	if (element === host || element.hasAttribute(HOST_ATTRIBUTE)) return;
	if (!states.has(element)) {
		states.set(element, {
			hadInert: element.hasAttribute("inert"),
			ariaHidden: element.getAttribute("aria-hidden"),
			suppressedMarker: element.getAttribute(SUPPRESSED_ATTRIBUTE),
		});
	}
	element.setAttribute("inert", "");
	element.setAttribute("aria-hidden", "true");
	element.setAttribute(SUPPRESSED_ATTRIBUTE, "true");
}

function restoreHostElements(states: Map<HTMLElement, SuppressedElementState>): void {
	for (const [element, state] of states) {
		if (state.hadInert) element.setAttribute("inert", "");
		else element.removeAttribute("inert");

		if (state.ariaHidden === null) element.removeAttribute("aria-hidden");
		else element.setAttribute("aria-hidden", state.ariaHidden);

		if (state.suppressedMarker === null) element.removeAttribute(SUPPRESSED_ATTRIBUTE);
		else element.setAttribute(SUPPRESSED_ATTRIBUTE, state.suppressedMarker);
	}
	states.clear();
}

function styleIsolationHost(host: HTMLElement): void {
	const important = (property: string, value: string) => host.style.setProperty(property, value, "important");
	important("position", "fixed");
	important("inset", "0");
	important("z-index", "2147483647");
	important("display", "block");
	important("width", "100vw");
	important("height", "100dvh");
	important("margin", "0");
	important("padding", "0");
	important("overflow", "hidden");
	important("background", "#070a12");
	important("contain", "strict");
	important("isolation", "isolate");
	important("color-scheme", "dark");
}

/**
 * Moves EngineDebug into a direct-body Shadow DOM surface.
 *
 * Next.js App Router root layouts cannot be bypassed by a nested page, so host
 * chrome may already exist before /_engine/debug renders. This boundary hides
 * and inerts every host body surface while the debugger is mounted, isolates
 * debugger CSS in Shadow DOM, and restores the host exactly on unmount.
 */
export function EngineDebugIsolation({ children }: EngineDebugIsolationProps) {
	const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

	useEffect(() => {
		const html = document.documentElement;
		const body = document.body;
		const previousActiveValue = html.getAttribute(ACTIVE_ATTRIBUTE);
		const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const suppressedStates = new Map<HTMLElement, SuppressedElementState>();

		const host = document.createElement("div");
		host.setAttribute(HOST_ATTRIBUTE, "true");
		host.setAttribute("role", "application");
		host.setAttribute("aria-label", "Next.js Engine Debug");
		styleIsolationHost(host);

		const shadowRoot = host.attachShadow({ mode: "open", delegatesFocus: true });
		const shadowStyle = document.createElement("style");
		shadowStyle.textContent = SHADOW_CSS;
		const mount = document.createElement("div");
		mount.setAttribute(`${HOST_ATTRIBUTE}-mount`, "true");
		mount.tabIndex = -1;
		shadowRoot.append(shadowStyle, mount);

		let isolationStyle = document.getElementById(ISOLATION_STYLE_ID) as HTMLStyleElement | null;
		const ownsIsolationStyle = isolationStyle === null;
		if (!isolationStyle) {
			isolationStyle = document.createElement("style");
			isolationStyle.id = ISOLATION_STYLE_ID;
			isolationStyle.textContent = ACTIVE_CSS;
			document.head.appendChild(isolationStyle);
		}

		body.appendChild(host);
		html.setAttribute(ACTIVE_ATTRIBUTE, "true");

		for (const child of Array.from(body.children)) {
			if (child instanceof HTMLElement) suppressHostElement(child, host, suppressedStates);
		}

		const observer = new MutationObserver((records) => {
			for (const record of records) {
				for (const node of Array.from(record.addedNodes)) {
					if (node instanceof HTMLElement && node.parentElement === body) {
						suppressHostElement(node, host, suppressedStates);
					}
				}
			}
		});
		observer.observe(body, { childList: true });

		setPortalTarget(mount);
		queueMicrotask(() => mount.focus({ preventScroll: true }));

		return () => {
			observer.disconnect();
			restoreHostElements(suppressedStates);
			host.remove();

			if (previousActiveValue === null) html.removeAttribute(ACTIVE_ATTRIBUTE);
			else html.setAttribute(ACTIVE_ATTRIBUTE, previousActiveValue);

			if (ownsIsolationStyle) isolationStyle?.remove();
			if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
		};
	}, []);

	if (!portalTarget) {
		return (
			<>
				<style>{BOOTSTRAP_CSS}</style>
				<div {...{ [BOOTSTRAP_ATTRIBUTE]: "true" }} aria-hidden="true" />
			</>
		);
	}

	return createPortal(children, portalTarget);
}
