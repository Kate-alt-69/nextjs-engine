// ─────────────────────────────────────────────────────────────────────────────
//  Engine — manimDSLParser  (Tier 3 / 4)
//
//  Parses the EngineManim animation DSL into typed structures.
//
//  Grammar:
//
//    # Full-line comments
//
//    frame (
//      frame-start = 120
//      frame-end   = 240
//    ) {
//      left.hand.move   = [10, 0, 0]
//      right.leg.rotate = [0, 45, 0]
//      2.tentacle.scale = [1.5, 1.5, 1.5]
//    }
//
//    camera.look.content  = head        # bone name OR [x, y, z]
//    camera.focus.distance = 5
//    camera.position      = [0, 2, 5]
//
//    light.sun.direction  = [1, -1, 0.5]
//    light.sun.intensity  = 0.9
//
//  Rules:
//    · Bone transforms (.move / .rotate / .scale) are ONLY valid inside frame { }.
//    · camera.X.Y and light.X.Y are ONLY valid at the top level.
//    · Bone name is everything before the last dot: "left.hand" "2.tentacle".
//    · Values: number, [n, n, n] array, or bare word (bone reference).
// ─────────────────────────────────────────────────────────────────────────────

import type {
	ManimDSLDocument,
	ManimDSLFrameGroup,
	ManimDSLConstraints,
	ManimBoneTransform,
	ManimEasing,
	Manim3DCamera,
	Manim3DLight,
} from "./manimTypes";

// ─────────────────────────────────────────────────────────────────────────────
//  Tokenizer
// ─────────────────────────────────────────────────────────────────────────────

type TokenKind =
	| "WORD"     // identifier, dotted path, bone name
	| "NUMBER"
	| "ARRAY"    // [n, n, n]
	| "EQ"       // =
	| "LPAREN"   // (
	| "RPAREN"   // )
	| "LBRACE"   // {
	| "RBRACE"   // }
	| "EOF";

interface Token {
	kind:  TokenKind;
	value: string;
	line:  number;
}

function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	const lines  = source.split(/\r?\n/);

	for (let lineNo = 0; lineNo < lines.length; lineNo++) {
		let line = lines[lineNo];

		// Strip inline comments
		const commentIdx = line.indexOf("#");
		if (commentIdx !== -1) line = line.slice(0, commentIdx);

		let i = 0;
		while (i < line.length) {
			// Whitespace
			if (/\s/.test(line[i])) { i++; continue; }

			// Array literal [n, n, n]
			if (line[i] === "[") {
				const end = line.indexOf("]", i);
				if (end !== -1) {
					tokens.push({ kind: "ARRAY", value: line.slice(i, end + 1), line: lineNo + 1 });
					i = end + 1;
					continue;
				}
			}

			// Single-char tokens
			if (line[i] === "=") { tokens.push({ kind: "EQ",     value: "=", line: lineNo + 1 }); i++; continue; }
			if (line[i] === "(") { tokens.push({ kind: "LPAREN", value: "(", line: lineNo + 1 }); i++; continue; }
			if (line[i] === ")") { tokens.push({ kind: "RPAREN", value: ")", line: lineNo + 1 }); i++; continue; }
			if (line[i] === "{") { tokens.push({ kind: "LBRACE", value: "{", line: lineNo + 1 }); i++; continue; }
			if (line[i] === "}") { tokens.push({ kind: "RBRACE", value: "}", line: lineNo + 1 }); i++; continue; }

			// Number (including negative)
			const numMatch = line.slice(i).match(/^-?\d+(?:\.\d+)?/);
			if (numMatch) {
				tokens.push({ kind: "NUMBER", value: numMatch[0], line: lineNo + 1 });
				i += numMatch[0].length;
				continue;
			}

			// Word / dotted-path / bone name (letters, digits, dots, underscores, hyphens)
			const wordMatch = line.slice(i).match(/^[\w.\-]+/);
			if (wordMatch) {
				tokens.push({ kind: "WORD", value: wordMatch[0], line: lineNo + 1 });
				i += wordMatch[0].length;
				continue;
			}

			i++; // skip unknown char
		}
	}

	tokens.push({ kind: "EOF", value: "", line: lines.length });
	return tokens;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Value parsers
// ─────────────────────────────────────────────────────────────────────────────

function parseArray(raw: string): [number, number, number] {
	const nums = raw.replace(/[\[\]]/g, "").split(",").map((s) => parseFloat(s.trim()));
	return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0];
}

function parseVec3OrRef(token: Token): [number, number, number] | string {
	if (token.kind === "ARRAY")  return parseArray(token.value);
	if (token.kind === "NUMBER") return [parseFloat(token.value), 0, 0];
	if (token.kind === "WORD")   return token.value; // bone name reference
	return token.value;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Bone transform line  e.g. "left.hand.move = [10, 0, 0]"
// ─────────────────────────────────────────────────────────────────────────────

type BoneTransformKind = "move" | "rotate" | "scale";
const BONE_TRANSFORMS: BoneTransformKind[] = ["move", "rotate", "scale"];

function parseBoneTransformLine(
	pathWord: string,
	valueToken: Token,
	easing: ManimEasing = "ease-in-out",
): ManimBoneTransform | null {
	// Split off the last segment as the transform type
	const segments = pathWord.split(".");
	const last     = segments[segments.length - 1] as BoneTransformKind;

	if (!BONE_TRANSFORMS.includes(last)) return null;

	const boneName = segments.slice(0, -1).join(".");
	const val      = parseArray(
		valueToken.kind === "ARRAY" ? valueToken.value : "[0,0,0]",
	);

	const transform: ManimBoneTransform = { bone: boneName, easing };
	if (last === "move")   transform.move   = val;
	if (last === "rotate") transform.rotate = val;
	if (last === "scale")  transform.scale  = val;

	return transform;
}

// ─────────────────────────────────────────────────────────────────────────────
//  camera.X.Y assignment
// ─────────────────────────────────────────────────────────────────────────────

function applyCameraAssignment(
	cam:   Manim3DCamera,
	path:  string,
	value: Token,
): void {
	const parts = path.split(".");
	const ns    = parts[1] ?? "";
	const prop  = parts[2] ?? "";

	switch (ns) {
		case "position":
			cam.position = parseArray(value.kind === "ARRAY" ? value.value : "[0,2,5]");
			break;
		case "fov":
			cam.fov = parseFloat(value.value);
			break;
		case "look":
			if (!cam.look) cam.look = {};
			if (prop === "content") {
				const parsed = parseVec3OrRef(value);
				cam.look.content = parsed as any;
			}
			break;
		case "focus":
			if (!cam.focus) cam.focus = {};
			if (prop === "distance") cam.focus.distance = parseFloat(value.value);
			if (prop === "aperture") cam.focus.aperture = parseFloat(value.value);
			break;
	}
}

// ─────────────────────────────────────────────────────────────────────────────
//  light.NAME.PROP assignment
// ─────────────────────────────────────────────────────────────────────────────

function applyLightAssignment(
	lights: Manim3DLight[],
	path:   string,
	value:  Token,
): void {
	const parts    = path.split(".");
	const lightId  = parts[1] ?? "sun";
	const prop     = parts[2] ?? "";

	// Find or create a light entry
	let light = lights.find((l) => (l as any)._id === lightId);
	if (!light) {
		light = { type: "directional" };
		(light as any)._id = lightId;
		lights.push(light);
	}

	switch (prop) {
		case "type":      light.type      = value.value as any;  break;
		case "intensity": light.intensity = parseFloat(value.value); break;
		case "color":     light.color     = value.value;          break;
		case "direction":
			if (value.kind === "ARRAY") light.direction = parseArray(value.value);
			break;
		case "position":
			if (value.kind === "ARRAY") light.position  = parseArray(value.value);
			break;
	}
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main parser
// ─────────────────────────────────────────────────────────────────────────────

export function parseManimDSL(source: string): ManimDSLDocument {
	const tokens  = tokenize(source);
	let   cursor  = 0;

	const frames:      ManimDSLFrameGroup[] = [];
	const camera:      Manim3DCamera        = {};
	const lights:      Manim3DLight[]       = [];

	const peek  = (): Token => tokens[cursor] ?? { kind: "EOF", value: "", line: 0 };
	const eat   = (): Token => tokens[cursor++] ?? { kind: "EOF", value: "", line: 0 };
	const expect = (kind: TokenKind): Token => {
		const t = eat();
		if (t.kind !== kind) throw new Error(`[DSL:${t.line}] Expected ${kind}, got "${t.value}"`);
		return t;
	};

	// ── frame ( frame-start = N  frame-end = M ) { ... } ────────────────────
	function parseFrameBlock(): ManimDSLFrameGroup {
		// Consume "("
		expect("LPAREN");

		let frameStart = 0;
		let frameEnd   = 0;

		// Parse key=value pairs until ")"
		while (peek().kind !== "RPAREN" && peek().kind !== "EOF") {
			const key = eat();
			if (key.kind !== "WORD") continue;
			if (peek().kind === "EQ") {
				eat(); // consume "="
				const val = eat();
				const n   = parseFloat(val.value);
				if (key.value === "frame-start") frameStart = n;
				if (key.value === "frame-end")   frameEnd   = n;
			}
		}

		expect("RPAREN");
		expect("LBRACE");

		const transforms: ManimBoneTransform[] = [];

		while (peek().kind !== "RBRACE" && peek().kind !== "EOF") {
			const pathToken = eat();
			if (pathToken.kind !== "WORD") continue;
			if (peek().kind !== "EQ") continue;
			eat(); // consume "="
			const valToken = eat();

			const transform = parseBoneTransformLine(pathToken.value, valToken);
			if (transform) transforms.push(transform);
		}

		expect("RBRACE");
		return { frameStart, frameEnd, transforms };
	}

	// ── Main loop ─────────────────────────────────────────────────────────────

	while (peek().kind !== "EOF") {
		const token = peek();

		if (token.kind === "WORD" && token.value === "frame") {
			eat(); // consume "frame" keyword
			frames.push(parseFrameBlock());
			continue;
		}

		if (token.kind === "WORD") {
			const path = eat().value;

			// camera.X.Y = value
			if (path.startsWith("camera.")) {
				if (peek().kind === "EQ") {
					eat();
					applyCameraAssignment(camera, path, eat());
				}
				continue;
			}

			// light.X.Y = value
			if (path.startsWith("light.")) {
				if (peek().kind === "EQ") {
					eat();
					applyLightAssignment(lights, path, eat());
				}
				continue;
			}

			// Unknown top-level — skip to next line by eating until next WORD boundary
			if (peek().kind === "EQ") { eat(); eat(); }
			continue;
		}

		eat(); // skip unrecognised tokens
	}

	return {
		frames,
		constraints: { camera, lights },
	};
}
