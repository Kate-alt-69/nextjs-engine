"use client";

import React, { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import type { EngineFallbackPlan, EngineResolvedFeatureFallback } from "../../compiler/types";
import { EngineDialog } from "../../components/EngineOverlay/EngineDialog";
import type { EngineDialogProps } from "../../components/EngineOverlay/types";
import {
	resolveEngineBrowserCompatibility,
	type EngineFeatureSupportOverrides,
} from "./EngineBrowserCompatibility";

export interface EngineCompatibilityDialogProps {
	plan: EngineFallbackPlan;
	support?: EngineFeatureSupportOverrides;
	autoOpen?: boolean;
	triggerLabel?: string;
	title?: ReactNode;
	description?: ReactNode;
	closeLabel?: string;
	showSources?: boolean;
	className?: string;
	style?: EngineDialogProps["style"];
	onOpenChange?: (open: boolean) => void;
}

function readableName(value: string): string {
	return value
		.split("-")
		.map((part) => part.length <= 3 ? part.toUpperCase() : `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
		.join(" ");
}

function CompatibilityEntry({ entry, showSources }: {
	entry: EngineResolvedFeatureFallback;
	showSources: boolean;
}) {
	const unavailable = entry.status === "unavailable";
	const strategy = entry.strategy ? readableName(entry.strategy.id) : null;
	return (
		<li
			data-engine-compatibility-status={entry.status}
			style={{
				border: `1px solid ${unavailable ? "var(--e-compat-error-border, #fca5a5)" : "var(--e-compat-fallback-border, #fcd34d)"}`,
				borderRadius: ".65rem",
				padding: ".8rem .9rem",
				background: unavailable ? "var(--e-compat-error-bg, #fef2f2)" : "var(--e-compat-fallback-bg, #fffbeb)",
				color: "var(--e-compat-color, #0f172a)",
			}}
		>
			<strong>{readableName(entry.feature)}</strong>
			<p style={{ margin: ".3rem 0 0", lineHeight: 1.45 }}>
				{unavailable
					? "This browser cannot provide this page enhancement. Durable page content remains available when possible."
					: `This browser will use the ${strategy} fallback.`}
			</p>
			{showSources && entry.requiredBy.length > 0 && (
				<details style={{ marginTop: ".5rem" }}>
					<summary>{entry.requiredBy.length} compiled {entry.requiredBy.length === 1 ? "source" : "sources"}</summary>
					<ul style={{ margin: ".4rem 0 0", paddingInlineStart: "1.25rem" }}>
						{entry.requiredBy.map((source) => (
							<li key={`${source.nodeId}:${source.path}`}>
								<code>{source.nodeType}</code> at <code>{source.path}</code>
							</li>
						))}
					</ul>
				</details>
			)}
		</li>
	);
}

export const EngineCompatibilityDialog = memo(function EngineCompatibilityDialog({
	plan,
	support,
	autoOpen = true,
	triggerLabel = "Browser compatibility",
	title,
	description,
	closeLabel = "Close browser compatibility information",
	showSources = false,
	className,
	style,
	onOpenChange,
}: EngineCompatibilityDialogProps) {
	const [resolved, setResolved] = useState<ReturnType<typeof resolveEngineBrowserCompatibility> | null>(null);
	const [open, setOpen] = useState(false);
	const supportKey = useMemo(() => JSON.stringify(
		Object.entries(support ?? {}).sort(([left], [right]) => left.localeCompare(right)),
	), [support]);

	useEffect(() => {
		const result = resolveEngineBrowserCompatibility(plan, support);
		const issues = result.features.filter((feature) => feature.status !== "native");
		setResolved(result);
		setOpen(autoOpen && issues.length > 0);
	}, [autoOpen, plan, supportKey]);

	const issues = resolved?.features.filter((feature) => feature.status !== "native") ?? [];
	if (!resolved || issues.length === 0) return null;

	const unavailableCount = issues.filter((feature) => feature.status === "unavailable").length;
	const fallbackCount = issues.length - unavailableCount;
	const resolvedTitle = title ?? (unavailableCount > 0
		? "Some enhancements are unavailable"
		: "Browser compatibility mode");
	const resolvedDescription = description ?? (
		unavailableCount > 0
			? "Your browser can still show the page's durable content, but some enhancements cannot run."
			: "The page is using supported fallbacks for features missing from this browser."
	);
	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		onOpenChange?.(nextOpen);
	};

	return (
		<EngineDialog
			open={open}
			onOpenChange={handleOpenChange}
			triggerLabel={triggerLabel}
			title={resolvedTitle}
			description={resolvedDescription}
			closeLabel={closeLabel}
			role={unavailableCount > 0 ? "alertdialog" : "dialog"}
			className={className}
			style={style}
		>
			<div data-testid="engine-compatibility-dialog" data-engine-compatibility-page={resolved.pageId}>
				<p aria-live="polite" style={{ margin: "0 0 .8rem", fontWeight: 600 }}>
					{fallbackCount > 0 && `${fallbackCount} ${fallbackCount === 1 ? "fallback" : "fallbacks"} active`}
					{fallbackCount > 0 && unavailableCount > 0 && " · "}
					{unavailableCount > 0 && `${unavailableCount} unavailable`}
				</p>
				<ul style={{ display: "grid", gap: ".65rem", listStyle: "none", margin: 0, padding: 0 }}>
					{issues.map((entry) => (
						<CompatibilityEntry key={entry.feature} entry={entry} showSources={showSources} />
					))}
				</ul>
			</div>
		</EngineDialog>
	);
});
