// ─────────────────────────────────────────────────────────────────────────────
// Engine — StyleCollector
//
// Provider-scoped generated CSS with deterministic serialization. Render-time
// registration is still intentionally cheap, while client subscribers are
// notified after the render stack so new dynamic rules can be flushed safely.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";

const explicitGlobalStyles = new Set<string>();

type StyleCollectorSubscriber = () => void;

function stylePriority(cssBlock: string): number {
	const trimmed = cssBlock.trimStart();
	if (trimmed.startsWith(":root") || (trimmed.startsWith("@media") && trimmed.includes(":root"))) return 0;
	if (trimmed.startsWith("@font-face") || trimmed.startsWith("@keyframes")) return 1;
	return 2;
}

function canonicalize(cssBlocks: Iterable<string>): string {
	return [...cssBlocks]
		.sort((left, right) => {
			const priorityDifference = stylePriority(left) - stylePriority(right);
			return priorityDifference !== 0 ? priorityDifference : left.localeCompare(right);
		})
		.join("\n");
}

export class StyleCollector {
	private _styles = new Set<string>();
	private _subscribers = new Set<StyleCollectorSubscriber>();
	private _notifyTimer: ReturnType<typeof setTimeout> | null = null;

	private scheduleNotify(): void {
		if (this._subscribers.size === 0 || this._notifyTimer !== null) return;
		this._notifyTimer = setTimeout(() => {
			this._notifyTimer = null;
			for (const subscriber of [...this._subscribers]) subscriber();
		}, 0);
	}

	add(cssBlock: string): void {
		if (!cssBlock || this._styles.has(cssBlock)) return;
		this._styles.add(cssBlock);
		this.scheduleNotify();
	}

	addGlobal(cssBlock: string): void {
		if (!cssBlock) return;
		explicitGlobalStyles.add(cssBlock);
		this.add(cssBlock);
	}

	addMany(cssBlocks: string[]): void {
		let changed = false;
		for (const cssBlock of cssBlocks) {
			if (!cssBlock || this._styles.has(cssBlock)) continue;
			this._styles.add(cssBlock);
			changed = true;
		}
		if (changed) this.scheduleNotify();
	}

	collect(): string {
		return canonicalize(this._styles);
	}

	subscribe(subscriber: StyleCollectorSubscriber): () => void {
		this._subscribers.add(subscriber);
		return () => {
			this._subscribers.delete(subscriber);
		};
	}

	reset(): void {
		if (this._styles.size === 0) return;
		this._styles.clear();
		this.scheduleNotify();
	}

	get size(): number {
		return this._styles.size;
	}

	static getRegistryGlobalCSS(): string {
		return canonicalize(explicitGlobalStyles);
	}

	static _resetRegistry(): void {
		explicitGlobalStyles.clear();
	}

	static registrySize(): number {
		return explicitGlobalStyles.size;
	}
}

// Compatibility fallback for low-level helpers called outside EngineProvider.
export const globalStyleCollector = new StyleCollector();

if (
	typeof module !== "undefined" &&
	process.env.NODE_ENV !== "production" &&
	(module as any).hot
) {
	(module as any).hot.dispose(() => {
		if (typeof document !== "undefined") {
			document.querySelectorAll("style[data-engine-generated='true']").forEach((element) => {
				element.textContent = "";
			});
		}
		StyleCollector._resetRegistry();
	});
}

export function EngineGlobalStyles(): React.ReactElement | null {
	const compiledGlobalCssContent = StyleCollector.getRegistryGlobalCSS();
	if (!compiledGlobalCssContent) return null;
	return React.createElement("style", {
		id: "eng-global",
		"data-engine-generated": "true",
		precedence: "engine-global",
		dangerouslySetInnerHTML: { __html: compiledGlobalCssContent },
	});
}
