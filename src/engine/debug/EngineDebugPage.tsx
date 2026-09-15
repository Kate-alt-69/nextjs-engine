"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#070a12;color:#e5e7eb;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
button,input,select{font:inherit}.ed-shell{height:100vh;display:grid;grid-template-rows:56px minmax(0,1fr);overflow:hidden}.ed-head{display:flex;align-items:center;gap:14px;padding:0 18px;border-bottom:1px solid #20283a;background:#0b101c}.ed-head h1{font-size:16px;margin:0}.ed-badge{font:700 10px ui-monospace,monospace;color:#86efac;background:#12321f;border:1px solid #1d6c37;border-radius:999px;padding:4px 7px}.ed-body{min-height:0;display:grid;grid-template-columns:220px minmax(0,1fr) 340px}.ed-sidebar,.ed-inspector{min-height:0;overflow:auto;background:#0b101c}.ed-sidebar{border-right:1px solid #20283a;padding:14px}.ed-inspector{border-left:1px solid #20283a;padding:14px}.ed-section-title{margin:0 0 9px;color:#8b9ab5;font-size:11px;text-transform:uppercase;letter-spacing:.12em}.ed-route,.ed-button,.ed-mode{border:1px solid #29344a;background:#111827;color:#dbeafe;border-radius:8px;cursor:pointer}.ed-route{display:block;width:100%;padding:8px 10px;text-align:left;margin:4px 0;font:12px ui-monospace,monospace;overflow:hidden;text-overflow:ellipsis}.ed-route[aria-current="page"],.ed-button[aria-pressed="true"],.ed-mode[aria-pressed="true"]{border-color:#60a5fa;background:#172554;color:#bfdbfe}.ed-stage{min-width:0;min-height:0;display:grid;grid-template-rows:48px minmax(0,1fr);background:#111827}.ed-tools{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #263248}.ed-button,.ed-mode{padding:7px 10px;font-size:12px}.ed-spacer{flex:1}.ed-fps{font:11px ui-monospace,monospace;color:#93c5fd}.ed-viewport-scroll{overflow:auto;padding:18px;display:grid;place-items:start center;background-color:#0f172a;background-image:linear-gradient(45deg,#182338 25%,transparent 25%),linear-gradient(-45deg,#182338 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#182338 75%),linear-gradient(-45deg,transparent 75%,#182338 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0}.ed-frame-shell{flex:none;background:white;border-radius:8px;overflow:hidden;box-shadow:0 24px 70px #0008;border:1px solid #334155}.ed-frame{display:block;width:100%;height:100%;border:0;background:white}.ed-tabs{display:flex;gap:6px;margin-bottom:14px;position:sticky;top:-14px;padding:14px 0 8px;background:#0b101c;z-index:2}.ed-card{border:1px solid #253148;background:#0f1626;border-radius:10px;padding:11px;margin-bottom:10px}.ed-card h3{font-size:13px;margin:0 0 8px}.ed-row{display:grid;grid-template-columns:88px 1fr;gap:8px;padding:4px 0;font-size:12px}.ed-key{color:#8190aa}.ed-value{color:#e5e7eb;overflow-wrap:anywhere}.ed-chip{display:inline-block;padding:3px 6px;margin:2px;border-radius:5px;background:#1e293b;color:#cbd5e1;font:700 10px ui-monospace,monospace}.ed-task{display:flex;gap:8px;align-items:flex-start;justify-content:space-between}.ed-task-name{font-size:12px;font-weight:650}.ed-task-state{text-align:right;white-space:nowrap}.ed-transition{font:10px/1.5 ui-monospace,monospace;color:#94a3b8;border-left:2px solid #334155;padding-left:8px;margin:7px 0}.ed-mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.ed-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.ed-field{display:grid;gap:4px;color:#94a3b8;font-size:11px}.ed-field input,.ed-field select{width:100%;border:1px solid #334155;border-radius:6px;background:#0b1220;color:#e5e7eb;padding:6px}.ed-check{display:flex;gap:7px;align-items:center;font-size:12px;color:#cbd5e1}.ed-empty{padding:20px 8px;color:#71809a;text-align:center;font-size:12px}.ed-explain{font-size:12px;line-height:1.55;color:#cbd5e1}.ed-warning{color:#fbbf24}.ed-count{margin-left:auto;color:#64748b;font:10px ui-monospace,monospace}@media(max-width:1050px){.ed-body{grid-template-columns:180px minmax(0,1fr)}.ed-inspector{position:fixed;right:0;top:56px;bottom:0;width:340px;box-shadow:-20px 0 50px #0008;z-index:3}}
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
	const previousTasks = useRef(new Map<string, EngineSchedulerDebugTask>());
	const [selectedPage, setSelectedPage] = useState(pages[0] ?? "/");
	const [picker, setPicker] = useState(false);
	const [overlay, setOverlay] = useState(false);
	const [tab, setTab] = useState<"Node" | "Scheduler" | "Device">("Node");
	const [selectedNode, setSelectedNode] = useState<DebugNode | null>(null);
	const [scheduler, setScheduler] = useState<EngineSchedulerDebugSnapshot>(EMPTY_SCHEDULER);
	const [inferredTransitions, setInferredTransitions] = useState<EngineSchedulerDebugTransition[]>([]);
	const [device, setDevice] = useState<DeviceProfile>(DEVICE_PROFILES.Desktop);
	const [fps, setFps] = useState(0);
	const [layoutByDevice, setLayoutByDevice] = useState<Record<string, number>>({});
	const frameSource = useMemo(() => `${selectedPage}${selectedPage.includes("?") ? "&" : "?"}__engine_debug=1`, [selectedPage]);

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
				frameDocument.removeEventListener("click", selectNode, true);
				frameWindow.removeEventListener("engine:debug:scheduler", updateScheduler);
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
				<h1>Next.js Engine Debug</h1>
				<span className="ed-badge">DEV ONLY</span>
				<span className="ed-count">/_engine/debug · D.5–D.10</span>
			</header>
			<div className="ed-body">
				<nav className="ed-sidebar" aria-label="Application pages">
					<h2 className="ed-section-title">Page explorer</h2>
					{pages.map((route) => (
						<button key={route} type="button" className="ed-route" data-route={route} aria-current={selectedPage === route ? "page" : undefined} onClick={() => { setSelectedPage(route); setSelectedNode(null); }}>
							{route}
						</button>
					))}
				</nav>
				<section className="ed-stage" aria-label="Live page preview">
					<div className="ed-tools">
						<button type="button" className="ed-button" aria-pressed={picker} onClick={() => setPicker((value) => !value)}>Pick node</button>
						<button type="button" className="ed-button" aria-pressed={overlay} onClick={() => setOverlay((value) => !value)}>Runtime boundaries</button>
						<span className="ed-spacer" />
						<span className="ed-fps">{device.width}×{device.height} · DPR {device.dpr} · {fps.toFixed(1)} FPS</span>
					</div>
					<div className="ed-viewport-scroll">
						<div className="ed-frame-shell" style={{ width: device.width, height: device.height }}>
							<iframe ref={iframeRef} className="ed-frame" title={`Live preview: ${selectedPage}`} src={frameSource} />
						</div>
					</div>
				</section>
				<aside className="ed-inspector">
					<div className="ed-tabs" role="tablist" aria-label="Debug inspectors">
						{(["Node", "Scheduler", "Device"] as const).map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} className="ed-button" aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</button>)}
					</div>
					{tab === "Node" && (
						selectedNode ? <NodeInspector node={selectedNode} task={selectedTask} fps={fps} refresh={device.refresh} layouts={layoutByDevice} /> : <div className="ed-empty">Enable “Pick node,” then click an Engine element in the preview.</div>
					)}
					{tab === "Scheduler" && <SchedulerInspector snapshot={scheduler} transitions={transitions} />}
					{tab === "Device" && <DeviceInspector device={device} layouts={layoutByDevice} selectedNode={selectedNode} changeMode={changeMode} updateDevice={updateDevice} />}
				</aside>
			</div>
		</main>
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
