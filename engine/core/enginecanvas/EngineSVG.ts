// ============================================================================
// EngineSVG.ts — DOM-backed SVG rendering engine
// ============================================================================
//
//  Primary purpose: high-quality SVG import/export and editing. Unlike
//  Engine2D (canvas pixels) and Engine3D (WebGL), EngineSVG renders directly
//  into DOM <svg> nodes — giving crisp output at any zoom level and the
//  ability to inspect/edit individual <path> elements after render.
//
//  As a RenderingEngine it still conforms to init/render/resize/dispose so
//  it can be selected the same way as Engine2D/Engine3D, but its "canvas"
//  is really an <svg> element injected next to (not replacing) the actual
//  <canvas> the runtime created — EC's canvas stays as the layout anchor.
// ============================================================================

import type { ECGroup, ECMesh, ECNode, ECScene, ECVector2 } from "./ECTypes";
import { ecPath } from "./ECGraphicsModel";
import type { ECRenderContext, RenderingEngine } from "./RenderingEngine";

export class EngineSVGEngine implements RenderingEngine {

	public readonly name = "svg";

	private svg:       SVGSVGElement | null = null;
	private container: HTMLElement | null = null;
	private width  = 0;
	private height = 0;

	// -------------------------------------------------------------------------

	public init(context: ECRenderContext): void {

		if (typeof document === "undefined") return; // SSR guard

		this.width  = context.width;
		this.height = context.height;

		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("width",  String(this.width));
		svg.setAttribute("height", String(this.height));
		svg.setAttribute("viewBox", `${-this.width / 2} ${-this.height / 2} ${this.width} ${this.height}`);
		svg.style.position = "absolute";
		svg.style.inset    = "0";
		svg.style.pointerEvents = "none";

		context.canvas.parentElement?.appendChild(svg);
		context.canvas.style.display = "none"; // SVG mode doesn't paint the canvas

		this.svg       = svg;
		this.container = context.canvas.parentElement;

	}

	// -------------------------------------------------------------------------

	public resize(width: number, height: number): void {

		this.width  = width;
		this.height = height;

		if (this.svg) {
			this.svg.setAttribute("width",  String(width));
			this.svg.setAttribute("height", String(height));
			this.svg.setAttribute("viewBox", `${-width / 2} ${-height / 2} ${width} ${height}`);
		}

	}

	// -------------------------------------------------------------------------

	public render(scene: ECScene, _delta: number, _frame: number): void {

		const svg = this.svg;
		if (!svg) return;

		while (svg.firstChild) svg.removeChild(svg.firstChild);

		if (scene.environment === "void") {
			// no background rect — transparent infinite space
		} else if (scene.background) {
			const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
			bg.setAttribute("x", String(-this.width / 2));
			bg.setAttribute("y", String(-this.height / 2));
			bg.setAttribute("width",  String(this.width));
			bg.setAttribute("height", String(this.height));
			bg.setAttribute("fill", scene.background);
			svg.appendChild(bg);
		}

		for (const node of scene.children) {
			const el = this.buildNode(node);
			if (el) svg.appendChild(el);
		}

	}

	// -------------------------------------------------------------------------

	private buildNode(node: ECNode): SVGElement | null {
		if (node.type === "group") return this.buildGroup(node);
		return this.buildMesh(node);
	}

	private buildGroup(group: ECGroup): SVGGElement {

		const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
		const t = group.transform;

		g.setAttribute(
			"transform",
			`translate(${t.position.x} ${t.position.y}) rotate(${t.rotation.z}) scale(${t.scale.x} ${t.scale.y})`,
		);

		for (const child of group.children) {
			const el = this.buildNode(child);
			if (el) g.appendChild(el);
		}

		return g;

	}

	private buildMesh(mesh: ECMesh): SVGPathElement {

		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
		const t    = mesh.transform;

		let d = "";
		for (let i = 0; i < mesh.vertices.length; i += 3) {
			const x = mesh.vertices[i], y = mesh.vertices[i + 1];
			d += (i === 0 ? "M" : "L") + x + "," + y + " ";
		}
		if (mesh.topology === "fan") d += "Z";

		path.setAttribute("d", d.trim());
		path.setAttribute(
			"transform",
			`translate(${t.position.x} ${t.position.y}) rotate(${t.rotation.z}) scale(${t.scale.x} ${t.scale.y})`,
		);

		const mat = mesh.material;
		path.setAttribute("fill",         mat.fill   ?? "none");
		path.setAttribute("stroke",       mat.stroke ?? "none");
		path.setAttribute("stroke-width", String(mat.strokeWidth ?? 1));
		path.setAttribute("opacity",      String(mat.opacity ?? 1));

		return path;

	}

	// -------------------------------------------------------------------------

	public dispose(): void {

		this.svg?.remove();
		this.svg = null;

	}

}

// ============================================================================
// Import / Export utilities — usable standalone, without the render pipeline
// ============================================================================

/**
 * Parses an SVG source string into ECMesh nodes — one per <path>, <circle>,
 * <rect>, <line>, or <polygon> found. Groups (<g>) are flattened; nested
 * transforms are not currently composed (planned for a future revision).
 */
export function importSVG(svgSource: string): ECNode[] {

	if (typeof DOMParser === "undefined") {
		throw new Error("[EngineSVG] importSVG() is browser-only (requires DOMParser).");
	}

	const doc = new DOMParser().parseFromString(svgSource, "image/svg+xml");
	const nodes: ECNode[] = [];

	doc.querySelectorAll("path, circle, rect, line, polygon").forEach((el) => {

		if (el.tagName === "path") {
			const d = el.getAttribute("d");
			if (d) nodes.push(ecPath(d, { material: readMaterial(el) }));
			return;
		}

		if (el.tagName === "circle") {
			const cx = parseFloat(el.getAttribute("cx") ?? "0");
			const cy = parseFloat(el.getAttribute("cy") ?? "0");
			const r  = parseFloat(el.getAttribute("r")  ?? "0");
			nodes.push(
				ecPath(circlePoints(cx, cy, r), { material: readMaterial(el) }),
			);
			return;
		}

		if (el.tagName === "polygon" || el.tagName === "line") {
			const pointsAttr = el.getAttribute("points") ?? "";
			const points = pointsAttr
				.trim()
				.split(/\s+/)
				.map((pair) => {
					const [x, y] = pair.split(",").map(Number);
					return { x, y };
				});
			nodes.push(ecPath(points, { material: readMaterial(el) }));
			return;
		}

		if (el.tagName === "rect") {
			const x = parseFloat(el.getAttribute("x") ?? "0");
			const y = parseFloat(el.getAttribute("y") ?? "0");
			const w = parseFloat(el.getAttribute("width")  ?? "0");
			const h = parseFloat(el.getAttribute("height") ?? "0");
			nodes.push(
				ecPath(
					[
						{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y },
					],
					{ material: readMaterial(el) },
				),
			);
		}

	});

	return nodes;

}

function circlePoints(cx: number, cy: number, r: number, segments = 32): ECVector2[] {
	const pts: ECVector2[] = [];
	for (let i = 0; i <= segments; i++) {
		const a = (i / segments) * Math.PI * 2;
		pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
	}
	return pts;
}

function readMaterial(el: Element) {
	return {
		fill:        el.getAttribute("fill")        ?? undefined,
		stroke:      el.getAttribute("stroke")       ?? undefined,
		strokeWidth: el.getAttribute("stroke-width") ? parseFloat(el.getAttribute("stroke-width")!) : undefined,
		opacity:     el.getAttribute("opacity")      ? parseFloat(el.getAttribute("opacity")!)      : undefined,
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
		const t = node.transform;
		const inner = node.children.map(nodeToSVGString).join("\n");
		return (
			`<g transform="translate(${t.position.x} ${t.position.y}) ` +
			`rotate(${t.rotation.z}) scale(${t.scale.x} ${t.scale.y})">\n${inner}\n</g>`
		);
	}

	let d = "";
	for (let i = 0; i < node.vertices.length; i += 3) {
		const x = node.vertices[i], y = node.vertices[i + 1];
		d += (i === 0 ? "M" : "L") + x + "," + y + " ";
	}
	if (node.topology === "fan") d += "Z";

	const mat = node.material;

	return (
		`<path d="${d.trim()}" fill="${mat.fill ?? "none"}" stroke="${mat.stroke ?? "none"}" ` +
		`stroke-width="${mat.strokeWidth ?? 1}" opacity="${mat.opacity ?? 1}" />`
	);

}
