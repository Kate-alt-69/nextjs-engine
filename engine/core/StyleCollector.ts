// ─────────────────────────────────────────────────────────────────────────────
//	Engine — StyleCollector
//
//	Collects CSS emitted during one render pass, deduplicates by exact content,
//	and outputs one ordered CSS string. Normal render CSS is deliberately not
//	retained cross-render: every response still needs its own stylesheet, so a
//	process-wide cache of ordinary blocks only adds memory/hash overhead.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";

// Only explicitly-global CSS survives across render passes. Normal generated
// responsive/pseudo/local CSS belongs to the collector that emitted it.
const explicitGlobalStyles = new Set<string>();

export class StyleCollector {
	private _orderedStyles: string[] = [];
	private _seenStyles = new Set<string>();

	add(cssBlock: string): void {
		if (!cssBlock || this._seenStyles.has(cssBlock)) return;
		this._seenStyles.add(cssBlock);
		this._orderedStyles.push(cssBlock);
	}

	addGlobal(cssBlock: string): void {
		if (!cssBlock) return;
		explicitGlobalStyles.add(cssBlock);
		this.add(cssBlock);
	}

	addMany(cssBlocks: string[]): void {
		for (const individualBlock of cssBlocks) {
			this.add(individualBlock);
		}
	}

	collect(): string {
		return this._orderedStyles.join("\n");
	}

	reset(): void {
		this._orderedStyles = [];
		this._seenStyles.clear();
	}

	get size(): number {
		return this._seenStyles.size;
	}

	static getRegistryGlobalCSS(): string {
		return [...explicitGlobalStyles].join("\n");
	}

	static _resetRegistry(): void {
		explicitGlobalStyles.clear();
	}

	/** Number of CSS blocks intentionally retained across render passes. */
	static registrySize(): number {
		return explicitGlobalStyles.size;
	}
}

// Compatibility fallback for low-level helpers called outside EngineProvider.
// Engine-owned rendering uses a provider-scoped collector instead, so concurrent
// page renders do not reset, erase, or inherit one another's generated CSS.
export const globalStyleCollector = new StyleCollector();

if (
	typeof module !== "undefined" &&
	process.env.NODE_ENV !== "production" &&
	(module as any).hot
) {
	(module as any).hot.dispose(() => {
		if (typeof document !== "undefined") {
			const targetStyleSheetElement = document.getElementById("__engine_styles__");
			if (targetStyleSheetElement) {
				targetStyleSheetElement.textContent = "";
			}
		}
		StyleCollector._resetRegistry();
	});
}

export function EngineGlobalStyles(): React.ReactElement | null {
	const compiledGlobalCssContent = StyleCollector.getRegistryGlobalCSS();
	if (!compiledGlobalCssContent) return null;
	return React.createElement("style", {
		id: "eng-global",
		dangerouslySetInnerHTML: { __html: compiledGlobalCssContent },
	});
}
