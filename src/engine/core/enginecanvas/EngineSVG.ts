// ============================================================================
// EngineSVG.ts — DOM-backed SVG rendering engine
// ============================================================================
//
// Retained-mode SVG renderer. DOM nodes are created once per EC node id and
// then updated in place, avoiding full subtree destruction/recreation every RAF.
// ============================================================================

import type { ECGroup, ECMesh, ECNode, ECScene, ECVector2 } from "./ECTypes";
import { ecPath } from "./ECGraphicsModel";
import type { ECRenderContext, RenderingEngine } from "./RenderingEngine";

interface RetainedSVGNode {
	type: ECNode["type"];
	element: SVGElement;
	vertices?: Float32Array;
	topology?: ECMesh["topology"];
}

export class EngineSVGEngine implements RenderingEngine {
	public readonly name = "svg";

	private svg: SVGSVGElement | null = null;
	private canvas: HTMLCanvasElement | null = null;
	private previousCanvasDisplay = "";
	private backgroundRect: SVGRectElement | null = null;
	private readonly retainedNodes = new Map<string, RetainedSVGNode>();
	private width = 0;
	private height = 0;

	// -------------------------------------------------------------------------

	public init(context: ECRenderContext): void {
		if (typeof document === "undefined") return;

		this.width = context.width;
		this.height = context.height;

		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("width", String(this.width));
		svg.setAttribute("height", String(this.height));
		svg.setAttribute("viewBox", `${-this.width / 2} ${-this.height / 2} ${this.width} ${this.height}`);
		svg.style.position = "absolute";
		svg.style.inset = "0";
		svg.style.pointerEvents = "none";

		context.canvas.parentElement?.appendChild(svg);
		this.canvas = context.canvas;
		this.previousCanvasDisplay = context.canvas.style.display;
		context.canvas.style.display = "none";
		this.svg = svg;
	}

	// -------------------------------------------------------------------------

	public resize(width: number, height: number): void {
		this.width = width;
		this.height = height;

		if (this.svg) {
			this.svg.setAttribute("width", String(width));
			this.svg.setAttribute("height", String(height));
			this.svg.setAttribute("viewBox", `${-width / 2} ${-height / 2} ${width} ${height}`);
		}
		this.updateBackgroundRect();
	}

	// -------------------------------------------------------------------------

	public render(scene: ECScene, _delta: number, _frame: number): void {
		const svg = this.svg;
		if (!svg) return;

		this.syncBackground(scene);

		const seenIds = new Set<string>();
		for (const node of scene.children) {
			this.syncNode(node, svg, seenIds);
		}
		this.removeMissingNodes(seenIds);
	}

	// -------------------------------------------------------------------------

	private syncBackground(scene: ECScene): void {
		const svg = this.svg;
		if (!svg) return;

		if (scene.environment === "void" || !scene.background) {
			this.backgroundRect?.remove();
			this.backgroundRect = null;
			return;
		}

		if (!this.backgroundRect) {
			this.backgroundRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
			this.backgroundRect.setAttribute("data-engine-svg-background", "true");
			svg.insertBefore(this.backgroundRect, svg.firstChild);
		}

		this.updateBackgroundRect();
		this.setAttribute(this.backgroundRect, "fill", scene.background);
	}

	private updateBackgroundRect(): void {
		if (!this.backgroundRect) return;
		this.setAttribute(this.backgroundRect, "x", String(-this.width / 2));
		this.setAttribute(this.backgroundRect, "y", String(-this.height / 2));
		this.setAttribute(this.backgroundRect, "width", String(this.width));
		this.setAttribute(this.backgroundRect, "height", String(this.height));
	}

	private syncNode(node: ECNode, parent: SVGElement, seenIds: Set<string>): SVGElement {
		seenIds.add(node.id);
		let retained = this.retainedNodes.get(node.id);

		if (retained && retained.type !== node.type) {
			retained.element.remove();
			this.retainedNodes.delete(node.id);
			retained = undefined;
		}

		if (node.type === "group") {
			return this.syncGroup(node, parent, retained, seenIds);
		}
		return this.syncMesh(node, parent, retained);
	}

	private syncGroup(
		group: ECGroup,
		parent: SVGElement,
		retained: RetainedSVGNode | undefined,
		seenIds: Set<string>,
	): SVGGElement {
		if (!retained) {
			const element = document.createElementNS("http://www.w3.org/2000/svg", "g");
			retained = { type: "group", element };
			this.retainedNodes.set(group.id, retained);
		}

		const element = retained.element as SVGGElement;
		this.attachToParent(element, parent);
		this.setAttribute(element, "transform", this.transformString(group.transform));

		for (const child of group.children) {
			this.syncNode(child, element, seenIds);
		}

		return element;
	}

	private syncMesh(
		mesh: ECMesh,
		parent: SVGElement,
		retained?: RetainedSVGNode,
	): SVGPathElement {
		if (!retained) {
			const element = document.createElementNS("http://www.w3.org/2000/svg", "path");
			retained = {
				type: "mesh",
				element,
			};
			this.retainedNodes.set(mesh.id, retained);
		}

		const path = retained.element as SVGPathElement;
		this.attachToParent(path, parent);

		if (retained.vertices !== mesh.vertices || retained.topology !== mesh.topology) {
			this.setAttribute(path, "d", this.pathData(mesh));
			retained.vertices = mesh.vertices;
			retained.topology = mesh.topology;
		}

		this.setAttribute(path, "transform", this.transformString(mesh.transform));
		this.setAttribute(path, "fill", mesh.topology === "strip" ? "none" : mesh.material.fill ?? "none");
		this.setAttribute(path, "stroke", mesh.material.stroke ?? "none");
		this.setAttribute(path, "stroke-width", String(mesh.material.strokeWidth ?? 1));
		this.setAttribute(path, "opacity", String(mesh.material.opacity ?? 1));
		return path;
	}

	private pathData(mesh: ECMesh): string {
		const segments: string[] = [];
		for (let index = 0; index < mesh.vertices.length; index += 3) {
			segments.push(`${index === 0 ? "M" : "L"}${mesh.vertices[index]},${mesh.vertices[index + 1]}`);
		}
		if (mesh.topology === "fan") segments.push("Z");
		return segments.join(" ");
	}

	private transformString(transform: ECGroup["transform"]): string {
		return `translate(${transform.position.x} ${transform.position.y}) rotate(${transform.rotation.z}) scale(${transform.scale.x} ${transform.scale.y})`;
	}

	private attachToParent(element: SVGElement, parent: SVGElement): void {
		if (element.parentElement === parent) return;
		parent.appendChild(element);
	}

	private setAttribute(element: Element, name: string, value: string): void {
		if (element.getAttribute(name) === value) return;
		element.setAttribute(name, value);
	}

	private removeMissingNodes(seenIds: Set<string>): void {
		for (const [nodeId, retained] of this.retainedNodes) {
			if (seenIds.has(nodeId)) continue;
			retained.element.remove();
			this.retainedNodes.delete(nodeId);
		}
	}

	// -------------------------------------------------------------------------

	public dispose(): void {
		this.retainedNodes.clear();
		this.backgroundRect = null;
		this.svg?.remove();
		this.svg = null;
		if (this.canvas) this.canvas.style.display = this.previousCanvasDisplay;
		this.canvas = null;
		this.previousCanvasDisplay = "";
	}
}

// ============================================================================
// Import / Export utilities — usable standalone, without the render pipeline
// ============================================================================

/**
 * Parses an SVG source string into ECMesh nodes — one per <path>, <circle>,
 * <rect>, <line>, or <polygon> found. Groups (<g>) are flattened; nested
 * transforms are not currently composed.
 */
export function importSVG(svgSource: string): ECNode[] {
	if (typeof DOMParser === "undefined") {
		throw new Error("[EngineSVG] importSVG() is browser-only (requires DOMParser).");
	}

	const documentNode = new DOMParser().parseFromString(svgSource, "image/svg+xml");
	const nodes: ECNode[] = [];

	documentNode.querySelectorAll("path, circle, rect, line, polygon").forEach((element) => {
		if (element.tagName === "path") {
			const pathData = element.getAttribute("d");
			if (pathData) nodes.push(ecPath(pathData, { material: readMaterial(element) }));
			return;
		}

		if (element.tagName === "circle") {
			const centerX = parseFloat(element.getAttribute("cx") ?? "0");
			const centerY = parseFloat(element.getAttribute("cy") ?? "0");
			const radius = parseFloat(element.getAttribute("r") ?? "0");
			nodes.push(ecPath(circlePoints(centerX, centerY, radius), { material: readMaterial(element) }));
			return;
		}

		if (element.tagName === "line") {
			const x1 = parseFloat(element.getAttribute("x1") ?? "0");
			const y1 = parseFloat(element.getAttribute("y1") ?? "0");
			const x2 = parseFloat(element.getAttribute("x2") ?? "0");
			const y2 = parseFloat(element.getAttribute("y2") ?? "0");
			nodes.push(ecPath([{ x: x1, y: y1 }, { x: x2, y: y2 }], { material: readMaterial(element) }));
			return;
		}

		if (element.tagName === "polygon") {
			const points = (element.getAttribute("points") ?? "")
				.trim()
				.split(/\s+/)
				.filter(Boolean)
				.map((pair) => {
					const [x, y] = pair.split(",").map(Number);
					return { x, y };
				});
			nodes.push(ecPath(points, { material: readMaterial(element) }));
			return;
		}

		if (element.tagName === "rect") {
			const x = parseFloat(element.getAttribute("x") ?? "0");
			const y = parseFloat(element.getAttribute("y") ?? "0");
			const width = parseFloat(element.getAttribute("width") ?? "0");
			const height = parseFloat(element.getAttribute("height") ?? "0");
			nodes.push(
				ecPath(
					[
						{ x, y },
						{ x: x + width, y },
						{ x: x + width, y: y + height },
						{ x, y: y + height },
						{ x, y },
					],
					{ material: readMaterial(element) },
				),
			);
		}
	});

	return nodes;
}

function circlePoints(centerX: number, centerY: number, radius: number, segments = 32): ECVector2[] {
	const points: ECVector2[] = [];
	for (let index = 0; index <= segments; index++) {
		const angle = (index / segments) * Math.PI * 2;
		points.push({
			x: centerX + Math.cos(angle) * radius,
			y: centerY + Math.sin(angle) * radius,
		});
	}
	return points;
}

function readMaterial(element: Element) {
	return {
		fill: element.getAttribute("fill") ?? undefined,
		stroke: element.getAttribute("stroke") ?? undefined,
		strokeWidth: element.getAttribute("stroke-width")
			? parseFloat(element.getAttribute("stroke-width")!)
			: undefined,
		opacity: element.getAttribute("opacity")
			? parseFloat(element.getAttribute("opacity")!)
			: undefined,
	};
}

/** Serializes an ECScene into a standalone SVG document string. */
export function exportSVG(scene: ECScene, width: number, height: number): string {
	const body = scene.children.map(nodeToSVGString).join("\n");
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
		`viewBox="${-width / 2} ${-height / 2} ${width} ${height}">\n${body}\n</svg>`
	);
}

function nodeToSVGString(node: ECNode): string {
	if (node.type === "group") {
		const transform = node.transform;
		const inner = node.children.map(nodeToSVGString).join("\n");
		return (
			`<g transform="translate(${transform.position.x} ${transform.position.y}) ` +
			`rotate(${transform.rotation.z}) scale(${transform.scale.x} ${transform.scale.y})">\n${inner}\n</g>`
		);
	}

	const pathSegments: string[] = [];
	for (let index = 0; index < node.vertices.length; index += 3) {
		pathSegments.push(`${index === 0 ? "M" : "L"}${node.vertices[index]},${node.vertices[index + 1]}`);
	}
	if (node.topology === "fan") pathSegments.push("Z");

	const material = node.material;
	const transform = node.transform;
	return (
		`<path d="${pathSegments.join(" ")}" fill="${node.topology === "strip" ? "none" : material.fill ?? "none"}" ` +
		`stroke="${material.stroke ?? "none"}" stroke-width="${material.strokeWidth ?? 1}" ` +
		`opacity="${material.opacity ?? 1}" transform="translate(${transform.position.x} ${transform.position.y}) ` +
		`rotate(${transform.rotation.z}) scale(${transform.scale.x} ${transform.scale.y})" />`
	);
}
