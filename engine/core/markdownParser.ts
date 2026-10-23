// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine — Markdown source compatibility helpers
// ─────────────────────────────────────────────────────────────────────────────

const COMPACT_FENCE = /^([ \t]{0,3})(`{3,}|~{3,})([A-Za-z0-9_+.-]+)[ \t]+(.+)$/;

/**
 * Preserve CommonMark input while repairing the compact fence shape produced by
 * a few documentation generators: ` ```text code...``` ` on one physical line.
 * A standards parser treats everything after `text` as fence metadata, which is
 * almost never what the author meant in this particular shape.
 */
export function normalizeEngineMarkdownSource(content: string): string {
	const lines = content.replace(/\r\n?/g, "\n").split("\n");
	const normalized: string[] = [];

	for (const line of lines) {
		const match = COMPACT_FENCE.exec(line);
		if (!match) {
			normalized.push(line);
			continue;
		}

		const [, indentation, fence, language, remainder] = match;
		const trimmed = remainder.trimEnd();
		if (!trimmed.endsWith(fence)) {
			normalized.push(line);
			continue;
		}

		const code = trimmed.slice(0, -fence.length).trimEnd();
		normalized.push(`${indentation}${fence}${language}`);
		normalized.push(code);
		normalized.push(`${indentation}${fence}`);
	}

	return normalized.join("\n");
}


export type EngineAnsiColor =
	| "black" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white"
	| "brightBlack" | "brightRed" | "brightGreen" | "brightYellow"
	| "brightBlue" | "brightMagenta" | "brightCyan" | "brightWhite";

export type EngineAnsiPalette = Partial<Record<EngineAnsiColor, string>>;

export interface EngineAnsiSegment {
	text: string;
	style: Record<string, string | number>;
}

const ANSI_COLOR_NAMES: EngineAnsiColor[] = [
	"black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
	"brightBlack", "brightRed", "brightGreen", "brightYellow",
	"brightBlue", "brightMagenta", "brightCyan", "brightWhite",
];

const ANSI_DEFAULT_PALETTE: Record<EngineAnsiColor, string> = {
	black: "#000000", red: "#aa0000", green: "#00aa00", yellow: "#aa5500",
	blue: "#0000aa", magenta: "#aa00aa", cyan: "#00aaaa", white: "#aaaaaa",
	brightBlack: "#555555", brightRed: "#ff5555", brightGreen: "#55ff55",
	brightYellow: "#ffff55", brightBlue: "#5555ff", brightMagenta: "#ff55ff",
	brightCyan: "#55ffff", brightWhite: "#ffffff",
};

function ansi256Color(index: number, palette: EngineAnsiPalette): string {
	if (index >= 0 && index < 16) {
		const name = ANSI_COLOR_NAMES[index];
		return palette[name] ?? ANSI_DEFAULT_PALETTE[name];
	}
	if (index >= 232) {
		const shade = 8 + (index - 232) * 10;
		return `rgb(${shade}, ${shade}, ${shade})`;
	}
	if (index >= 16 && index <= 231) {
		const value = index - 16;
		const channel = (part: number) => part === 0 ? 0 : 55 + part * 40;
		return `rgb(${channel(Math.floor(value / 36))}, ${channel(Math.floor(value / 6) % 6)}, ${channel(value % 6)})`;
	}
	return "inherit";
}

/** Convert ANSI SGR terminal output to safe text segments with React-compatible styles. */
export function parseEngineAnsi(
	input: string,
	palette: EngineAnsiPalette = {},
	defaultForeground = "#e6edf3",
	defaultBackground = "#0b1020",
): EngineAnsiSegment[] {
	const segments: EngineAnsiSegment[] = [];
	const state: {
		bold: boolean; dim: boolean; italic: boolean; underline: boolean;
		strike: boolean; inverse: boolean; foreground?: string; background?: string;
	} = { bold: false, dim: false, italic: false, underline: false, strike: false, inverse: false };
	const escapePattern = /\u001b\[([0-9;]*)m/g;
	let cursor = 0;
	let match: RegExpExecArray | null;

	const push = (text: string) => {
		if (!text) return;
		const foreground = state.foreground ?? defaultForeground;
		const background = state.background ?? defaultBackground;
		const style: Record<string, string | number> = {};
		if (state.bold) style.fontWeight = 700;
		if (state.dim) style.opacity = 0.68;
		if (state.italic) style.fontStyle = "italic";
		if (state.underline || state.strike) {
			style.textDecoration = [state.underline ? "underline" : "", state.strike ? "line-through" : ""].filter(Boolean).join(" ");
		}
		if (state.inverse) {
			style.color = background;
			style.backgroundColor = foreground;
		} else {
			if (state.foreground || defaultForeground) style.color = foreground;
			if (state.background || defaultBackground) style.backgroundColor = background;
		}
		segments.push({ text, style });
	};

	while ((match = escapePattern.exec(input)) !== null) {
		push(input.slice(cursor, match.index));
		const codes = (match[1] || "0").split(";").map((value) => value === "" ? 0 : Number(value));
		for (let index = 0; index < codes.length; index += 1) {
			const code = codes[index];
			if (code === 0) {
				state.bold = state.dim = state.italic = state.underline = state.strike = state.inverse = false;
				state.foreground = state.background = undefined;
			} else if (code === 1) state.bold = true;
			else if (code === 2) state.dim = true;
			else if (code === 3) state.italic = true;
			else if (code === 4) state.underline = true;
			else if (code === 7) state.inverse = true;
			else if (code === 9) state.strike = true;
			else if (code === 22) state.bold = state.dim = false;
			else if (code === 23) state.italic = false;
			else if (code === 24) state.underline = false;
			else if (code === 27) state.inverse = false;
			else if (code === 29) state.strike = false;
			else if (code === 39) state.foreground = undefined;
			else if (code === 49) state.background = undefined;
			else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
				const colorIndex = code >= 90 ? code - 90 + 8 : code - 30;
				state.foreground = ansi256Color(colorIndex, palette);
			} else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
				const colorIndex = code >= 100 ? code - 100 + 8 : code - 40;
				state.background = ansi256Color(colorIndex, palette);
			} else if ((code === 38 || code === 48) && codes[index + 1] === 5 && Number.isFinite(codes[index + 2])) {
				const color = ansi256Color(Math.max(0, Math.min(255, codes[index + 2])), palette);
				if (code === 38) state.foreground = color;
				else state.background = color;
				index += 2;
			} else if ((code === 38 || code === 48) && codes[index + 1] === 2
				&& codes.slice(index + 2, index + 5).every(Number.isFinite)) {
				const [red, green, blue] = codes.slice(index + 2, index + 5).map((value) => Math.max(0, Math.min(255, value)));
				const color = `rgb(${red}, ${green}, ${blue})`;
				if (code === 38) state.foreground = color;
				else state.background = color;
				index += 4;
			}
		}
		cursor = escapePattern.lastIndex;
	}
	push(input.slice(cursor));
	return segments;
}

export function slugifyMarkdownHeading(text: string): string {
	const plain = text
		.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/[*_`~]/g, "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return plain || "section";
}
