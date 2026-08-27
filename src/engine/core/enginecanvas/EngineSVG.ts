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

interface MeshPathData {
	fill: string;
	stroke: string;
}

interface RetainedSVGNode {
	type: ECNode["type"];
	element: SVGElement;
	fillPath?: SVGPathElement;
	strokePath?: SVGPathElement;
	vertices?: Float32Array;
	indices?: Uint16Array | Uint32Array;
	topology?: ECMesh["topology"];
}

function vertexPoint(mesh: ECMesh, vertexIndex: number): string {
	return `${mesh.vertices[vertexIndex * 3]},${mesh.vertices[vertexIndex * 3 + 1]}`;
}

function triangleIndices(mesh: ECMesh): number[] {
	const triangles: number[] = [];
	const vertexCount = Math.floor(mesh.vertices.length / 3);

	if (mesh.indices && mesh.indices.length >= 3 && mesh.topology !== "strip") {
		for (let index = 0; index + 2 < mesh.indices.length; index += 3) {
			triangles.push(mesh.indices[index], mesh.indices[index + 1], mesh.indices[index + 2]);
		}
		return triangles;
	}

	if (mesh.topology === "fan") {
		for (let vertex = 1; vertex + 1 < vertexCount; vertex++) {
			triangles.push(0, vertex, vertex + 1);
		}
		return triangles;
	}

	if (mesh.topology === "triangles") {
		for (let vertex = 0; vertex + 2 < vertexCount; vertex += 3) {
			triangles.push(vertex, vertex + 1, vertex + 2);
		}
	}

	return triangles;
}

function stripPathData(mesh: ECMesh): string {
	const count = mesh.indices?.length ?? Math.floor(mesh.vertices.length / 3);
	const segments: string[] = [];
	for (let position = 0; position < count; position++) {
		const vertexIndex = mesh.indices ? mesh.indices[position] : position;
		segments.push(`${position === 0 ? "M" : "L"}${vertexPoint(mesh, vertexIndex)}`);
	}
	return segments.join(" ");
}

function triangleFillPathData(mesh: ECMesh, triangles: number[]): string {
	const segments: string[] = [];
	for (let index = 0; index + 2 < triangles.length; index += 3) {
		segments.push(
			`M${vertexPoint(mesh, triangles[index])}`,
			`L${vertexPoint(mesh, triangles[index + 1])}`,
			`L${vertexPoint(mesh, triangles[index + 2])}`,
			"Z",
		);
	}
	return segments.join(" ");
}

function boundaryPathData(mesh: ECMesh, triangles: number[]): string {
	const edgeCounts = new Map<string, { count: number; a: number; b: number }>();
	const recordEdge = (a: number, b: number): void => {
		const low = Math.min(a, b);
		const high = Math.max(a, b);
		const key = `${low}:${high}`;
		const existing = edgeCounts.get(key);
		if (existing) {
			existing.count++;
			return;
		}
		edgeCounts.set(key, { count: 1, a, b });
	};

	for (let index = 0; index + 2 < triangles.length; index += 3) {
		const a = triangles[index];
		const b = triangles[index + 1];
		const c = triangles[index + 2];
		recordEdge(a, b);
		recordEdge(b, c);
		recordEdge(c, a);
	}

	const segments: string[] = [];
	for (const edge of edgeCounts.values()) {
		if (edge.count !== 1) continue;
		segments.push(`M${vertexPoint(mesh, edge.a)}`, `L${vertexPoint(mesh, edge.b)}`);
	}
	return segments.join(" ");
}

function meshPathData(mesh: ECMesh): MeshPathData {
	if (mesh.topology === "strip") {
		return { fill: "", stroke: stripPathData(mesh) };
	}
	const triangles = triangleIndices(mesh);
	return {
		fill: triangleFillPathData(mesh, triangles),
		stroke: boundaryPathData(mesh, triangles),
	};
}

function escapeXMLAttribute(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
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
	): SVGGElement {
		if (!retained) {
			const element = document.createElementNS("http://www.w3.org/2000/svg", "g");
			const fillPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
			const strokePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
			fillPath.setAttribute("data-engine-svg-fill", "true");
			strokePath.setAttribute("data-engine-svg-stroke", "true");
			element.append(fillPath, strokePath);
			retained = { type: "mesh", element, fillPath, strokePath };
			this.retainedNodes.set(mesh.id, retained);
		}

		const element = retained.element as SVGGElement;
		const fillPath = retained.fillPath!;
		const strokePath = retained.strokePath!;
		this.attachToParent(element, parent);

		if (
			retained.vertices !== mesh.vertices
			|| retained.indices !== mesh.indices
			|| retained.topology !== mesh.topology
		) {
			const geometry = meshPathData(mesh);
			this.setAttribute(fillPath, "d", geometry.fill);
			this.setAttribute(strokePath, "d", geometry.stroke);
			retained.vertices = mesh.vertices;
			retained.indices = mesh.indices;
			retained.topology = mesh.topology;
		}

		this.setAttribute(element, "transform", this.transformString(mesh.transform));
		this.setAttribute(element, "opacity", String(mesh.material.opacity ?? 1));
		this.setAttribute(fillPath, "fill", mesh.topology === "strip" ? "none" : mesh.material.fill ?? "none");
		this.setAttribute(fillPath, "stroke", "none");
		this.setAttribute(strokePath, "fill", "none");
		this.setAttribute(
			strokePath,
			"stroke",
			mesh.topology === "strip"
				? mesh.material.stroke ?? mesh.material.fill ?? "none"
				: mesh.material.stroke ?? "none",
		);
		this.setAttribute(strokePath, "stroke-width", String(mesh.material.strokeWidth ?? 1));
		return element;
	}

	private transformString(transform: ECGroup["transform"]): string {
		return `translate(${transform.position.x} ${transform.position.y}) rotate(${transform.rotation.z}) scale(${transform.scale.x} ${transform.scale.y})`;
	}

	private attachToParent(element: SVGElement, parent: SVGElement): void {
		if (element.parentNode === parent) return;
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

export function exportSVG(scene: ECScene, width: number, height: number): string {
	const background = scene.environment !== "void" && scene.background
		? `\n<rect x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" fill="${escapeXMLAttribute(scene.background)}" />`
		: "";
	const body = scene.children.map(nodeToSVGString).join("\n");
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
		`viewBox="${-width / 2} ${-height / 2} ${width} ${height}">${background}\n${body}\n</svg>`
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

	const geometry = meshPathData(node);
	const material = node.material;
	const transform = node.transform;
	const transformValue = `translate(${transform.position.x} ${transform.position.y}) rotate(${transform.rotation.z}) scale(${transform.scale.x} ${transform.scale.y})`;
	const fill = node.topology === "strip" ? "none" : escapeXMLAttribute(material.fill ?? "none");
	const stroke = node.topology === "strip"
		? escapeXMLAttribute(material.stroke ?? material.fill ?? "none")
		: escapeXMLAttribute(material.stroke ?? "none");
	const opacity = material.opacity ?? 1;
	const strokeWidth = material.strokeWidth ?? 1;

	return (
		`<g transform="${transformValue}" opacity="${opacity}">` +
		`<path d="${geometry.fill}" fill="${fill}" stroke="none" />` +
		`<path d="${geometry.stroke}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" />` +
		`</g>`
	);
}
