import type { CSSProperties, MouseEvent, ReactNode } from "react";
import type { BaseNodeProps } from "../../schema/types";
import type { EnginePopoverAlign, EnginePopoverPlacement } from "../../core/engineoverlay";

export type EngineOverlayOpenChange = string | ((open: boolean) => void);
export type EngineOverlayActionVariant = "primary" | "secondary" | "danger" | "ghost";

export interface EngineOverlayAction {
	label: string;
	onClick?: string | ((event: MouseEvent<HTMLButtonElement>) => void);
	close?: boolean;
	variant?: EngineOverlayActionVariant;
	disabled?: boolean;
}

export interface EngineOverlayCommonProps extends Omit<BaseNodeProps, "onClick"> {
	children?: ReactNode;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: EngineOverlayOpenChange;
	trigger?: ReactNode;
	triggerLabel?: string;
	triggerClassName?: string;
	triggerStyle?: CSSProperties;
	triggerDisabled?: boolean;
	title?: ReactNode;
	description?: ReactNode;
	actions?: EngineOverlayAction[];
	showCloseButton?: boolean;
	closeLabel?: string;
	closeOnEscape?: boolean;
	restoreFocus?: boolean;
	initialFocus?: string;
	duration?: number;
	portalTargetId?: string;
	ariaLabel?: string;
	triggerAriaLabel?: string;
	overlayStyle?: CSSProperties;
}

export interface EngineDialogProps extends EngineOverlayCommonProps {
	role?: "dialog" | "alertdialog";
	closeOnBackdrop?: boolean;
	lockScroll?: boolean;
	trapFocus?: boolean;
}

export interface EngineDrawerProps extends EngineOverlayCommonProps {
	side?: "left" | "right" | "top" | "bottom";
	size?: string | number;
	closeOnBackdrop?: boolean;
	lockScroll?: boolean;
	trapFocus?: boolean;
}

export interface EnginePopoverProps extends EngineOverlayCommonProps {
	placement?: EnginePopoverPlacement;
	align?: EnginePopoverAlign;
	offset?: number;
	viewportPadding?: number;
	closeOnOutsideClick?: boolean;
	matchTriggerWidth?: boolean;
	autoFocus?: boolean;
	trapFocus?: boolean;
	role?: "dialog" | "menu" | "listbox";
}
