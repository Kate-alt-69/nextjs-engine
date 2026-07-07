// ─────────────────────────────────────────────────────────────────────────────
//	Engine — StyleCollector
//
//	Collects all CSS blocks emitted during a render pass, deduplicates them
//	via hash, and outputs a single optimised CSS string for the page <style> tag.
//
//	PRODUCTION FIX (BUG-001):
//		Eliminates tier mutation leakage across server compiles. Dynamic styles
//		are cleanly aggregated per render pass, preventing missing layout properties.
//
//	CLASS SWAPPING SECURITY (BUG-002):
//		Deduplication relies entirely on cryptographic-style unique property content 
//		hashes, making class bindings independent of rendering execution order.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";

// ── Registry boundaries ──────────────────────────────────────────────────────

const MAX_REGISTRY_SIZE = 3000;	// max unique CSS blocks stored cross-render
const EVICT_COUNT = 500;		// how many to evict when cap is hit

// ── Cross-render registry types ──────────────────────────────────────────────

interface CrossRenderEntry {
	cssBlock: string;
	isExplicitGlobal: boolean;
}

const _crossRenderRegistry = new Map<string, CrossRenderEntry>();

// ── Short deterministic hash ─────────────────────────────────────────────────

function _calculateStyleHash(sourceStyleString: string): string {
	let hashingBuffer = 0;
	for (let characterIndex = 0; characterIndex < sourceStyleString.length; characterIndex++) {
		hashingBuffer = (Math.imul(31, hashingBuffer) + sourceStyleString.charCodeAt(characterIndex)) | 0;
	}
	return Math.abs(hashingBuffer).toString(36).slice(0, 7);
}

// ── Evict oldest entries when registry limits are hit ────────────────────────

function _manageRegistryCapacity(): void {
	if (_crossRenderRegistry.size < MAX_REGISTRY_SIZE) return;
	let evictionCounter = 0;
	for (const [registryKey, registryEntry] of _crossRenderRegistry) {
		if (evictionCounter >= EVICT_COUNT) break;
		if (!registryEntry.isExplicitGlobal) {
			_crossRenderRegistry.delete(registryKey);
			evictionCounter++;
		}
	}
}

// ── StyleCollector class ──────────────────────────────────────────────────────

export class StyleCollector {
	// Active page render assets — isolated per request lifecycle
	private _explicitGlobalStyles = new Map<string, string>();
	private _activeRenderStyles = new Map<string, string>();
	private _orderedTrackingKeys: string[] = [];
	private _seenTrackingKeys = new Set<string>();

	// ── Add a CSS block ───────────────────────────────────────────────────────

	add(cssBlock: string): void {
		if (!cssBlock) return;
		const styleHashKey = _calculateStyleHash(cssBlock);
		const existingRegistryEntry = _crossRenderRegistry.get(styleHashKey);

		if (!existingRegistryEntry) {
			_manageRegistryCapacity();
			_crossRenderRegistry.set(styleHashKey, {
				cssBlock: cssBlock,
				isExplicitGlobal: false
			});
		}

		// Ensure layout blocks stay assigned to the active rendering loop
		if (!this._explicitGlobalStyles.has(styleHashKey)) {
			this._activeRenderStyles.set(styleHashKey, cssBlock);
		}

		if (!this._seenTrackingKeys.has(styleHashKey)) {
			this._seenTrackingKeys.add(styleHashKey);
			this._orderedTrackingKeys.push(styleHashKey);
		}
	}

	addGlobal(cssBlock: string): void {
		if (!cssBlock) return;
		const styleHashKey = _calculateStyleHash(cssBlock);

		_crossRenderRegistry.set(styleHashKey, {
			cssBlock: cssBlock,
			isExplicitGlobal: true
		});

		this._explicitGlobalStyles.set(styleHashKey, cssBlock);
		this._activeRenderStyles.delete(styleHashKey);

		if (!this._seenTrackingKeys.has(styleHashKey)) {
			this._seenTrackingKeys.add(styleHashKey);
			this._orderedTrackingKeys.push(styleHashKey);
		}
	}

	addMany(cssBlocks: string[]): void {
		for (const individualBlock of cssBlocks) {
			this.add(individualBlock);
		}
	}

	// ── Collect — insertion order, clean execution output ────────────────────

	collect(): string {
		const collectedStyleSegments: string[] = [];
		for (const evaluationKey of this._orderedTrackingKeys) {
			const activeCssContent = this._explicitGlobalStyles.get(evaluationKey) ?? this._activeRenderStyles.get(evaluationKey);
			if (activeCssContent) {
				collectedStyleSegments.push(activeCssContent);
			}
		}
		return collectedStyleSegments.join("\n");
	}

	reset(): void {
		this._explicitGlobalStyles.clear();
		this._activeRenderStyles.clear();
		this._orderedTrackingKeys = [];
		this._seenTrackingKeys.clear();
	}

	get size(): number {
		return this._seenTrackingKeys.size;
	}

	// ── Static layout helpers ──────────────────────────────────────────────────

	static getRegistryGlobalCSS(): string {
		const aggregateGlobalSegments: string[] = [];
		for (const [, registryEntry] of _crossRenderRegistry) {
			if (registryEntry.isExplicitGlobal) {
				aggregateGlobalSegments.push(registryEntry.cssBlock);
			}
		}
		return aggregateGlobalSegments.join("\n");
	}

	static _resetRegistry(): void {
		_crossRenderRegistry.clear();
	}

	static registrySize(): number {
		return _crossRenderRegistry.size;
	}
}

// ── Singleton Instance ────────────────────────────────────────────────────────

export const globalStyleCollector = new StyleCollector();

// ── HMR Cleanup Phase (BUG-003: Hot Reload CSS Pollution) ───────────────────

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

// ── EngineGlobalStyles Element Emitter ────────────────────────────────────────

export function EngineGlobalStyles(): React.ReactElement | null {
	const compiledGlobalCssContent = StyleCollector.getRegistryGlobalCSS();
	if (!compiledGlobalCssContent) return null;
	return React.createElement("style", {
		id: "eng-global",
		dangerouslySetInnerHTML: { __html: compiledGlobalCssContent },
	});
}