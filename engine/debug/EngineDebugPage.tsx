"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	appendEngineDebugDiagnostics,
	createEngineDebugDiagnostic,
	formatEngineDebugDiagnostic,
	redactEngineDebugText,
} from "./EngineDebugDiagnostics";
import type { EngineDebugDiagnostic, EngineDebugSource } from "./EngineDebugDiagnostics";
import { installEngineDebugInlineCallout } from "./EngineDebugInlineCallout";
import { EngineDebugFixEditor } from "./EngineDebugFixEditor";
import { EngineDebugDynamicRoutePicker } from "./EngineDebugDynamicRoutePicker";
import { inferEngineDebugOverlayRoute, isEngineDebugDynamicRoute, matchesEngineDebugRoutePattern } from "./EngineDebugDynamicRoutes";
import type {
	EngineSchedulerDebugSnapshot,
	EngineSchedulerDebugTask,
	EngineSchedulerDebugTransition,
} from "../core/enginescheduler/EngineScheduler";

type DeviceMode = "Desktop" | "Tablet" | "Phone" | "Custom";

interface DeviceProfile {
	mode: DeviceMode;
	width: number;
	height: number;
	dpr: number;
	refresh: number;
	touch: boolean;
	hover: boolean;
	orientation: "portrait" | "landscape";
	visualViewport: boolean;
}

interface DebugNode {
	id: string;
	path: string;
	type: string;
	name: string;
	boundary: string;
	rendered: string;
	reason: string;
	hydration: string;
	clientJs: string;
	workClass: string;
	capabilities: string[];
	columns?: number;
}

interface DebugSchedulerWindow extends Window {
	console: Console;
	__NEXT_ENGINE_SCHEDULER_DEBUG__?: { snapshot: () => EngineSchedulerDebugSnapshot };
	__NEXT_ENGINE_DEVICE_DEBUG__?: { profile: DeviceProfile };
	__NEXT_ENGINE_ORIGINAL_MATCH_MEDIA__?: typeof window.matchMedia;
	__NEXT_ENGINE_ORIGINAL_VISUAL_VIEWPORT__?: VisualViewport | null;
	__NEXT_ENGINE_VISUAL_VIEWPORT_CAPTURED__?: boolean;
}

const DEVICE_PROFILES: Record<Exclude<DeviceMode, "Custom">, DeviceProfile> = {
	Desktop: { mode: "Desktop", width: 1440, height: 900, dpr: 1, refresh: 60, touch: false, hover: true, orientation: "landscape", visualViewport: true },
	Tablet: { mode: "Tablet", width: 1024, height: 1366, dpr: 2, refresh: 60, touch: true, hover: false, orientation: "portrait", visualViewport: true },
	Phone: { mode: "Phone", width: 390, height: 844, dpr: 3, refresh: 120, touch: true, hover: false, orientation: "portrait", visualViewport: true },
};

const EMPTY_SCHEDULER: EngineSchedulerDebugSnapshot = {
	tasks: [],
	transitions: [],
	underFramePressure: false,
};

const FRAME_OVERLAY_CSS = `
html[data-engine-debug-overlay="true"] [data-engine-debug-boundary]{
	outline:2px solid var(--engine-debug-color,#64748b)!important;
	outline-offset:-2px!important;
	position:relative!important;
}
html[data-engine-debug-overlay="true"] [data-engine-debug-boundary]::after{
	content:attr(data-engine-debug-boundary);
	position:absolute;z-index:2147483646;top:2px;left:2px;padding:2px 5px;border-radius:4px;
	background:var(--engine-debug-color,#64748b);color:white;font:700 10px/1.4 ui-monospace,monospace;
	pointer-events:none;
}
html[data-engine-debug-overlay="true"] [data-engine-debug-boundary="STATIC"]{--engine-debug-color:#64748b}
html[data-engine-debug-overlay="true"] [data-engine-debug-boundary="SERVER"]{--engine-debug-color:#2563eb}
html[data-engine-debug-overlay="true"] [data-engine-debug-boundary="CLIENT"]{--engine-debug-color:#dc2626}
html[data-engine-debug-overlay="true"] [data-engine-debug-boundary="DEFERRED"]{--engine-debug-color:#9333ea}
html[data-engine-debug-overlay="true"] [data-engine-debug-boundary][style*="display: contents"]> *{outline:2px solid var(--engine-debug-color,#dc2626)!important;outline-offset:-2px!important}
[data-engine-debug-selected="true"]{outline:4px solid #f59e0b!important;outline-offset:2px!important}
[data-engine-debug-selected="true"][style*="display: contents"]> *{outline:4px solid #f59e0b!important;outline-offset:2px!important}
`;

const PAGE_CSS = `
:root{color-scheme:dark;--ed-bg:#1e1e1e;--ed-panel:#252526;--ed-panel-alt:#181818;--ed-border:#3c3c3c;--ed-muted:#9da0a5;--ed-text:#cccccc;--ed-accent:#007acc;--ed-hover:#2a2d2e;--ed-active:#37373d;--ed-error:#f48771;--ed-warning:#cca700}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--ed-bg);color:var(--ed-text);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:12px}
button,input,select{font:inherit;color:inherit}.ed-shell{height:100dvh;display:grid;grid-template-rows:40px minmax(0,1fr);overflow:hidden;background:var(--ed-bg)}
.ed-head{display:flex;align-items:center;gap:10px;padding:0 12px;border-bottom:1px solid var(--ed-border);background:#181818}.ed-brand-mark{width:18px;height:18px;display:grid;place-items:center;border:1px solid #5da9e9;color:#75beff;font:700 10px ui-monospace,monospace}.ed-head h1{font-size:12px;font-weight:600;margin:0;color:#f1f1f1}.ed-badge{font:600 9px ui-monospace,monospace;color:#89d185;border:1px solid #365d36;border-radius:3px;padding:2px 5px;letter-spacing:.04em}.ed-body{min-height:0;display:grid;grid-template-columns:42px minmax(168px,208px) minmax(0,1fr) minmax(280px,340px)}
.ed-activity{display:flex;align-items:center;flex-direction:column;gap:4px;padding:7px 0;background:var(--ed-panel-alt);border-right:1px solid #242424}.ed-activity-button{width:34px;height:36px;border:0;border-left:2px solid transparent;background:transparent;color:#858585;display:grid;place-items:center;cursor:pointer;font:16px/1 ui-sans-serif,system-ui;border-radius:0}.ed-activity-button:hover{color:#eee;background:#232323}.ed-activity-button[aria-pressed="true"]{color:#fff;border-left-color:#fff;background:#202020}.ed-activity-button .ed-activity-glyph{font-size:16px}
.ed-sidebar,.ed-inspector{min-height:0;overflow:auto;background:var(--ed-panel)}.ed-sidebar{border-right:1px solid var(--ed-border);padding:0 0 12px}.ed-inspector{border-left:1px solid var(--ed-border);padding:0 10px 14px}.ed-section-title{margin:0;padding:13px 12px 9px;color:#bbbbbb;font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:600}.ed-sidebar-subtitle{padding:3px 12px 10px;color:var(--ed-muted);font:10px ui-monospace,monospace}.ed-route-search{display:block;width:calc(100% - 20px);margin:0 10px 8px;padding:7px 8px;border:1px solid #444;border-radius:3px;background:#181818;color:#ddd;font:11px ui-monospace,monospace;outline:none}.ed-route-search:focus{border-color:#007acc}.ed-route-count{padding:0 12px 8px;color:#888;font:10px ui-monospace,monospace}
.ed-route,.ed-button,.ed-mode,.ed-filter,.ed-diagnostic{border:1px solid transparent;background:transparent;color:var(--ed-text);border-radius:2px;cursor:pointer}.ed-route{display:block;width:100%;padding:5px 10px 5px 17px;text-align:left;margin:0;font:12px ui-monospace,SFMono-Regular,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ed-route:hover{background:var(--ed-hover)}.ed-route[aria-current="page"]{background:#37373d;color:#fff}.ed-button,.ed-mode{padding:5px 8px;font-size:11px;border-radius:2px}.ed-button:hover,.ed-mode:hover{background:var(--ed-hover)}.ed-button[aria-pressed="true"],.ed-mode[aria-pressed="true"]{background:#094771;color:#fff}.ed-stage{min-width:0;min-height:0;display:grid;grid-template-rows:36px minmax(0,1fr);background:#1e1e1e}.ed-tools{display:flex;align-items:center;gap:5px;padding:4px 8px;border-bottom:1px solid var(--ed-border);background:#252526}.ed-spacer{flex:1}.ed-fps{font:10px ui-monospace,monospace;color:#9cdcfe;white-space:nowrap}.ed-viewport-scroll{overflow:auto;padding:15px;display:grid;place-items:start center;min-width:0;min-height:0;background-color:#1e1e1e;background-image:radial-gradient(#343434 .6px,transparent .6px);background-size:9px 9px}.ed-frame-fit{position:relative;flex:none;margin:0 auto}.ed-frame-shell{position:absolute;left:0;top:0;transform-origin:top left;background:white;overflow:hidden;box-shadow:0 8px 22px #0006;border:1px solid #444}.ed-fit-label{font:10px ui-monospace,monospace;color:#9cdcfe;min-width:35px;text-align:center}.ed-frame{display:block;width:100%;height:100%;border:0;background:white}.ed-preview-state{position:absolute;inset:0;z-index:2;display:grid;place-items:center;padding:18px;background:rgba(24,24,24,.94);color:#d4d4d4}.ed-preview-state[hidden]{display:none}.ed-preview-state-card{width:min(340px,100%);display:grid;justify-items:center;gap:11px;padding:22px 20px;border:1px solid #454545;border-radius:5px;background:#252526;box-shadow:0 12px 42px #0007;text-align:center}.ed-preview-orbit{width:32px;height:32px;border:2px solid #3d3d3d;border-top-color:#75beff;border-right-color:#007acc;border-radius:50%;animation:ed-preview-spin .9s linear infinite}.ed-preview-state.error .ed-preview-orbit{border-color:#f48771;background:transparent;animation:none;position:relative}.ed-preview-state.error .ed-preview-orbit:after{content:"!";position:absolute;inset:0;display:grid;place-items:center;color:#f48771;font-weight:800}.ed-preview-title{font-size:13px;font-weight:650;color:#f1f1f1}.ed-preview-description{max-width:285px;color:#a8a8a8;font-size:11px;line-height:1.55}.ed-preview-progress{width:100%;height:3px;overflow:hidden;border-radius:9px;background:#3a3a3a}.ed-preview-progress:after{content:"";display:block;width:38%;height:100%;background:#007acc;animation:ed-preview-progress 1.35s ease-in-out infinite}.ed-preview-state.error .ed-preview-progress{display:none}.ed-preview-actions{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap}.ed-preview-status{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;border:1px solid #3c3c3c;border-radius:3px;padding:3px 6px;font:9px ui-monospace,monospace;color:#aaa}.ed-preview-status:before{content:"";width:5px;height:5px;background:#cca700;border-radius:50%}.ed-preview-status.ready{color:#89d185;border-color:#365d36}.ed-preview-status.ready:before{background:#89d185}.ed-preview-status.error{color:#f48771;border-color:#69413a}.ed-preview-status.error:before{background:#f48771}@keyframes ed-preview-spin{to{transform:rotate(360deg)}}@keyframes ed-preview-progress{0%{transform:translateX(-120%)}100%{transform:translateX(360%)}}@media(prefers-reduced-motion:reduce){.ed-preview-orbit,.ed-preview-progress:after{animation:none}}
.ed-tabs{display:flex;gap:0;margin:0 -10px 12px;position:sticky;top:0;padding:0 6px;background:var(--ed-panel);border-bottom:1px solid var(--ed-border);z-index:2;overflow-x:auto}.ed-tabs .ed-button{white-space:nowrap;padding:11px 8px 9px;border:0;border-bottom:1px solid transparent;color:#999}.ed-tabs .ed-button[aria-pressed="true"]{border-bottom-color:#007acc;background:transparent;color:#f0f0f0}.ed-tabs .ed-button:hover{background:#2a2d2e}.ed-card{border:1px solid #383838;background:#1f1f1f;border-radius:3px;padding:9px;margin-bottom:8px}.ed-card h3{font-size:12px;font-weight:600;margin:0 0 8px;color:#e7e7e7}.ed-row{display:grid;grid-template-columns:78px minmax(0,1fr);gap:7px;padding:4px 0;font-size:11px;line-height:1.45}.ed-key{color:#9da0a5}.ed-value{color:#d4d4d4;overflow-wrap:anywhere}.ed-chip{display:inline-block;padding:2px 5px;margin:2px;border-radius:2px;background:#333;color:#ccc;font:600 9px ui-monospace,monospace}.ed-task{display:flex;gap:8px;align-items:flex-start;justify-content:space-between}.ed-task-name{font-size:11px;font-weight:500}.ed-task-state{text-align:right;white-space:nowrap}.ed-transition{font:10px/1.5 ui-monospace,monospace;color:#9da0a5;border-left:2px solid #555;padding-left:8px;margin:7px 0}.ed-mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}.ed-fields{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.ed-field{display:grid;gap:4px;color:#9da0a5;font-size:10px}.ed-field input,.ed-field select{width:100%;border:1px solid #454545;border-radius:2px;background:#181818;color:#ddd;padding:5px}.ed-check{display:flex;gap:7px;align-items:center;font-size:11px;color:#ccc}.ed-empty{padding:22px 8px;color:#858585;text-align:center;font-size:11px;line-height:1.5}.ed-explain{font-size:11px;line-height:1.55;color:#c7c7c7}.ed-warning{color:#e2c08d}.ed-count{margin-left:auto;color:#999;font:10px ui-monospace,monospace}
.ed-route-picker{display:flex;align-items:center;gap:5px;min-width:0;color:#999;font-size:10px;white-space:nowrap}.ed-route-picker select{min-width:0;max-width:180px;border:1px solid #454545;border-radius:2px;background:#181818;color:#ddd;padding:4px 5px;font:10px ui-monospace,SFMono-Regular,Consolas,monospace}.ed-problem-toolbar{display:flex;align-items:center;gap:4px;margin:0 0 8px;flex-wrap:wrap}.ed-filter{padding:4px 7px;border-color:#424242;color:#bdbdbd;font-size:10px}.ed-filter[aria-pressed="true"]{background:#37373d;border-color:#666;color:#fff}.ed-problem-count{margin-left:auto;color:#999;font:10px ui-monospace,monospace}.ed-inspector-problems{overflow:hidden;display:flex;flex-direction:column}.ed-problems{min-height:0;flex:1;display:flex;flex-direction:column;overflow:hidden}.ed-severity-summary,.ed-problem-toolbar{flex:none}.ed-selected-detail{flex:0 1 auto;max-height:44%;min-height:90px;overflow:auto;overscroll-behavior:contain}.ed-diagnostic-list{display:grid;align-content:start;gap:2px;min-height:90px;flex:1;overflow:auto;overscroll-behavior:contain;padding-right:3px;margin:0 0 8px}.ed-problems-footnote{flex:none;max-height:58px;overflow:auto}.ed-diagnostic-count{display:inline-block;padding:2px 4px;margin-left:2px;border:1px solid #555;border-radius:3px;color:#ccc;font:9px ui-monospace,monospace}.ed-route-tags{font:10px ui-monospace,monospace;color:#9cdcfe;overflow-wrap:anywhere;margin:6px 0}.ed-fix-editor{border-top:1px solid #3c3c3c;padding-top:10px;margin-top:10px}.ed-fix-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:7px}.ed-fix-head h4{font-size:11px;color:#f1f1f1;margin:0 0 4px}.ed-fix-path{font:10px ui-monospace,monospace;color:#9cdcfe;overflow-wrap:anywhere}.ed-fix-dev-badge{flex:none;color:#89d185;border:1px solid #365d36;padding:2px 4px;border-radius:3px;font:8px ui-monospace,monospace}.ed-fix-toolbar,.ed-fix-actions{display:flex;align-items:center;gap:5px;justify-content:space-between;flex-wrap:wrap;margin:7px 0;color:#999;font:10px ui-monospace,monospace}.ed-fix-textarea{display:block;width:100%;min-height:150px;max-height:280px;resize:vertical;padding:8px;border:1px solid #444;border-radius:3px;background:#141414;color:#d4d4d4;font:11px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;tab-size:2;white-space:pre;overflow:auto;outline:none}.ed-fix-textarea:focus{border-color:#007acc}.ed-fix-suggestion{padding:8px;background:#17232e;border-left:2px solid #75beff;color:#d5e9fa;font-size:10px;line-height:1.5;margin:7px 0}.ed-fix-diff{margin:7px 0;border:1px solid #393939;border-radius:3px;overflow:auto;max-height:150px;background:#141414}.ed-fix-diff-title{position:sticky;top:0;padding:6px 8px;border-bottom:1px solid #383838;background:#1d1d1d;color:#c8c8c8;font:10px ui-monospace,monospace}.ed-fix-diff-line{display:grid;grid-template-columns:42px minmax(0,1fr);gap:7px;padding:3px 7px;font:10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}.ed-fix-diff-line span{color:#aaa;text-align:right}.ed-fix-diff-line code{white-space:pre-wrap;overflow-wrap:anywhere}.ed-fix-diff-line.removed{background:#351c1c;color:#f1b4b4}.ed-fix-diff-line.added{background:#173326;color:#b8e2c1}.ed-fix-apply{background:#0e639c;color:white}.ed-fix-apply:disabled{opacity:.45;cursor:not-allowed}.ed-fix-status,.ed-fix-note{font-size:10px;line-height:1.5;color:#9da0a5;margin:7px 0}.ed-fix-status.is-error{color:#f48771}.ed-fix-note{border-top:1px solid #383838;padding-top:7px}.ed-dynamic-route-backdrop{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:#080a0ed9;backdrop-filter:blur(3px)}.ed-dynamic-route-dialog{width:min(620px,100%);max-height:min(82dvh,760px);overflow:auto;border:1px solid #4b5563;border-radius:8px;background:#202124;box-shadow:0 26px 90px #000b;padding:20px;color:#d6d6d6}.ed-dynamic-route-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.ed-dynamic-route-heading h2{margin:3px 0 7px;color:#f5f5f5;font-size:16px;font-weight:650;overflow-wrap:anywhere}.ed-dynamic-route-heading p{margin:0;color:#a7abb2;line-height:1.5;font-size:11px}.ed-dynamic-route-section{margin-top:18px}.ed-dynamic-route-section-title{margin-bottom:8px;color:#c8c8c8;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase}.ed-dynamic-route-options{display:grid;gap:4px;max-height:180px;overflow:auto}.ed-dynamic-route-option{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 10px;border:1px solid #3a3d42;border-radius:4px;background:#27292d;color:#b8e8c2;text-align:left;font:11px ui-monospace,monospace;cursor:pointer}.ed-dynamic-route-option:hover{background:#30343a;border-color:#70a8e7}.ed-dynamic-route-option span:first-child{overflow-wrap:anywhere}.ed-dynamic-route-empty{margin-top:18px;padding:12px;border:1px dashed #4a4a4a;border-radius:4px;color:#9da0a5;font-size:11px;line-height:1.5}.ed-dynamic-route-form{margin-top:18px;padding-top:14px;border-top:1px solid #3c3c3c}.ed-dynamic-route-field{display:grid;gap:5px;margin:9px 0;color:#c9c9c9;font-size:11px}.ed-dynamic-route-field input{width:100%;min-width:0;padding:8px 9px;border:1px solid #474b52;border-radius:4px;background:#171819;color:#efefef;font:12px ui-monospace,monospace}.ed-dynamic-route-field input:focus{outline:1px solid #388bfd;border-color:#388bfd}.ed-dynamic-route-field small{color:#92979f;font-size:10px}.ed-dynamic-route-error{color:#f48771;font-size:11px}.ed-dynamic-route-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.ed-dynamic-route-submit{background:#0e639c;color:white}.ed-dynamic-route-footnote{margin:14px 0 0;color:#92979f;font-size:10px;line-height:1.5}.ed-dynamic-route-footnote code{color:#b7d7f9}.ed-diagnostic{display:grid;grid-template-columns:12px minmax(0,1fr);gap:6px;width:100%;padding:6px 7px;text-align:left;border-radius:2px}.ed-diagnostic:hover{background:#2a2d2e}.ed-diagnostic[aria-pressed="true"]{background:#094771}.ed-problem-glyph{font:700 11px ui-monospace,monospace}.ed-problem-glyph.error{color:var(--ed-error)}.ed-problem-glyph.warning{color:var(--ed-warning)}.ed-diagnostic-message{font-size:11px;line-height:1.4;display:block;overflow-wrap:anywhere;color:#ddd}.ed-diagnostic-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:3px;color:#999;font:9px ui-monospace,monospace}.ed-severity-summary{display:flex;gap:12px;padding:7px 0 9px;border-bottom:1px solid #383838;margin-bottom:8px;color:#bdbdbd;font:10px ui-monospace,monospace}.ed-severity-summary strong{color:#f48771}.ed-severity-summary .warn{color:#cca700}.ed-detail-text{font:11px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;color:#d4d4d4;max-height:230px;overflow:auto;margin:6px 0 10px}
@media(max-width:1050px){.ed-body{grid-template-columns:40px 166px minmax(250px,1fr)}.ed-inspector{position:fixed;right:0;top:40px;bottom:0;width:min(318px,calc(100vw - 205px));box-shadow:-15px 0 35px #0009;z-index:3}.ed-stage{grid-column:3;grid-row:1}.ed-sidebar{grid-column:2;grid-row:1}}@media(max-width:680px){.ed-body{grid-template-columns:38px minmax(220px,1fr)}.ed-sidebar{display:none}.ed-stage{grid-column:2;grid-row:1}.ed-inspector{width:min(330px,calc(100vw - 42px));}.ed-count{display:none}.ed-fps{font-size:9px}.ed-route-picker select{max-width:90px}.ed-tools{gap:3px;padding:4px}.ed-button{padding:5px 6px}.ed-viewport-scroll{padding:8px}}
`;

function clampNumber(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.min(max, Math.max(min, value));
}

function readDebugNode(element: HTMLElement): DebugNode {
	const data = element.dataset;
	const computed = element.ownerDocument.defaultView?.getComputedStyle(element);
	const columns = data.engineDebugType === "grid" && computed?.display === "grid"
		? computed.gridTemplateColumns.split(" ").filter(Boolean).length
		: undefined;
	return {
		id: data.engineDebugId ?? "unknown",
		path: data.engineDebugPath ?? "unknown",
		type: data.engineDebugType ?? element.tagName.toLowerCase(),
		name: data.engineDebugName ?? data.engineDebugType ?? element.tagName.toLowerCase(),
		boundary: data.engineDebugBoundary ?? "UNKNOWN",
		rendered: data.engineDebugRendered ?? "Unknown",
		reason: data.engineDebugReason ?? "No compiler explanation is available.",
		hydration: data.engineDebugHydration ?? "Unknown",
		clientJs: data.engineDebugClientJs ?? "Unknown",
		workClass: data.engineDebugWorkClass ?? "unknown",
		capabilities: (data.engineDebugCapabilities ?? "").split(",").filter(Boolean),
		columns,
	};
}

function taskForNode(element: HTMLElement, view: Window): EngineSchedulerDebugTask {
	const node = readDebugNode(element);
	const box = element.getBoundingClientRect();
	const visible = box.bottom > 0 && box.right > 0 && box.top < view.innerHeight && box.left < view.innerWidth;
	const near = box.bottom > -700 && box.top < view.innerHeight + 700;
	const state = visible ? "VISIBLE" : near ? "NEAR" : node.workClass === "sleeping" ? "SLEEPING" : "DEFERRED";
	const animated = /canvas|video|manim|shader/i.test(node.type);
	return {
		id: node.id,
		label: node.name,
		nodeId: node.id,
		nodeType: node.type,
		state,
		activity: state === "VISIBLE" ? animated ? "RUNNING" : "IDLE" : state === "NEAR" ? "PRELOADING" : state,
		updatedAt: performance.now(),
	};
}

function syntheticMatch(profile: DeviceProfile, query: string): boolean | undefined {
	const normalized = query.toLowerCase();
	if (normalized.includes("orientation:")) return normalized.includes(profile.orientation);
	if (normalized.includes("hover:")) return normalized.includes(profile.hover ? "hover" : "none");
	if (normalized.includes("pointer:")) return normalized.includes(profile.touch ? "coarse" : "fine");
	if (normalized.includes("resolution:") && normalized.includes("dppx")) {
		const requested = Number(normalized.match(/([0-9.]+)dppx/)?.[1]);
		return Number.isFinite(requested) ? profile.dpr >= requested : undefined;
	}
	return undefined;
}

function applyDeviceProfile(frameWindow: DebugSchedulerWindow, profile: DeviceProfile): void {
	frameWindow.__NEXT_ENGINE_DEVICE_DEBUG__ = { profile };
	frameWindow.document.documentElement.dataset.engineDebugDevice = profile.mode.toLowerCase();
	frameWindow.document.documentElement.style.setProperty("--engine-debug-dpr", String(profile.dpr));
	frameWindow.document.documentElement.style.setProperty("--engine-debug-refresh", String(profile.refresh));
	try {
		Object.defineProperty(frameWindow, "devicePixelRatio", { configurable: true, get: () => profile.dpr });
	} catch {
		// Some engines expose a non-configurable native DPR. The debug bridge still records the requested value.
	}
	try {
		Object.defineProperty(frameWindow.navigator, "maxTouchPoints", { configurable: true, get: () => profile.touch ? 5 : 0 });
	} catch {
		// The viewport and media-query simulator remain available when navigator is locked.
	}
	if (!frameWindow.__NEXT_ENGINE_VISUAL_VIEWPORT_CAPTURED__) {
		frameWindow.__NEXT_ENGINE_ORIGINAL_VISUAL_VIEWPORT__ = frameWindow.visualViewport;
		frameWindow.__NEXT_ENGINE_VISUAL_VIEWPORT_CAPTURED__ = true;
	}
	try {
		Object.defineProperty(frameWindow, "visualViewport", {
			configurable: true,
			get: () => profile.visualViewport ? frameWindow.__NEXT_ENGINE_ORIGINAL_VISUAL_VIEWPORT__ ?? null : null,
		});
	} catch {
		// The requested capability remains recorded when the native property cannot be redefined.
	}
	if (!frameWindow.__NEXT_ENGINE_ORIGINAL_MATCH_MEDIA__) {
		frameWindow.__NEXT_ENGINE_ORIGINAL_MATCH_MEDIA__ = frameWindow.matchMedia.bind(frameWindow);
	}
	const originalMatchMedia = frameWindow.__NEXT_ENGINE_ORIGINAL_MATCH_MEDIA__;
	frameWindow.matchMedia = ((query: string) => {
		const simulated = syntheticMatch(frameWindow.__NEXT_ENGINE_DEVICE_DEBUG__?.profile ?? profile, query);
		if (simulated === undefined) return originalMatchMedia(query);
		return {
			matches: simulated,
			media: query,
			onchange: null,
			addListener: () => undefined,
			removeListener: () => undefined,
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
			dispatchEvent: () => false,
		};
	}) as typeof window.matchMedia;
	const resizeEvent = frameWindow.document.createEvent("Event");
	resizeEvent.initEvent("resize", false, false);
	frameWindow.dispatchEvent(resizeEvent);
	const orientationEvent = frameWindow.document.createEvent("Event");
	orientationEvent.initEvent("orientationchange", false, false);
	frameWindow.dispatchEvent(orientationEvent);
}

function mergeTasks(actual: EngineSchedulerDebugTask[], inferred: EngineSchedulerDebugTask[]): EngineSchedulerDebugTask[] {
	const tasks = new Map(inferred.map((task) => [task.nodeId ?? task.id, task]));
	for (const task of actual) tasks.set(task.nodeId ?? task.id, task);
	return [...tasks.values()].sort((left, right) => left.label.localeCompare(right.label));
}

export interface EngineDebugPageProps {
	pages: readonly string[];
}

export function EngineDebugPage({ pages }: EngineDebugPageProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const viewportRef = useRef<HTMLDivElement>(null);
	const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
	const [fitPreview, setFitPreview] = useState(true);
	const [routeSearch, setRouteSearch] = useState("");
	const [routePatterns, setRoutePatterns] = useState<string[]>([...pages]);
	const [nextStaticPaths, setNextStaticPaths] = useState<string[]>(pages.filter(route => !isEngineDebugDynamicRoute(route)));
	const [observedRoutes, setObservedRoutes] = useState<string[]>([]);
	const [dynamicRoutePattern, setDynamicRoutePattern] = useState<string | null>(null);
	const previousTasks = useRef(new Map<string, EngineSchedulerDebugTask>());
	const [selectedPage, setSelectedPage] = useState(pages[0] ?? "/");
	const [picker, setPicker] = useState(false);
	const [overlay, setOverlay] = useState(false);
	const [tab, setTab] = useState<"Node" | "Errors" | "Scheduler" | "Device">("Node");
	const [diagnostics, setDiagnostics] = useState<EngineDebugDiagnostic[]>([]);
	const diagnosticsRef = useRef<EngineDebugDiagnostic[]>([]);
	const inlineCalloutsRef = useRef(new Map<string, () => void>());
	const [selectedDiagnosticId, setSelectedDiagnosticId] = useState<string | null>(null);
	const [diagnosticFilter, setDiagnosticFilter] = useState<"all" | "error" | "warning">("all");
	const [selectedNode, setSelectedNode] = useState<DebugNode | null>(null);
	const [scheduler, setScheduler] = useState<EngineSchedulerDebugSnapshot>(EMPTY_SCHEDULER);
	const [inferredTransitions, setInferredTransitions] = useState<EngineSchedulerDebugTransition[]>([]);
	const [device, setDevice] = useState<DeviceProfile>(DEVICE_PROFILES.Desktop);
	const [fps, setFps] = useState(0);
	const [layoutByDevice, setLayoutByDevice] = useState<Record<string, number>>({});
	const [previewStatus, setPreviewStatus] = useState<"waiting" | "ready" | "error">("waiting");
	const frameSource = useMemo(() => `${selectedPage}${selectedPage.includes("?") ? "&" : "?"}__engine_debug=1`, [selectedPage]);
	const visibleRoutes = useMemo(() => {
		const query = routeSearch.trim().toLowerCase();
		return query ? routePatterns.filter(route => route.toLowerCase().includes(query)) : routePatterns;
	}, [routePatterns, routeSearch]);
	const knownConcretePaths = useMemo(() => [...new Set([...nextStaticPaths, ...observedRoutes])], [nextStaticPaths, observedRoutes]);
	const chooseRoute = (route: string) => {
		if (isEngineDebugDynamicRoute(route)) {
			setDynamicRoutePattern(route);
			return;
		}
		setSelectedPage(route);
		setSelectedNode(null);
		setDynamicRoutePattern(null);
	};
	const previewScale = useMemo(() => {
		if (!fitPreview || viewportSize.width <= 0 || viewportSize.height <= 0) return 1;
		return Math.max(0.1, Math.min(1, (viewportSize.width - 30) / device.width, (viewportSize.height - 30) / device.height));
	}, [device.height, device.width, fitPreview, viewportSize.height, viewportSize.width]);

	useEffect(() => {
		setRoutePatterns([...pages]);
		setNextStaticPaths(current => [...new Set([...current.filter(path => !routePatterns.includes(path)), ...pages.filter(route => !isEngineDebugDynamicRoute(route))])]);
	}, [pages]);

	useEffect(() => {
		let active = true;
		const loadRouteCatalog = () => {
			void fetch("/_engine/debug/routes", { cache: "no-store" })
				.then(response => response.ok ? response.json() : null)
				.then((payload: { patterns?: unknown; staticPaths?: unknown } | null) => {
					if (!active || !payload) return;
					if (Array.isArray(payload.patterns)) setRoutePatterns(payload.patterns.filter((route): route is string => typeof route === "string" && route.startsWith("/")));
					if (Array.isArray(payload.staticPaths)) setNextStaticPaths(payload.staticPaths.filter((route): route is string => typeof route === "string" && route.startsWith("/")));
				})
				.catch(() => undefined);
		};
		loadRouteCatalog();
		const timer = window.setInterval(loadRouteCatalog, 5_000);
		return () => { active = false; window.clearInterval(timer); };
	}, []);

	useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) return;
		const measure = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
		measure();
		const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
		observer?.observe(viewport);
		window.addEventListener("resize", measure);
		return () => {
			observer?.disconnect();
			window.removeEventListener("resize", measure);
		};
	}, []);

	useEffect(() => {
		const url = new URL(window.location.href);
		const requestedRoute = url.searchParams.get("route");
		const issueId = url.searchParams.get("issue");
		if (requestedRoute && pages.includes(requestedRoute)) setSelectedPage(requestedRoute);

		if (issueId) {
			const handoffKey = "nextjs-engine:debug:diagnostic-handoff";
			try {
				const raw = window.sessionStorage.getItem(handoffKey);
				if (raw) {
					const handoff = JSON.parse(raw) as {
						expiresAt?: unknown;
						route?: unknown;
						diagnostic?: EngineDebugDiagnostic;
					};
					const diagnostic = handoff.diagnostic;
					const validDiagnostic = Boolean(diagnostic
						&& typeof diagnostic.id === "string"
						&& diagnostic.id === issueId
						&& typeof diagnostic.at === "number"
						&& typeof diagnostic.message === "string"
						&& typeof diagnostic.detail === "string"
						&& ["error", "warning"].includes(diagnostic.severity)
						&& ["Hydration", "SSR", "Runtime", "Console"].includes(diagnostic.category)
						&& ["runtime", "unhandled-rejection", "console", "next-overlay"].includes(diagnostic.source));
					if (validDiagnostic && typeof handoff.expiresAt === "number" && handoff.expiresAt >= Date.now()
						&& typeof handoff.route === "string" && pages.includes(handoff.route)
						&& (!requestedRoute || requestedRoute === handoff.route)) {
						diagnosticsRef.current = [diagnostic!];
						setDiagnostics([diagnostic!]);
						setSelectedDiagnosticId(diagnostic!.id);
						setTab("Errors");
					}
				}
				window.sessionStorage.removeItem(handoffKey);
			} catch {
				// Ignore malformed or unavailable session storage and keep the workbench usable.
			}
		}

		if (url.searchParams.has("route") || url.searchParams.has("issue")) {
			url.searchParams.delete("route");
			url.searchParams.delete("issue");
			window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
		}
	}, [pages]);


	useEffect(() => {
		setPreviewStatus("waiting");
	}, [frameSource]);

	const handlePreviewLoad = () => {
		const frame = iframeRef.current;
		if (!frame) return;
		const frameDocument = frame.contentDocument;
		if (!frameDocument?.documentElement) {
			setPreviewStatus("error");
			return;
		}
		// Keep the route visible. Next.js overlays can describe a build failure from another
		// route; those diagnostics belong in Problems and must not obscure / or unrelated pages.
		setPreviewStatus("ready");
	};

	const reloadPreview = () => {
		setPreviewStatus("waiting");
		try {
			iframeRef.current?.contentWindow?.location.reload();
		} catch {
			const frame = iframeRef.current;
			if (frame) frame.src = frameSource;
		}
	};

	useEffect(() => {
		const frame = iframeRef.current;
		if (!frame) return;
		let frameCleanup = () => undefined;
		const connect = () => {
			frameCleanup();
			const frameWindow = frame.contentWindow as DebugSchedulerWindow | null;
			const frameDocument = frame.contentDocument;
			if (!frameWindow || !frameDocument) return;
			applyDeviceProfile(frameWindow, device);
			frameDocument.documentElement.dataset.engineDebugOverlay = String(overlay);
			let overlayStyle = frameDocument.getElementById("__engine_debug_overlay__") as HTMLStyleElement | null;
			if (!overlayStyle) {
				overlayStyle = frameDocument.createElement("style");
				overlayStyle.id = "__engine_debug_overlay__";
				overlayStyle.textContent = FRAME_OVERLAY_CSS;
				frameDocument.head.appendChild(overlayStyle);
			}

			const reportDiagnostic = (
				source: EngineDebugSource,
				message: unknown,
				detail?: unknown,
				location?: string,
				routeOverride?: string | null,
			) => {
				const diagnostic = createEngineDebugDiagnostic({ source, message, detail, location, route: routeOverride ?? frameWindow.location.pathname });
				const nextDiagnostics = appendEngineDebugDiagnostics(diagnosticsRef.current, diagnostic);
				diagnosticsRef.current = nextDiagnostics;
				setDiagnostics(nextDiagnostics);
				const stored = nextDiagnostics[nextDiagnostics.length - 1] ?? diagnostic;
				setSelectedDiagnosticId((current) => current ?? stored.id);
				const retainedIds = new Set(nextDiagnostics.map((item) => item.id));
				for (const [id, cleanup] of inlineCalloutsRef.current) {
					if (!retainedIds.has(id)) {
						cleanup();
						inlineCalloutsRef.current.delete(id);
					}
				}
				const previousCallout = inlineCalloutsRef.current.get(stored.id);
				previousCallout?.();
				inlineCalloutsRef.current.delete(stored.id);
				const cleanupCallout = installEngineDebugInlineCallout(frameDocument, stored, frameWindow.location.pathname);
				if (cleanupCallout) inlineCalloutsRef.current.set(stored.id, cleanupCallout);
				if (source !== "console" && source !== "next-overlay" && stored.severity === "error") setPreviewStatus("error");
			};
			const handleRuntimeError = (event: ErrorEvent) => {
				reportDiagnostic(
					"runtime",
					event.message || "Uncaught browser runtime error",
					event.error,
					event.filename ? event.filename + (event.lineno ? ":" + event.lineno : "") : frameWindow.location.pathname,
				);
			};
			const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
				reportDiagnostic("unhandled-rejection", "Unhandled promise rejection", event.reason, frameWindow.location.pathname);
			};
			const originalConsoleError = frameWindow.console.error;
			const patchedConsoleError: typeof frameWindow.console.error = (...args) => {
				const detail = args.map((argument) => redactEngineDebugText(argument, 1_500)).join("\n");
				const message = typeof args[0] === "string" ? args[0] : detail || "console.error";
				reportDiagnostic("console", message, detail, frameWindow.location.pathname);
				originalConsoleError.apply(frameWindow.console, args);
			};
			let consolePatched = false;
			try {
				frameWindow.console.error = patchedConsoleError;
				consolePatched = true;
			} catch {
				// Some browser realms reject writes to console methods.
			}
			if (!consolePatched) {
				try {
					Object.defineProperty(frameWindow.console, "error", {
						configurable: true,
						writable: true,
						value: patchedConsoleError,
					});
					consolePatched = true;
				} catch {
					// Keep the window error/rejection listeners active if console cannot be wrapped.
				}
			}
			frameWindow.addEventListener("error", handleRuntimeError);
			frameWindow.addEventListener("unhandledrejection", handleUnhandledRejection);
			const scanNextOverlay = () => {
				for (const element of frameDocument.querySelectorAll<HTMLElement>("nextjs-portal, nextjs-error, [data-nextjs-dialog], [data-nextjs-error], [data-nextjs-error-message]")) {
					const text = (element.shadowRoot?.textContent || element.innerText || element.textContent || "").trim();
					if (!text || !/(error|exception|failed|hydration|mismatch|digest)/i.test(text)) continue;
					if (element.dataset.engineDebugCaptured !== "true") {
						element.dataset.engineDebugCaptured = "true";
						const affectedRoute = inferEngineDebugOverlayRoute(text, pages);
						reportDiagnostic("next-overlay", "Next.js development error overlay", text, affectedRoute ?? frameWindow.location.pathname, affectedRoute);
						if (affectedRoute && (affectedRoute === frameWindow.location.pathname || matchesEngineDebugRoutePattern(affectedRoute, frameWindow.location.pathname))) {
							setPreviewStatus("error");
						}
					}
					// Do not let Next.js' full-screen dev overlay hide the rest of the last
					// rendered route. Keep the actual diagnostic in the parent Problems panel.
					element.style.setProperty("display", "none", "important");
					let badge = frameDocument.getElementById("__engine_debug_next_error_badge__") as HTMLDivElement | null;
					if (!badge && frameDocument.body) {
						badge = frameDocument.createElement("div");
						badge.id = "__engine_debug_next_error_badge__";
						badge.setAttribute("data-engine-debug-next-overlay-hidden", "true");
						badge.setAttribute("role", "status");
						badge.textContent = "Next.js error overlay hidden · details in EngineDebug Problems";
						Object.assign(badge.style, {
							position: "fixed",
							left: "10px",
							bottom: "10px",
							zIndex: "2147483647",
							maxWidth: "calc(100vw - 20px)",
							padding: "7px 10px",
							border: "1px solid #a33",
							borderRadius: "4px",
							background: "#2a171a",
							color: "#ffd7dc",
							font: "11px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace",
							boxShadow: "0 3px 18px #0008",
							pointerEvents: "none",
						});
						frameDocument.body.appendChild(badge);
					}
				}
			};
			const overlayObserver = new MutationObserver(scanNextOverlay);
			if (frameDocument.body) overlayObserver.observe(frameDocument.body, { childList: true, subtree: true, characterData: true });
			scanNextOverlay();

			const selectNode = (event: MouseEvent) => {
				if (!picker) return;
				const eventTarget = event.target as (Element & { closest?: Element["closest"] }) | null;
				const target = typeof eventTarget?.closest === "function"
					? eventTarget.closest("[data-engine-debug-id]") as HTMLElement | null
					: null;
				if (!target) return;
				event.preventDefault();
				event.stopPropagation();
				frameDocument.querySelectorAll("[data-engine-debug-selected]").forEach((entry) => entry.removeAttribute("data-engine-debug-selected"));
				target.dataset.engineDebugSelected = "true";
				const node = readDebugNode(target);
				setSelectedNode(node);
				setTab("Node");
				if (node.columns !== undefined) setLayoutByDevice((current) => ({ ...current, [device.mode]: node.columns! }));
			};
			frameDocument.addEventListener("click", selectNode, true);

			const updateScheduler = (event?: Event) => {
				const pathname = frameWindow.location.pathname;
				setObservedRoutes(current => current.includes(pathname) ? current : [...current, pathname].slice(-150));
				const actual = event
					? (event as CustomEvent<EngineSchedulerDebugSnapshot>).detail
					: frameWindow.__NEXT_ENGINE_SCHEDULER_DEBUG__?.snapshot() ?? EMPTY_SCHEDULER;
				const inferred = [...frameDocument.querySelectorAll<HTMLElement>("[data-engine-debug-id]")]
					.map((element) => taskForNode(element, frameWindow));
				const tasks = mergeTasks(actual.tasks, inferred);
				const transitions: EngineSchedulerDebugTransition[] = [];
				for (const task of tasks) {
					const previous = previousTasks.current.get(task.id);
					if (previous && (previous.state !== task.state || previous.activity !== task.activity)) {
						transitions.push({ id: task.id, label: task.label, from: `${previous.state}/${previous.activity}`, to: `${task.state}/${task.activity}`, at: performance.now() });
					}
				}
				previousTasks.current = new Map(tasks.map((task) => [task.id, task]));
				if (transitions.length > 0) setInferredTransitions((current) => [...current, ...transitions].slice(-50));
				setScheduler({ ...actual, tasks });
				if (selectedNode) {
					const selected = frameDocument.querySelector<HTMLElement>(`[data-engine-debug-id="${CSS.escape(selectedNode.id)}"]`);
					if (selected) {
						const node = readDebugNode(selected);
						setSelectedNode(node);
						if (node.columns !== undefined) setLayoutByDevice((current) => ({ ...current, [device.mode]: node.columns! }));
					}
				}
			};
			frameWindow.addEventListener("engine:debug:scheduler", updateScheduler);
			const scanTimer = frameWindow.setInterval(updateScheduler, 400);
			updateScheduler();

			let raf = 0;
			let sampleStart = 0;
			let samples = 0;
			const measure = (now: number) => {
				if (sampleStart === 0) sampleStart = now;
				samples += 1;
				if (now - sampleStart >= 500) {
					setFps(samples * 1000 / (now - sampleStart));
					sampleStart = now;
					samples = 0;
				}
				raf = frameWindow.requestAnimationFrame(measure);
			};
			raf = frameWindow.requestAnimationFrame(measure);
			frameCleanup = () => {
				for (const cleanupCallout of inlineCalloutsRef.current.values()) cleanupCallout();
				inlineCalloutsRef.current.clear();
				frameDocument.removeEventListener("click", selectNode, true);
				frameWindow.removeEventListener("engine:debug:scheduler", updateScheduler);
				frameWindow.removeEventListener("error", handleRuntimeError);
				frameWindow.removeEventListener("unhandledrejection", handleUnhandledRejection);
				if (consolePatched) {
					try {
						Object.defineProperty(frameWindow.console, "error", {
							configurable: true,
							writable: true,
							value: originalConsoleError,
						});
					} catch {
						try { frameWindow.console.error = originalConsoleError; } catch { /* Console method is browser-owned. */ }
					}
				}
				overlayObserver.disconnect();
				frameWindow.clearInterval(scanTimer);
				frameWindow.cancelAnimationFrame(raf);
			};
		};
		frame.addEventListener("load", connect);
		connect();
		return () => {
			frame.removeEventListener("load", connect);
			frameCleanup();
		};
	}, [device, overlay, picker, selectedNode?.id]);

	const changeMode = (mode: DeviceMode) => {
		if (mode === "Custom") {
			setDevice((current) => ({ ...current, mode: "Custom" }));
			return;
		}
		setDevice(DEVICE_PROFILES[mode]);
	};
	const updateDevice = <Key extends keyof DeviceProfile>(key: Key, value: DeviceProfile[Key]) => {
		setDevice((current) => ({ ...current, mode: "Custom", [key]: value }));
	};
	const selectedTask = selectedNode
		? scheduler.tasks.find((task) => task.nodeId === selectedNode.id)
		: undefined;
	const transitions = [...scheduler.transitions, ...inferredTransitions].slice(-50).reverse();

	return (
		<main className="ed-shell">
			<style>{PAGE_CSS}</style>
			<header className="ed-head">
				<span className="ed-brand-mark" aria-hidden="true">NE</span>
				<h1>Next.js Engine Debug</h1>
				<span className="ed-badge">DEV ONLY</span>
				<span className="ed-count">{diagnostics.filter((item) => item.severity === "error").length} errors · {diagnostics.filter((item) => item.severity === "warning").length} warnings · /_engine/debug</span>
			</header>
			<div className="ed-body">
				<nav className="ed-activity" aria-label="Debug views">
					<button type="button" className="ed-activity-button" aria-label="Explorer" title="Explorer" aria-pressed={tab === "Node"} onClick={() => setTab("Node")}><span className="ed-activity-glyph">⌕</span></button>
					<button type="button" className="ed-activity-button" aria-label="Problems" title="Problems" aria-pressed={tab === "Errors"} onClick={() => setTab("Errors")}><span className="ed-activity-glyph">!</span></button>
					<button type="button" className="ed-activity-button" aria-label="Scheduler" title="Scheduler" aria-pressed={tab === "Scheduler"} onClick={() => setTab("Scheduler")}><span className="ed-activity-glyph">◷</span></button>
					<button type="button" className="ed-activity-button" aria-label="Device" title="Device simulation" aria-pressed={tab === "Device"} onClick={() => setTab("Device")}><span className="ed-activity-glyph">▦</span></button>
				</nav>
				<nav className="ed-sidebar" aria-label="Application pages">
					<h2 className="ed-section-title">Page explorer</h2>
					<div className="ed-sidebar-subtitle">APPLICATION ROUTES</div>
					<input className="ed-route-search" aria-label="Filter routes" placeholder="Filter routes…" value={routeSearch} onChange={event => setRouteSearch(event.target.value)} />
					<div className="ed-route-count">{visibleRoutes.length} of {pages.length} routes</div>
					{visibleRoutes.map(route => (
						<button key={route} type="button" className="ed-route" data-route={route} title={route} aria-label={route === "/" ? "/ (home)" : route} aria-current={selectedPage === route || matchesEngineDebugRoutePattern(route, selectedPage) ? "page" : undefined} onClick={() => chooseRoute(route)}>
							{route === "/" ? "/ (home)" : route}
						</button>
					))}
					{visibleRoutes.length === 0 && <div className="ed-empty">No routes match this filter.</div>}
				</nav>
				<section className="ed-stage" aria-label="Live page preview">
					<div className="ed-tools">
						<label className="ed-route-picker">Preview
							<select aria-label="Preview route" value={selectedPage} onChange={(event) => chooseRoute(event.target.value)}>
								{!routePatterns.includes(selectedPage) && <option key={selectedPage} value={selectedPage}>{selectedPage}</option>}
								{routePatterns.map((route) => <option key={route} value={route}>{route === "/" ? "/ (home)" : route}</option>)}
							</select>
						</label>
						<button type="button" className="ed-button" aria-pressed={picker} onClick={() => setPicker((value) => !value)}>Pick node</button>
						<button type="button" className="ed-button" aria-pressed={overlay} onClick={() => setOverlay((value) => !value)}>Runtime boundaries</button>
						<button type="button" className="ed-button" aria-label="Fit preview to available space" aria-pressed={fitPreview} onClick={() => setFitPreview(value => !value)}>{fitPreview ? "Fit: On" : "Fit: Off"}</button>
						<span className="ed-fit-label">{Math.round(previewScale * 100)}%</span>
						<button type="button" className="ed-button" aria-label="Reload preview" title="Reload preview" onClick={reloadPreview}>↻ Reload</button>
						{previewStatus === "error" && <button type="button" className="ed-button" onClick={() => setTab("Errors")}>View Problems</button>}
						<span className="ed-spacer" />
						<span className={`ed-preview-status ${previewStatus === "ready" ? "ready" : previewStatus === "error" ? "error" : ""}`} aria-live="polite">
							{previewStatus === "ready" ? "READY" : previewStatus === "error" ? "ERROR" : "WAITING"}
						</span>
						<span className="ed-fps">{device.width}×{device.height} · DPR {device.dpr} · {fps.toFixed(1)} FPS</span>
					</div>
					<div className="ed-viewport-scroll" ref={viewportRef}>
						<div className="ed-frame-fit" style={{ width: Math.round(device.width * previewScale), height: Math.round(device.height * previewScale) }}>
						<div className="ed-frame-shell" style={{ width: device.width, height: device.height, transform: "scale(" + previewScale + ")" }} aria-busy={previewStatus === "waiting"}>
							<iframe ref={iframeRef} className="ed-frame" title={"Live preview: " + selectedPage} src={frameSource} onLoad={handlePreviewLoad} />
							{previewStatus === "waiting" && (
								<div className="ed-preview-state" role="status" aria-live="polite">
									<div className="ed-preview-state-card">
										<span className="ed-preview-orbit" aria-hidden="true" />
										<strong className="ed-preview-title">Waiting for Next.js…</strong>
										<span className="ed-preview-description">Next.js may be compiling this route or waiting for the dev server. The preview will become interactive when the response arrives.</span>
										<div className="ed-preview-progress" aria-hidden="true" />
										<div className="ed-preview-actions">
											<button type="button" className="ed-button" onClick={reloadPreview}>Reload preview</button>
										</div>
									</div>
								</div>
							)}
						</div>
						</div>
					</div>
				</section>
				<aside className={"ed-inspector" + (tab === "Errors" ? " ed-inspector-problems" : "")}>
					<div className="ed-tabs" role="tablist" aria-label="Debug inspectors">
						{(["Node", "Errors", "Scheduler", "Device"] as const).map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} className="ed-button" aria-pressed={tab === name} onClick={() => setTab(name)}>{name}{name === "Errors" && diagnostics.length > 0 ? " " + diagnostics.length : ""}</button>)}
					</div>
					{tab === "Node" && (
						selectedNode ? <NodeInspector node={selectedNode} task={selectedTask} fps={fps} refresh={device.refresh} layouts={layoutByDevice} /> : <div className="ed-empty">Pick node, then select an Engine element in the preview.</div>
					)}
					{tab === "Errors" && (
						<ErrorInspector
							diagnostics={diagnostics}
							selectedId={selectedDiagnosticId}
							filter={diagnosticFilter}
							onFilter={setDiagnosticFilter}
							onSelect={setSelectedDiagnosticId}
							onApplied={() => { reloadPreview(); setPreviewStatus("waiting"); }}
							onClear={() => {
							for (const cleanupCallout of inlineCalloutsRef.current.values()) cleanupCallout();
							inlineCalloutsRef.current.clear();
							diagnosticsRef.current = [];
							setDiagnostics([]);
							setSelectedDiagnosticId(null);
						}}
						/>
					)}
					{tab === "Scheduler" && <SchedulerInspector snapshot={scheduler} transitions={transitions} />}
					{tab === "Device" && <DeviceInspector device={device} layouts={layoutByDevice} selectedNode={selectedNode} changeMode={changeMode} updateDevice={updateDevice} />}
				</aside>
			</div>
			{dynamicRoutePattern && <EngineDebugDynamicRoutePicker pattern={dynamicRoutePattern} availablePaths={knownConcretePaths} onChoose={route => { setSelectedPage(route); setSelectedNode(null); setDynamicRoutePattern(null); }} onClose={() => setDynamicRoutePattern(null)} />}
		</main>
	);
}


function ErrorInspector({
	diagnostics,
	selectedId,
	filter,
	onFilter,
	onSelect,
	onApplied,
	onClear,
}: {
	diagnostics: EngineDebugDiagnostic[];
	selectedId: string | null;
	filter: "all" | "error" | "warning";
	onFilter: (value: "all" | "error" | "warning") => void;
	onSelect: (id: string) => void;
	onApplied: () => void;
	onClear: () => void;
}) {
	const visible = diagnostics.filter((item) => filter === "all" || item.severity === filter).slice().reverse();
	const selected = diagnostics.find((item) => item.id === selectedId);
	const errorCount = diagnostics.filter((item) => item.severity === "error").length;
	const warningCount = diagnostics.length - errorCount;
	const errorOccurrences = diagnostics.filter(item => item.severity === "error").reduce((sum, item) => sum + (item.occurrences ?? 1), 0);
	const warningOccurrences = diagnostics.filter(item => item.severity === "warning").reduce((sum, item) => sum + (item.occurrences ?? 1), 0);
	const copySelected = () => {
		if (!selected || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
		void navigator.clipboard.writeText(formatEngineDebugDiagnostic(selected)).catch(() => undefined);
	};
	return (
		<div className="ed-problems">
			<div className="ed-severity-summary"><span><strong>{errorCount}</strong> issues / {errorOccurrences} hits</span><span><strong className="warn">{warningCount}</strong> warnings / {warningOccurrences} hits</span><span>{diagnostics.length}/200 unique</span></div>
			<div className="ed-problem-toolbar">
				{(["all", "error", "warning"] as const).map((value) => <button key={value} type="button" className="ed-filter" aria-pressed={filter === value} onClick={() => onFilter(value)}>{value === "all" ? "All" : value === "error" ? "Errors" : "Warnings"}</button>)}
				<span className="ed-problem-count">{visible.length} shown</span>
				<button type="button" className="ed-filter" onClick={onClear} disabled={diagnostics.length === 0}>Clear</button>
			</div>
			{selected && (
				<section className="ed-card ed-selected-detail" aria-label="Selected diagnostic details">
					<h3>{selected.category} diagnostic{(selected.occurrences ?? 1) > 1 ? " · " + selected.occurrences + " occurrences" : ""}</h3>
					<DebugRow name="Severity" value={selected.severity.toUpperCase()} />
					<DebugRow name="Likely owner" value={selected.ownerHint} />
					<DebugRow name="Captured from" value={selected.source} />
					{selected.location && <DebugRow name="Location" value={selected.location} />}
					<DebugRow name="First seen" value={new Date(selected.firstAt ?? selected.at).toLocaleString()} />
					<DebugRow name="Last seen" value={new Date(selected.at).toLocaleString()} />
					{(selected.routes?.length ?? 0) > 0 && <div className="ed-route-tags">Routes: {selected.routes!.join(" · ")}</div>}
					<p className="ed-explain">Owner is a heuristic from the message and stack, not proof. Verify the source before changing NE or application code.</p>
					<pre className="ed-detail-text">{[selected.message, selected.detail].filter(Boolean).join("\n\n")}</pre>
					<button type="button" className="ed-button" onClick={copySelected}>Copy details</button>
					<EngineDebugFixEditor diagnostic={selected} onApplied={onApplied} />
				</section>
			)}
			<div className="ed-diagnostic-list" aria-label="Captured problems">
				{visible.length === 0 ? <div className="ed-empty">No captured problems. Run or reload the preview to collect console, runtime, rejection, and visible Next.js overlay errors.</div> : visible.map((item) => (
					<button key={item.id} type="button" className="ed-diagnostic" aria-pressed={selected?.id === item.id} onClick={() => onSelect(item.id)}>
						<span className={"ed-problem-glyph " + item.severity}>{item.severity === "error" ? "●" : "▲"}</span>
						<span><span className="ed-diagnostic-message">{item.message}</span><span className="ed-diagnostic-meta"><span>{item.category}</span><span>{new Date(item.at).toLocaleTimeString()}</span>{(item.occurrences ?? 1) > 1 && <span className="ed-diagnostic-count">×{item.occurrences}</span>}{(item.routes?.length ?? 0) > 0 && <span>{item.routes!.length} route{item.routes!.length === 1 ? "" : "s"}</span>}</span></span>
					</button>
				))}
			</div>

			<p className="ed-explain ed-problems-footnote"><span className="ed-warning">Capture boundary:</span> browser errors, unhandled rejections, console errors, and visible Next.js overlays are collected from this same-origin preview. Server errors emitted before a page reaches the browser may still appear only in the dev-server terminal.</p>
		</div>
	);
}

function NodeInspector({ node, task, fps, refresh, layouts }: { node: DebugNode; task?: EngineSchedulerDebugTask; fps: number; refresh: number; layouts: Record<string, number> }) {
	return (
		<div className="ed-card">
			<h3>{node.name}</h3>
			<DebugRow name="Type" value={node.type} />
			<DebugRow name="Rendered" value={node.rendered} />
			<DebugRow name="Why?" value={node.reason} />
			<DebugRow name="Hydration" value={node.hydration} />
			<DebugRow name="Client JS" value={node.clientJs} />
			<DebugRow name="Boundary" value={node.boundary} />
			<DebugRow name="Status" value={task ? `${task.state} / ${task.activity}` : node.workClass.toUpperCase()} />
			{node.type.toLowerCase().includes("canvas") && <><DebugRow name="Refresh" value={`${refresh}Hz simulated target`} /><DebugRow name="Current" value={`${fps.toFixed(1)} FPS`} /></>}
			{node.capabilities.length > 0 && <DebugRow name="Capabilities" value={node.capabilities.join(", ")} />}
			<DebugRow name="Path" value={node.path} />
			{node.columns !== undefined && <p className="ed-explain">This grid currently resolves to {node.columns} column{node.columns === 1 ? "" : "s"}. {Object.entries(layouts).map(([mode, columns]) => `${mode}: ${columns}`).join(" · ")}</p>}
		</div>
	);
}

function DebugRow({ name, value }: { name: string; value: string }) {
	return <div className="ed-row"><span className="ed-key">{name}</span><span className="ed-value">{value}</span></div>;
}

function SchedulerInspector({ snapshot, transitions }: { snapshot: EngineSchedulerDebugSnapshot; transitions: EngineSchedulerDebugTransition[] }) {
	return (
		<>
			<div className="ed-card"><DebugRow name="Frame pressure" value={snapshot.underFramePressure ? "ACTIVE" : "Normal"} /><DebugRow name="Tracked work" value={String(snapshot.tasks.length)} /></div>
			<h2 className="ed-section-title">Live work</h2>
			{snapshot.tasks.length === 0 ? <div className="ed-empty">No Engine work is mounted in this preview.</div> : snapshot.tasks.map((task) => (
				<div className="ed-card ed-task" key={task.id}><span className="ed-task-name">{task.label}</span><span className="ed-task-state"><span className="ed-chip">{task.state}</span><br /><span className="ed-chip">{task.activity}</span></span></div>
			))}
			<h2 className="ed-section-title">State transitions</h2>
			{transitions.length === 0 ? <div className="ed-empty">Transitions appear here as work enters or leaves the viewport.</div> : transitions.map((transition, index) => <div className="ed-transition" key={`${transition.id}-${transition.at}-${index}`}>{transition.label}<br />{transition.from} → {transition.to}</div>)}
		</>
	);
}

function DeviceInspector({ device, layouts, selectedNode, changeMode, updateDevice }: { device: DeviceProfile; layouts: Record<string, number>; selectedNode: DebugNode | null; changeMode: (mode: DeviceMode) => void; updateDevice: <Key extends keyof DeviceProfile>(key: Key, value: DeviceProfile[Key]) => void }) {
	return (
		<>
			<div className="ed-mode-grid">{(["Desktop", "Tablet", "Phone", "Custom"] as const).map((mode) => <button key={mode} type="button" className="ed-mode" aria-pressed={device.mode === mode} onClick={() => changeMode(mode)}>{mode}</button>)}</div>
			<div className="ed-fields">
				<NumberField label="Viewport width" value={device.width} min={240} max={3840} onChange={(value) => updateDevice("width", value)} />
				<NumberField label="Viewport height" value={device.height} min={240} max={2160} onChange={(value) => updateDevice("height", value)} />
				<NumberField label="DPR" value={device.dpr} min={0.5} max={4} step={0.25} onChange={(value) => updateDevice("dpr", value)} />
				<NumberField label="Refresh Hz" value={device.refresh} min={24} max={360} onChange={(value) => updateDevice("refresh", value)} />
				<label className="ed-field">Orientation<select value={device.orientation} onChange={(event) => updateDevice("orientation", event.target.value as DeviceProfile["orientation"])}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
			</div>
			<div className="ed-card" style={{ marginTop: 10 }}>
				<label className="ed-check"><input type="checkbox" checked={device.touch} onChange={(event) => updateDevice("touch", event.target.checked)} />Touch input</label>
				<label className="ed-check"><input type="checkbox" checked={device.hover} onChange={(event) => updateDevice("hover", event.target.checked)} />Hover input</label>
				<label className="ed-check"><input type="checkbox" checked={device.visualViewport} onChange={(event) => updateDevice("visualViewport", event.target.checked)} />VisualViewport</label>
			</div>
			<div className="ed-card ed-explain">
				<h3>Why did layout change?</h3>
				{selectedNode?.columns !== undefined ? <><p>{selectedNode.name} now has {selectedNode.columns} columns at {device.width}px.</p><p>{Object.entries(layouts).map(([mode, columns]) => `${mode}: ${columns} columns`).join(" · ") || "Switch profiles to compare compiled responsive output."}</p><p>Columns change when the available viewport can no longer satisfy the grid’s responsive sizing rules.</p></> : <p>Pick an EngineGrid to compare its real computed columns across Desktop, Tablet, Phone, and Custom profiles.</p>}
			</div>
			<p className="ed-explain"><span className="ed-warning">Simulator scope:</span> viewport size is native to the iframe. DPR, refresh target, touch, hover, orientation, and VisualViewport availability are exposed through the isolated debug bridge and matching media queries; physical monitor refresh cannot be changed by a webpage.</p>
		</>
	);
}

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
	return <label className="ed-field">{label}<input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(clampNumber(Number(event.target.value), min, max))} /></label>;
}
