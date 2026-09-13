"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EngineTransitions — single-owner native View Transition coordinator
// ─────────────────────────────────────────────────────────────────────────────

export type EngineViewTransitionConflict = "replace" | "skip";

export type EngineViewTransitionStatus =
	| "finished"
	| "cancelled"
	| "failed"
	| "skipped"
	| "unsupported";

export interface EngineViewTransitionOptions {
	/**
	 * `skip` applies the requested update without starting another native visual
	 * transition. `replace` skips the active visual transition and starts the new
	 * one. App-level effects should normally keep the default `skip` behavior.
	 */
	conflict?: EngineViewTransitionConflict;
}

export interface EngineNativeViewTransition {
	finished: Promise<void>;
	ready: Promise<void>;
	updateCallbackDone: Promise<void>;
	skipTransition?: () => void;
}

type EngineTransitionDocument = Document & {
	startViewTransition?: (updateCallback: () => void | Promise<void>) => EngineNativeViewTransition;
};

interface EngineViewTransitionLifecycle {
	cleanup?: () => void;
	fallback?: () => void | Promise<void>;
	onReady?: (transition: EngineNativeViewTransition) => void | Promise<void>;
	prepare?: () => void;
}

interface ActiveEngineViewTransition {
	cleanup: () => void;
	transition: EngineNativeViewTransition;
}

let activeTransition: ActiveEngineViewTransition | null = null;

function isViewTransitionCancellation(reason: unknown): boolean {
	if (!reason || typeof reason !== "object") return false;
	return "name" in reason && reason.name === "AbortError";
}

function createOnce(action: (() => void) | undefined): () => void {
	let complete = false;
	return () => {
		if (complete) return;
		complete = true;
		action?.();
	};
}

function skipActiveTransition(): void {
	const active = activeTransition;
	if (!active) return;
	if (activeTransition === active) activeTransition = null;
	active.cleanup();
	try {
		active.transition.skipTransition?.();
	} catch {
		// The browser may have finished the transition between the active check
		// and this call. Its already-observed lifecycle promises remain authoritative.
	}
}

/**
 * Low-level coordinator used by EngineTransitions+ to add preset lifecycle work.
 * It is intentionally not re-exported from the public engine barrel.
 */
export async function runCoordinatedEngineViewTransition(
	update: () => void | Promise<void>,
	options: EngineViewTransitionOptions = {},
	lifecycle: EngineViewTransitionLifecycle = {},
): Promise<EngineViewTransitionStatus> {
	if (typeof document === "undefined") {
		await update();
		return "unsupported";
	}

	const transitionDocument = document as EngineTransitionDocument;
	if (typeof transitionDocument.startViewTransition !== "function") {
		await (lifecycle.fallback ?? update)();
		return "unsupported";
	}

	if (activeTransition) {
		if ((options.conflict ?? "skip") === "skip") {
			await update();
			return "skipped";
		}
		skipActiveTransition();
	}

	const cleanup = createOnce(lifecycle.cleanup);
	try {
		lifecycle.prepare?.();
	} catch (reason) {
		cleanup();
		throw reason;
	}

	let transition: EngineNativeViewTransition;
	try {
		transition = transitionDocument.startViewTransition(update);
	} catch {
		cleanup();
		await (lifecycle.fallback ?? update)();
		return "unsupported";
	}

	let cancelled = false;
	let lifecycleFailed = false;
	let updateFailed = false;
	let updateError: unknown;
	const recordFailure = (reason: unknown): void => {
		if (isViewTransitionCancellation(reason)) cancelled = true;
		else lifecycleFailed = true;
	};

	// Observe every native lifecycle promise immediately. Browsers intentionally
	// reject ready/finished when a newer transition supersedes the current one.
	const readyObserved = transition.ready
		.then(() => lifecycle.onReady?.(transition), (reason) => {
			recordFailure(reason);
		})
		.catch((reason) => {
			recordFailure(reason);
			try {
				transition.skipTransition?.();
			} catch {
				// The transition is already settling.
			}
		});
	const updateObserved = transition.updateCallbackDone.then(undefined, (reason) => {
		updateFailed = true;
		updateError = reason;
	});
	const finishedObserved = transition.finished.then(undefined, (reason) => {
		recordFailure(reason);
	});

	const activeRecord = { cleanup, transition };
	activeTransition = activeRecord;

	try {
		await Promise.all([readyObserved, updateObserved, finishedObserved]);
	} finally {
		cleanup();
		if (activeTransition === activeRecord) activeTransition = null;
	}

	if (updateFailed) throw updateError;
	if (cancelled) return "cancelled";
	if (lifecycleFailed) return "failed";
	return "finished";
}

/**
 * Runs an app-level DOM update through NE's shared native transition owner.
 * When another NE transition is active, the update is applied immediately and
 * its extra visual transition is skipped by default.
 */
export async function coordinateEngineViewTransition(
	update: () => void | Promise<void>,
	options: EngineViewTransitionOptions = {},
): Promise<EngineViewTransitionStatus> {
	return runCoordinatedEngineViewTransition(update, options);
}
