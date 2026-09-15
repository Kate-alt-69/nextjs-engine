"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { EngineFallbackPlan, EngineFeatureSupportResolver } from "../compiler/types";
import {
	detectEngineBrowserFeature,
	evaluateEngineBrowserCompatibility,
	type EngineCompatibilityReport,
} from "../core/EngineBrowserCompatibility";
import { EngineDialog } from "./EngineOverlay/EngineDialog";

const DEFAULT_UPDATE_URL = "https://browsehappy.com/";
const ACTION_STYLE: CSSProperties = {
	appearance: "none",
	border: "1px solid var(--e-overlay-trigger-border, rgba(15,23,42,.16))",
	borderRadius: "8px",
	background: "var(--e-overlay-action-bg, #f1f5f9)",
	color: "inherit",
	cursor: "pointer",
	font: "inherit",
	fontWeight: 600,
	padding: ".625rem .9rem",
};

export interface EngineCompatibilityDialogProps {
	plan: EngineFallbackPlan;
	isSupported?: EngineFeatureSupportResolver;
	leaveUrl?: string;
	updateUrl?: string;
	rememberContinue?: boolean;
	onContinue?: (report: EngineCompatibilityReport) => void;
	onLeave?: (report: EngineCompatibilityReport) => void;
	onUpdate?: (report: EngineCompatibilityReport) => void;
}

function reportSignature(report: EngineCompatibilityReport): string {
	return report.issues.map(({ feature }) => feature).join("|");
}

function compatibilityStorageKey(report: EngineCompatibilityReport): string {
	return `nextjs-engine:compatibility:v1:${reportSignature(report)}`;
}

function navigate(url: string): void {
	try {
		const target = new URL(url, window.location.href);
		if (target.protocol === "http:" || target.protocol === "https:" || target.href === "about:blank") {
			window.location.assign(target.href);
		}
	} catch {
		// Invalid application URLs fail closed and leave the decision visible.
	}
}

export function EngineCompatibilityDialog({
	plan,
	isSupported = detectEngineBrowserFeature,
	leaveUrl,
	updateUrl = DEFAULT_UPDATE_URL,
	rememberContinue = true,
	onContinue,
	onLeave,
	onUpdate,
}: EngineCompatibilityDialogProps) {
	const report = useMemo(
		() => evaluateEngineBrowserCompatibility(plan, isSupported),
		[isSupported, plan],
	);
	const [ready, setReady] = useState(false);
	const [dismissed, setDismissed] = useState(true);

	useEffect(() => {
		let remembered = false;
		if (report.updateRecommended && rememberContinue) {
			try {
				remembered = window.sessionStorage.getItem(compatibilityStorageKey(report)) === "continue";
			} catch {
				remembered = false;
			}
		}
		setDismissed(remembered);
		setReady(true);
	}, [rememberContinue, report]);

	if (!ready || dismissed || !report.updateRecommended) return null;

	const continueWithFallbacks = () => {
		if (rememberContinue) {
			try {
				window.sessionStorage.setItem(compatibilityStorageKey(report), "continue");
			} catch {
				// Storage can be unavailable in privacy modes; dismissal still works.
			}
		}
		onContinue?.(report);
		setDismissed(true);
	};
	const leave = () => {
		if (onLeave) {
			onLeave(report);
			return;
		}
		if (leaveUrl) {
			navigate(leaveUrl);
			return;
		}
		if (window.history.length > 1) window.history.back();
		else navigate("about:blank");
	};
	const update = () => {
		if (onUpdate) {
			onUpdate(report);
			return;
		}
		navigate(updateUrl);
	};

	return (
		<EngineDialog
			open
			onOpenChange={(open) => {
				if (!open) continueWithFallbacks();
			}}
			title="Browser update recommended"
			description="Some features used by this site are not fully supported by your current browser."
			role="alertdialog"
			showCloseButton={false}
			closeOnEscape={false}
			closeOnBackdrop={false}
			restoreFocus={false}
			initialFocus="#engine-compatibility-continue"
		>
			<p style={{ margin: 0, color: "var(--e-overlay-muted, #64748b)", lineHeight: 1.5 }}>
				You can leave, continue with the available experience, or update your browser.
			</p>
			<div style={{ display: "flex", justifyContent: "flex-end", gap: ".5rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
				<button type="button" style={{ ...ACTION_STYLE, background: "transparent" }} onClick={leave}>Leave</button>
				<button id="engine-compatibility-continue" type="button" style={ACTION_STYLE} onClick={continueWithFallbacks}>Continue</button>
				<button type="button" style={{ ...ACTION_STYLE, background: "var(--e-accent, #4f46e5)", color: "#fff" }} onClick={update}>Update</button>
			</div>
		</EngineDialog>
	);
}
