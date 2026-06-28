// ============================================================================
// EngineScrollRuntime.ts
// ============================================================================

import {
	DefaultEngineScrollCache,
	DefaultEngineScrollState,
} from "./EngineScrollState";

import type {
	EngineScrollRuntimeCache,
	EngineScrollState,
	EngineScrollSubscriber,
} from "./EngineScrollTypes";

/* ========================================================================== */

export class EngineScrollRuntime {

	private static instance: EngineScrollRuntime | null = null;

	public static get(): EngineScrollRuntime {

		if (!this.instance) {
			this.instance = new EngineScrollRuntime();
		}

		return this.instance;

	}

	/* ====================================================================== */

	private readonly state: EngineScrollState =
		structuredClone(DefaultEngineScrollState);

	private readonly cache: EngineScrollRuntimeCache =
		structuredClone(DefaultEngineScrollCache);

	private readonly subscribers =
		new Set<EngineScrollSubscriber>();

	private constructor() {}

	/* ====================================================================== */
	/* Public State                                                           */
	/* ====================================================================== */

	public getState(): Readonly<EngineScrollState> {

		return this.state;

	}

	/* ====================================================================== */
	/* Internal State                                                         */
	/* ====================================================================== */

	public getMutableState(): EngineScrollState {

		return this.state;

	}

	public getCache(): EngineScrollRuntimeCache {

		return this.cache;

	}

	/* ====================================================================== */
	/* Lifecycle                                                              */
	/* ====================================================================== */

	public initialize(): void {

		if (this.state.initialized) {
			return;
		}

		this.state.initialized = true;

	}

	public destroy(): void {

		this.state.initialized = false;

		this.subscribers.clear();

	}

	/* ====================================================================== */
	/* Subscribers                                                            */
	/* ====================================================================== */

	public subscribe(
		callback: EngineScrollSubscriber,
	): () => void {

		this.subscribers.add(callback);

		return () => {

			this.subscribers.delete(callback);

		};

	}

	public unsubscribe(
		callback: EngineScrollSubscriber,
	): void {

		this.subscribers.delete(callback);

	}

	public notify(): void {

		const snapshot = this.getState();

		for (const subscriber of this.subscribers) {

			subscriber(snapshot);

		}

	}

}