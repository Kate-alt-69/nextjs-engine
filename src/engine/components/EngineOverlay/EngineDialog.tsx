"use client";

import React, { memo, useCallback, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { isTopOverlay } from "../../core/engineoverlay";
import { useCpropClass } from "../../hooks/usePropStyles";
import { usePrimitiveStyles } from "../../hooks/usePrimitiveStyles";
import {
	SURFACE_BASE,
	clampDuration,
	useOverlayBehavior,
	useOverlayPresence,
	useOverlayState,
	usePortalTarget,
	useReducedMotion,
} from "./OverlayShared";
import { OverlayContent, OverlayTrigger } from "./OverlayParts";
import type { EngineDialogProps } from "./types";

export const EngineDialog = memo(function EngineDialog({
	children,
	open,
	defaultOpen = false,
	onOpenChange,
	trigger,
	triggerLabel,
	triggerClassName,
	triggerStyle,
	triggerDisabled,
	triggerAriaLabel,
	title,
	description,
	actions,
	showCloseButton = true,
	closeLabel = "Close dialog",
	closeOnEscape = true,
	closeOnBackdrop = true,
	restoreFocus = true,
	initialFocus,
	duration,
	portalTargetId,
	ariaLabel,
	overlayStyle,
	lockScroll = true,
	trapFocus = true,
	role = "dialog",
	style,
	className,
	cprop,
	id,
	point,
	zIndex = 1000,
	...props
}: EngineDialogProps) {
	const uid = useId();
	const panelId = id ?? point ?? `e-dialog-${uid.replace(/:/g, "")}`;
	const titleId = `${panelId}-title`;
	const descriptionId = `${panelId}-description`;
	const [isOpen, setOpen] = useOverlayState(open, defaultOpen, onOpenChange);
	const transitionMs = useReducedMotion() ? 0 : clampDuration(duration);
	const { present, active } = useOverlayPresence(isOpen, transitionMs);
	const panelRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const target = usePortalTarget(portalTargetId);
	const close = useCallback(() => setOpen(false), [setOpen]);
	const behavior = useMemo(() => ({
		open: isOpen, overlayId: panelId, panelRef, triggerRef, close,
		closeOnEscape, trapFocus, autoFocus: true, lockScroll, restoreFocus, initialFocus,
	}), [close, closeOnEscape, initialFocus, isOpen, lockScroll, panelId, restoreFocus, trapFocus]);
	useOverlayBehavior(behavior);

	const panelStyle = usePrimitiveStyles(props as any, {
		defaults: {
			...SURFACE_BASE,
			position: "relative",
			width: "min(32rem, calc(100vw - 2rem))",
			maxHeight: "min(85vh, 52rem)",
			overflow: "auto",
			padding: "1.25rem",
		},
		style,
		runtime: {
			opacity: active ? 1 : 0,
			transform: active ? "translateY(0) scale(1)" : "translateY(10px) scale(.985)",
			transition: `opacity ${transitionMs}ms ease, transform ${transitionMs}ms ease`,
		},
	});
	const panelClass = [className, useCpropClass(cprop)].filter(Boolean).join(" ") || undefined;

	return (
		<>
			<OverlayTrigger
				label={triggerLabel}
				children={trigger}
				className={triggerClassName}
				style={triggerStyle}
				disabled={triggerDisabled}
				expanded={isOpen}
				controls={panelId}
				hasPopup="dialog"
				ariaLabel={triggerAriaLabel}
				onClick={() => setOpen(!isOpen)}
				triggerRef={triggerRef}
			/>
			{target && present && createPortal(
				<div
					style={{
						position: "fixed",
						inset: 0,
						zIndex,
						display: "grid",
						placeItems: "center",
						padding: "1rem",
						background: "rgba(2,6,23,.58)",
						backdropFilter: "blur(6px)",
						opacity: active ? 1 : 0,
						transition: `opacity ${transitionMs}ms ease`,
						...overlayStyle,
					}}
					onPointerDown={(event) => {
						if (closeOnBackdrop && event.target === event.currentTarget && isTopOverlay(panelId)) close();
					}}
				>
					<div
						ref={panelRef}
						id={panelId}
						role={role}
						aria-modal="true"
						aria-label={title == null ? (ariaLabel ?? triggerLabel ?? "Dialog") : undefined}
						aria-labelledby={title != null ? titleId : undefined}
						aria-describedby={description != null ? descriptionId : undefined}
						tabIndex={-1}
						className={panelClass}
						style={panelStyle}
						data-state={active ? "open" : "closed"}
					>
						<OverlayContent title={title} description={description} actions={actions} close={close} showCloseButton={showCloseButton} closeLabel={closeLabel} titleId={titleId} descriptionId={descriptionId}>{children}</OverlayContent>
					</div>
				</div>,
				target,
			)}
		</>
	);
});
