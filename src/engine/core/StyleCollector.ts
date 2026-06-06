// ─────────────────────────────────────────────────────────────────────────────
//  Engine — StyleCollector
//
//  During a server render pass, each component that needs CSS custom-property
//  blocks registers them here. At the end of the render, StyleCollector.flush()
//  returns a deduplicated <style> tag to inject into <head>.
//
//  On the client, the tag is already in the DOM — no JS re-work needed.
// ─────────────────────────────────────────────────────────────────────────────

export class StyleCollector {
	private blocks = new Set<string>();
	private readonly id: string;

	constructor(id = "engine-styles") {
		this.id = id;
	}

	/** Register a CSS block (idempotent — duplicates ignored). */
	add(cssBlock: string): void {
		if (cssBlock) this.blocks.add(cssBlock);
	}

	/** Register multiple CSS blocks at once. */
	addMany(cssBlocks: string[]): void {
		for (const b of cssBlocks) this.add(b);
	}

	/** Returns all collected CSS as a single deduplicated string. */
	collect(): string {
		return [...this.blocks].join("\n");
	}

	/** Returns a <style> JSX element containing all collected CSS. */
	flush(): string {
		const css = this.collect();
		if (!css) return "";
		// Clear after flush so re-use across requests is safe
		this.blocks.clear();
		return `<style id="${this.id}">${css}</style>`;
	}

	/** Clears without flushing — call before each new page render. */
	reset(): void {
		this.blocks.clear();
	}

	get size(): number {
		return this.blocks.size;
	}
}

// ── Singleton used by engine internals ────────────────────────────────────────

/**
 * Module-level collector shared across all engine components in a render pass.
 * On the server this is safe because Next.js serialises SSR renders.
 * On the client this is never written to (styles are already in the DOM).
 */
export const globalStyleCollector = new StyleCollector("eng");
