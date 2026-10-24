"use strict";

const fs = require("node:fs");
const { parentPort } = require("node:worker_threads");
const ts = require("typescript");

function installTypeScriptRequireHook() {
	if (require.extensions[".ts"] && require.extensions[".ts"].__engineNencWorkerHook) return;
	const handler = function engineNencWorkerTypeScriptHook(module, filename) {
		const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
			compilerOptions: {
				module: ts.ModuleKind.CommonJS,
				target: ts.ScriptTarget.ES2022,
				esModuleInterop: true,
			},
			fileName: filename,
		}).outputText;
		module._compile(output, filename);
	};
	handler.__engineNencWorkerHook = true;
	require.extensions[".ts"] = handler;
}

const FUNCTION_PLACEHOLDER = "$nencWorkerFunctionPlaceholder";

function reviveWorkerValue(value) {
	if (Array.isArray(value)) return value.map(reviveWorkerValue);
	if (!value || typeof value !== "object") return value;
	if (value[FUNCTION_PLACEHOLDER] === true && Object.keys(value).length === 1) {
		return function engineBuildFunctionPlaceholder() {};
	}
	const result = {};
	for (const [key, entry] of Object.entries(value)) result[key] = reviveWorkerValue(entry);
	return result;
}

function isSchemaNode(value) {
	return value != null && typeof value === "object" && !Array.isArray(value)
		&& typeof value.type === "string";
}

function countSchemaNodes(node) {
	if (!node || typeof node !== "object") return 0;
	let count = 1;
	if (node.type === "slot") {
		if (isSchemaNode(node.props && node.props.fallback)) count += countSchemaNodes(node.props.fallback);
	} else if (Array.isArray(node.children)) {
		for (const child of node.children) count += countSchemaNodes(child);
	}
	return count;
}

function walkNodes(node, visit) {
	if (!node || typeof node !== "object") return;
	if (typeof node.type === "string") visit(node);
	if (Array.isArray(node.children)) for (const child of node.children) walkNodes(child, visit);
}

function buildPageRecord(plan, sourcePath) {
	const custom = new Set();
	const compiledNodes = [];
	walkNodes(plan.root, (node) => {
		if (node.customComponent || !BUILTIN_NODE_TYPES.has(String(node.type))) custom.add(String(node.type));
		compiledNodes.push({
			id: node.id,
			path: node.path,
			type: String(node.type),
			...(node.name ? { name: node.name } : {}),
			depth: node.depth,
			runtime: node.runtime,
			runtimeReason: node.runtimeReason,
			workClass: node.workClass,
			workReason: node.workReason,
			capabilities: [...node.capabilities],
			heavy: node.heavy,
			interactive: node.interactive,
			customComponent: Boolean(node.customComponent),
			children: node.children.map((child) => child.id),
			assets: node.assets.map(({ kind, workClass, priority }) => ({ kind, workClass, priority })),
		});
	});
	return {
		id: plan.id,
		sourcePath,
		summary: plan.summary,
		compiledNodes,
		customComponents: [...custom].sort(),
		assets: plan.assets.map(({ kind, workClass, priority }) => ({ kind, workClass, priority })),
		capabilities: [...plan.capabilities].sort(),
		fallbackFeatures: plan.fallbackPlan.features.map(({ feature, importance, strategies }) => ({
			feature,
			importance,
			strategies: strategies.map(({ id, kind, fidelity }) => ({ id, kind, fidelity })),
		})),
		diagnostics: plan.diagnostics.map(({ level, code, message, path: nodePath }) => ({
			level,
			code,
			message,
			...(nodePath ? { path: nodePath } : {}),
		})),
	};
}

const BUILTIN_NODE_TYPES = new Set([
	"box", "stack", "grid", "text", "heading", "markdown", "image", "video",
	"section", "hero", "card", "button", "link", "nav", "manim", "manim3d",
	"spacer", "divider", "slot", "canvas", "scroll", "custom-select", "suspense",
	"option", "optgroup", "dialog", "drawer", "popover", "form", "input",
	"textarea", "checkbox", "label", "EngineLink", "EngineNav", "EngineManim",
	"EngineManim3D", "EngineDialog", "EngineDrawer", "EnginePopover",
]);

installTypeScriptRequireHook();
const { compilePage } = require("../compiler/EngineCompiler.ts");

parentPort.on("message", (message) => {
	if (!message || message.type !== "compile" || typeof message.taskId !== "string") return;
	const startedAt = Date.now();
	try {
		const schema = reviveWorkerValue(message.schema);
		const totalNodes = Math.max(1, countSchemaNodes(schema.root));
		let completedNodes = 0;
		let lastReportedPercent = -1;
		parentPort.postMessage({
			type: "progress",
			taskId: message.taskId,
			completedNodes: 0,
			totalNodes,
			progress: 0,
		});
		const plan = compilePage(schema, {
			pageId: message.pageId,
			sourcePath: message.sourcePath,
			customComponentTypes: message.customComponentTypes || [],
			onProgress(event) {
				if (event.phase === "node") {
					completedNodes += 1;
					const progress = Math.min(100, (completedNodes / totalNodes) * 100);
					const roundedPercent = Math.round(progress);
					if (roundedPercent !== lastReportedPercent || event.customComponent) {
						lastReportedPercent = roundedPercent;
						parentPort.postMessage({
							type: "progress",
							taskId: message.taskId,
							completedNodes,
							totalNodes,
							progress,
							nodeType: String(event.nodeType || "unknown"),
							nodePath: event.nodePath || "root",
							customComponent: Boolean(event.customComponent),
						});
					}
				} else if (event.phase === "page-cache-hit") {
					completedNodes = totalNodes;
					lastReportedPercent = 100;
					parentPort.postMessage({
						type: "progress",
						taskId: message.taskId,
						completedNodes,
						totalNodes,
						progress: 100,
						cacheHit: true,
					});
				}
			},
		});
		const page = buildPageRecord(plan, message.sourcePath);
		parentPort.postMessage({
			type: "result",
			taskId: message.taskId,
			page,
			durationMs: Date.now() - startedAt,
			nodeCount: plan.summary.totalNodes,
			cacheHit: completedNodes === totalNodes && lastReportedPercent === 100 && plan.summary.totalNodes === 0,
		});
	} catch (error) {
		parentPort.postMessage({
			type: "error",
			taskId: message.taskId,
			error: {
				name: error instanceof Error ? error.name : "Error",
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : "",
			},
		});
	}
});
