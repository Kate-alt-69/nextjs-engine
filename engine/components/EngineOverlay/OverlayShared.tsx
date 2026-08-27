"use client";

import React, {
	useCallback,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
} from "react";
import { useHandler } from "../../providers/EngineProvider";
import {
	getFocusableElements,
	isTopOverlay,
	lockBodyScroll,
	registerOverlay,
} from "../../core/engineoverlay";
import type { EngineOverlayOpenChange } from "./types";

export const SURFACE_BASE: CSSProperties = {
	background: "var(--e-overlay-bg, #fff)",
	color: "var(--e-overlay-color, #0f172a)",
	border: "1px solid var(--e-overlay-border, rgba(15,23,42,.14))",
	boxShadow: "var(--e-overlay-shadow, 0 24px 80px rgba(2,6,23,.28))",
	borderRadius: "var(--e-overlay-radius, 14px)",
};

export function clampDuration(value: number | undefined, fallback = 180): number {
	return Math.min(1200, Math.max(0, Number.isFinite(value) ? value! : fallback));
}

export function useReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		const query = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => setReduced(query.matches);
		update();
		query.addEventListener?.("change", update);
		return () => query.removeEventListener?.("change", update);
	}, []);
	return reduced;
}

export function useOverlayState(
	open: boolean | undefined,
	defaultOpen: boolean,
	onOpenChange: EngineOverlayOpenChange | undefined,
) {
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const namedHandler = useHandler(typeof onOpenChange === "string" ? onOpenChange : "");
	const controlled = open !== undefined;
	const resolvedOpen = controlled ? Boolean(open) : internalOpen;
	const setOpen = useCallback((nextOpen: boolean) => {
		if (!controlled) setInternalOpen(nextOpen);
		if (typeof onOpenChange === "function") onOpenChange(nextOpen);
		else namedHandler?.(nextOpen);
	}, [controlled, namedHandler, onOpenChange]);
	return [resolvedOpen, setOpen] as const;
}

export function useOverlayPresence(open: boolean, duration: number) {
	const [present, setPresent] = useState(open);
	const [active, setActive] = useState(false);
	useEffect(() => {
		let frame = 0;
		let timer: ReturnType<typeof setTimeout> | undefined;
		if (open) {
			setPresent(true);
			frame = requestAnimationFrame(() => setActive(true));
		} else {
			setActive(false);
			timer = setTimeout(() => setPresent(false), duration);
		}
		return () => {
			if (frame) cancelAnimationFrame(frame);
			if (timer) clearTimeout(timer);
		};
	}, [duration, open]);
	return { present, active };
}

interface OverlayBehaviorOptions {
	open: boolean;
	overlayId: string;
	panelRef: React.RefObject<HTMLElement | null>;
	triggerRef: React.RefObject<HTMLButtonElement | null>;
	close: () => void;
	closeOnEscape: boolean;
	trapFocus: boolean;
	autoFocus: boolean;
	lockScroll: boolean;
	restoreFocus: boolean;
	initialFocus?: string;
}

function resolveInitialFocus(panel: HTMLElement, selector: string | undefined): HTMLElement | null {
	if (!selector) return null;
	try {
		return panel.querySelector<HTMLElement>(selector);
	} catch {
		if (process.env.NODE_ENV !== "production") {
			console.warn(`[EngineOverlay] Invalid initialFocus selector: ${selector}`);
		}
		return null;
	}
}

export function useOverlayBehavior(options: OverlayBehaviorOptions) {
	const previousFocus = useRef<HTMLElement | null>(null);
	const currentOptions = useRef(options);
	currentOptions.current = options;

	useEffect(() => {
		if (!options.open) return;
		previousFocus.current = document.activeElement instanceof HTMLElement
			? document.activeElement
			: null;
		const unregister = registerOverlay(options.overlayId);
		const unlock = options.lockScroll ? lockBodyScroll() : () => undefined;
		const frame = requestAnimationFrame(() => {
			const current = currentOptions.current;
			if (!current.autoFocus) return;
			const panel = current.panelRef.current;
			if (!panel) return;
			const requested = resolveInitialFocus(panel, current.initialFocus);
			(requested ?? getFocusableElements(panel)[0] ?? panel).focus({ preventScroll: true });
		});
		const onKeyDown = (event: KeyboardEvent) => {
			const current = currentOptions.current;
			if (!isTopOverlay(current.overlayId)) return;
			if (event.key === "Escape" && current.closeOnEscape) {
				event.preventDefault();
				current.close();
				return;
			}
			if (event.key !== "Tab" || !current.trapFocus) return;
			const panel = current.panelRef.current;
			if (!panel) return;
			const focusable = getFocusableElements(panel);
			if (focusable.length === 0) {
				event.preventDefault();
				panel.focus();
				return;
			}
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (!(document.activeElement instanceof Node) || !panel.contains(document.activeElement)) {
				event.preventDefault();
				(event.shiftKey ? last : first).focus();
			} else if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => {
			cancelAnimationFrame(frame);
			document.removeEventListener("keydown", onKeyDown);
			unlock();
			unregister();
			const current = currentOptions.current;
			if (!current.restoreFocus) return;
			const target = current.triggerRef.current ?? previousFocus.current;
			if (target?.isConnected) target.focus({ preventScroll: true });
		};
	}, [options.open, options.overlayId]);
}
