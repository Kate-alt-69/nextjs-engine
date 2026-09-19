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
