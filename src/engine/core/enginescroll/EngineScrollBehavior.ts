// ============================================================================
// EngineScrollBehavior.ts — Shared site-level movement policy
// ============================================================================

import type {
	EngineScrollBehaviorPolicy,
	EngineScrollMoveOptions,
	EngineScrollResolvedBehaviorPolicy,
} from "./EngineScrollTypes";

const BEHAVIORS = new Set(["smooth", "native", "instant"]);
const EASINGS = new Set([
	"linear",
	"easeInQuad",
	"easeOutQuad",
	"easeInOutQuad",
	"easeInCubic",
	"easeOutCubic",
	"easeInOutCubic",
]);
const REDUCED_MOTION_POLICIES = new Set(["respect", "reduce", "ignore"]);

const DEFAULT_POLICY: EngineScrollResolvedBehaviorPolicy = Object.freeze({
	behavior: "smooth",
	duration: 550,
	easing: "easeInOutCubic",
	interruptible: true,
	reducedMotion: "respect",
});

function mergePolicy(
	base: EngineScrollResolvedBehaviorPolicy,
	override: EngineScrollBehaviorPolicy,
): EngineScrollResolvedBehaviorPolicy {
	return Object.freeze({
		behavior: override.behavior && BEHAVIORS.has(override.behavior)
			? override.behavior
			: base.behavior,
		duration: Number.isFinite(override.duration)
			? Math.max(0, override.duration!)
			: base.duration,
		easing: override.easing && EASINGS.has(override.easing)
			? override.easing
			: base.easing,
		interruptible: typeof override.interruptible === "boolean"
			? override.interruptible
			: base.interruptible,
		reducedMotion: override.reducedMotion
			&& REDUCED_MOTION_POLICIES.has(override.reducedMotion)
			? override.reducedMotion
			: base.reducedMotion,
	});
}

/** Owns the default and provider-scoped behavior used by every ES movement. */
export class EngineScrollBehavior {
	private static basePolicy = DEFAULT_POLICY;
	private static readonly scopes = new Map<symbol, EngineScrollBehaviorPolicy>();

	public static configure(
		policy: EngineScrollBehaviorPolicy,
	): Readonly<EngineScrollResolvedBehaviorPolicy> {
		this.basePolicy = mergePolicy(this.basePolicy, policy);
		return this.current();
	}

	public static current(): Readonly<EngineScrollResolvedBehaviorPolicy> {
		let policy = this.basePolicy;
		for (const scopedPolicy of this.scopes.values()) {
			policy = mergePolicy(policy, scopedPolicy);
		}
		return policy;
	}

	public static reset(): Readonly<EngineScrollResolvedBehaviorPolicy> {
		this.basePolicy = DEFAULT_POLICY;
		return this.current();
	}

	public static scope(policy: EngineScrollBehaviorPolicy): () => void {
		const owner = Symbol("EngineScrollBehavior");
		this.scopes.set(owner, { ...policy });
		return () => {
			this.scopes.delete(owner);
		};
	}

	public static resolve(
		options: EngineScrollMoveOptions = {},
	): Readonly<EngineScrollResolvedBehaviorPolicy> {
		const reducedMotion = options.reducedMotion
			?? (options.respectReducedMotion === undefined
				? undefined
				: options.respectReducedMotion ? "respect" : "ignore");
		return mergePolicy(this.current(), {
			behavior: options.behavior,
			duration: options.duration,
			easing: options.easing,
			interruptible: options.interruptible,
			reducedMotion,
		});
	}

	public static shouldReduce(
		policy: Pick<EngineScrollResolvedBehaviorPolicy, "reducedMotion">,
	): boolean {
		if (policy.reducedMotion === "reduce") return true;
		if (policy.reducedMotion === "ignore") return false;
		return typeof window !== "undefined"
			&& typeof window.matchMedia === "function"
			&& window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	}
}
