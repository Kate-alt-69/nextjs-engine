// ─────────────────────────────────────────────────────────────────────────────
//  Engine — manimCompiler
//
//  Translates ManimConfig JSON into pre-allocated Float32Array geometry pools.
//  Zero heap allocation inside the RAF loop — all buffers are pre-sized once.
//
//  Circle approximation:  4 cubic Bezier arcs (KAPPA = 0.5522847498)
//  Square / Rectangle:    4 corner points as line segments
//  Path:                  parsed SVG command subset (M L C Q Z)
// ─────────────────────────────────────────────────────────────────────────────

import type {
	ManimConfig,
	ManimMobject,
	ManimEasing,
	CompiledMobject,
	CompiledTimelineStep,
	CompiledManimTimeline,
} from "./manimTypes";

// ── Easing ────────────────────────────────────────────────────────────────────

export function applyEasing(t: number, easing: ManimEasing): number {
	const c = Math.max(0, Math.min(1, t));
	switch (easing) {
		case "ease-in":      return c * c * c;
		case "ease-out":     return 1 - Math.pow(1 - c, 3);
		case "ease-in-out":  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
		case "bounce":       return _bounce(c);
		case "elastic":      return _elastic(c);
		default:             return c;
	}
}

function _bounce(t: number): number {
	const n = 7.5625;
	const d = 2.75;
	if (t < 1 / d)       return n * t * t;
	if (t < 2 / d)       return n * (t -= 1.5 / d) * t + 0.75;
	if (t < 2.5 / d)     return n * (t -= 2.25 / d) * t + 0.9375;
	return n * (t -= 2.625 / d) * t + 0.984375;
}

function _elastic(t: number): number {
	if (t === 0 || t === 1) return t;
	const p = 0.3;
	const s = p / 4;
	return Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / p) + 1;
}

// ── Shape vectorizers ─────────────────────────────────────────────────────────

// Circle bezier magic constant — approximates arc with cubic Bezier curves
const KAPPA = 0.5522847498;

/**
 * Returns a Float32Array of [x,y] interleaved control points for 4 cubic
 * Bezier arcs that approximate a circle. 13 points × 2 floats = 26 values.
 * Layout: [start, cp1, cp2, end] repeated 4 times (12 + shared start = 13).
 */
function circleToPoints(cx: number, cy: number, r: number): Float32Array {
	const k   = r * KAPPA;
	const buf = new Float32Array(26); // 13 points
	let   i   = 0;

	// Top → Right → Bottom → Left → Top
	const set = (x: number, y: number) => { buf[i++] = cx + x; buf[i++] = cy + y; };
	set(0, -r);          // start (top)
	set(k, -r);          // arc 1 cp1
	set(r, -k);          // arc 1 cp2
	set(r, 0);           // right
	set(r, k);           // arc 2 cp1
	set(k, r);           // arc 2 cp2
	set(0, r);           // bottom
	set(-k, r);          // arc 3 cp1
	set(-r, k);          // arc 3 cp2
	set(-r, 0);          // left
	set(-r, -k);         // arc 4 cp1
	set(-k, -r);         // arc 4 cp2
	set(0, -r);          // back to top (closed)

	return buf;
}

/** Square as 5 corner points (closed). */
function squareToPoints(cx: number, cy: number, side: number): Float32Array {
	const h   = side / 2;
	const buf = new Float32Array(10);
	buf[0]  = cx - h; buf[1]  = cy - h;
	buf[2]  = cx + h; buf[3]  = cy - h;
	buf[4]  = cx + h; buf[5]  = cy + h;
	buf[6]  = cx - h; buf[7]  = cy + h;
	buf[8]  = cx - h; buf[9]  = cy - h; // closed
	return buf;
}

/** Rectangle as 5 corner points (closed). */
function rectToPoints(cx: number, cy: number, w: number, h: number): Float32Array {
	const hw  = w / 2;
	const hh  = h / 2;
	const buf = new Float32Array(10);
	buf[0]  = cx - hw; buf[1]  = cy - hh;
	buf[2]  = cx + hw; buf[3]  = cy - hh;
	buf[4]  = cx + hw; buf[5]  = cy + hh;
	buf[6]  = cx - hw; buf[7]  = cy + hh;
	buf[8]  = cx - hw; buf[9]  = cy - hh;
	return buf;
}

/** Line as 2 points. */
function lineToPoints(x1: number, y1: number, x2: number, y2: number): Float32Array {
	const buf = new Float32Array(4);
	buf[0] = x1; buf[1] = y1;
	buf[2] = x2; buf[3] = y2;
	return buf;
}

/**
 * Minimal SVG path parser — handles M, L, C, Q, Z commands.
 * Returns interleaved [x, y] Float32Array.
 */
function pathToPoints(d: string): Float32Array {
	const nums   = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
	const coords: number[] = [];
	const cmds   = d.match(/[MLCQZ][^MLCQZ]*/gi) ?? [];

	for (const cmd of cmds) {
		const type = cmd[0].toUpperCase();
		const n    = cmd.slice(1).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
		if (type === "M" || type === "L") {
			for (let i = 0; i < n.length; i += 2) coords.push(n[i], n[i + 1]);
		} else if (type === "C") {
			// cubic: cp1x cp1y cp2x cp2y x y — push all 3 pairs
			for (let i = 0; i < n.length; i += 6)
				coords.push(n[i], n[i+1], n[i+2], n[i+3], n[i+4], n[i+5]);
		} else if (type === "Q") {
			for (let i = 0; i < n.length; i += 4)
				coords.push(n[i], n[i+1], n[i+2], n[i+3]);
		}
		// Z closes — no extra point needed (renderer handles it)
	}
	void nums; // suppress unused warning
	return new Float32Array(coords);
}

// ── Geometry normalisation (pad/trim both arrays to equal length) ──────────────

/**
 * When two shapes have different point counts, evenly duplicate points in the
 * smaller one so both arrays have the same length before interpolation.
 */
export function equalisePoints(
	a: Float32Array,
	b: Float32Array,
): [Float32Array, Float32Array] {
	if (a.length === b.length) return [a, b];

	const target = Math.max(a.length, b.length);
	const expand = (src: Float32Array, len: number): Float32Array => {
		const out  = new Float32Array(len);
		const ratio = src.length / len;
		for (let i = 0; i < len; i += 2) {
			const si  = Math.floor((i / len) * (src.length / 2)) * 2;
			out[i]    = src[Math.min(si,     src.length - 2)];
			out[i + 1] = src[Math.min(si + 1, src.length - 1)];
		}
		return out;
	};

	return [
		a.length < target ? expand(a, target) : a,
		b.length < target ? expand(b, target) : b,
	];
}

// ── Linear interpolation into pre-allocated output buffer ─────────────────────

export function interpolatePoints(
	from: Float32Array,
	to:   Float32Array,
	t:    number,
	out:  Float32Array,
): void {
	const len = Math.min(from.length, to.length, out.length);
	for (let i = 0; i < len; i++) {
		out[i] = from[i] + (to[i] - from[i]) * t;
	}
}

// ── Canvas drawing ────────────────────────────────────────────────────────────

export function drawPoints(
	ctx:       CanvasRenderingContext2D,
	points:    Float32Array,
	count:     number,
	isBezier:  boolean,
	alpha:     number,
	stroke:    string,
	fill:      string,
	lineWidth: number,
): void {
	if (count < 2) return;

	ctx.globalAlpha = alpha;
	ctx.strokeStyle = stroke;
	ctx.fillStyle   = fill;
	ctx.lineWidth   = lineWidth;
	ctx.beginPath();
	ctx.moveTo(points[0], points[1]);

	if (isBezier) {
		// 4-arc cubic bezier circle: 3 control points per segment
		for (let i = 2; i + 5 < count * 2; i += 6) {
			ctx.bezierCurveTo(
				points[i],   points[i+1],
				points[i+2], points[i+3],
				points[i+4], points[i+5],
			);
		}
	} else {
		for (let i = 2; i < count * 2; i += 2) {
			ctx.lineTo(points[i], points[i+1]);
		}
	}

	if (fill !== "transparent" && fill !== "none") ctx.fill();
	ctx.stroke();
	ctx.globalAlpha = 1;
}

// ── Mobject vectorizer ────────────────────────────────────────────────────────

function vectorizeMobject(mob: ManimMobject): CompiledMobject {
	let points:    Float32Array;
	let isBezier = false;

	switch (mob.type) {
		case "Circle":
			points   = circleToPoints(mob.x ?? 0, mob.y ?? 0, mob.radius);
			isBezier = true;
			break;
		case "Square":
			points   = squareToPoints(mob.x ?? 0, mob.y ?? 0, mob.sideLength);
			break;
		case "Rectangle":
			points   = rectToPoints(mob.x ?? 0, mob.y ?? 0, mob.width, mob.height);
			break;
		case "Line":
			points   = lineToPoints(mob.x1, mob.y1, mob.x2, mob.y2);
			break;
		case "Path":
			points   = pathToPoints(mob.d);
			break;
		default:
			points   = new Float32Array(0);
	}

	return {
		id:          mob.id,
		points,
		pointCount:  points.length / 2,
		strokeColor: (mob as any).strokeColor ?? "var(--e-accent, white)",
		fillColor:   (mob as any).fillColor   ?? "transparent",
		strokeWidth: (mob as any).strokeWidth  ?? 2,
		isBezier,
	};
}

// ── WeakMap cache — compile once per ManimConfig object reference ─────────────

const _cache = new WeakMap<ManimConfig, CompiledManimTimeline>();

// ── Public compiler ───────────────────────────────────────────────────────────

export function compileManimConfig(config: ManimConfig): CompiledManimTimeline {
	if (_cache.has(config)) return _cache.get(config)!;

	const mobjectMap = new Map<string, CompiledMobject>();
	for (const mob of config.mobjects) {
		mobjectMap.set(mob.id, vectorizeMobject(mob));
	}

	const steps: CompiledTimelineStep[] = config.timeline.map((step) => ({
		action:    step.action,
		target:    step.target    ? mobjectMap.get(step.target)    : undefined,
		origin:    step.origin    ? mobjectMap.get(step.origin)    : undefined,
		durationMs: step.durationMs,
		delay:     step.delay     ?? 0,
		easing:    step.easing    ?? "ease-in-out",
	}));

	const compiled: CompiledManimTimeline = {
		steps,
		mobjectMap,
		settings: {
			loop:     config.settings?.loop     ?? false,
			fpsLimit: config.settings?.fpsLimit ?? 60,
			background: config.settings?.background ?? "transparent",
		},
	};

	_cache.set(config, compiled);
	return compiled;
}
