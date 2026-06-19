// ─────────────────────────────────────────────────────────────────────────────
//  Engine — manimAnimationRouter  (Tier 2.5)
//
//  Routes a Manim3DConfig animation between two sources:
//
//    "file"   → Play the named GLTF clip. Per-bone overrides can replace or
//               additively layer on top of the file's keyframe tracks.
//
//    "source" → Ignore GLTF clips entirely. DSL frames drive all bone
//               transforms directly.
//
//  The result is a flat list of ResolvedBoneTrack entries that EngineManim3D
//  applies to the Three.js skeleton each frame.
// ─────────────────────────────────────────────────────────────────────────────

import type {
	ManimAnimationRoute,
	ManimDSLFrameGroup,
	ManimBoneTransform,
	ResolvedBoneTrack,
	ResolvedKeyframe,
	RoutedAnimation,
	SampledBoneState,
} from "./manimTypes";
import { parseManimDSL } from "./manimDSLParser";

// Re-export so consumers can import from this module directly if needed
export type { ResolvedBoneTrack, ResolvedKeyframe, RoutedAnimation, SampledBoneState };

// ─────────────────────────────────────────────────────────────────────────────
//  Frame group → normalised keyframes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts DSL frame groups into normalised keyframes.
 * Normalisation requires the total animation duration in frames (FPS-aware).
 */
function framesToKeyframes(
	groups:       ManimDSLFrameGroup[],
	totalFrames:  number,
): Map<string, ResolvedKeyframe[]> {
	const boneMap = new Map<string, ResolvedKeyframe[]>();

	for (const group of groups) {
		const startT = group.frameStart / totalFrames;
		const endT   = group.frameEnd   / totalFrames;

		for (const transform of group.transforms) {
			if (!boneMap.has(transform.bone)) boneMap.set(transform.bone, []);

			const frames = boneMap.get(transform.bone)!;

			// Keyframe at start of frame group (hold from previous or default)
			frames.push({
				time:   startT,
				move:   transform.move,
				rotate: transform.rotate,
				scale:  transform.scale,
				easing: transform.easing,
			});
			// Keyframe at end of frame group (value applied)
			frames.push({
				time:   endT,
				move:   transform.move,
				rotate: transform.rotate,
				scale:  transform.scale,
				easing: transform.easing,
			});
		}
	}

	// Sort each bone's keyframes by time
	for (const [bone, kfs] of boneMap) {
		boneMap.set(bone, kfs.sort((a, b) => a.time - b.time));
	}

	return boneMap;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public router
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Route an animation config into a RoutedAnimation ready for EngineManim3D.
 *
 * @param route        The ManimAnimationRoute from the schema
 * @param totalFrames  Total frame count for normalisation (e.g. GLTF clip * FPS)
 */
export function routeAnimation(
	route:       ManimAnimationRoute,
	totalFrames: number = 240,
): RoutedAnimation {
	const boneTracks: ResolvedBoneTrack[] = [];

	// ── Resolve DSL frames ───────────────────────────────────────────────────
	let dslGroups: ManimDSLFrameGroup[] = [];

	if (route.source === "source" && route.dsl) {
		const parsed = parseManimDSL(route.dsl);
		dslGroups    = parsed.frames;
	}

	// ── Per-bone overrides (from schema overrides array) ─────────────────────
	if (route.overrides) {
		for (const override of route.overrides) {
			const kfMap = framesToKeyframes(override.frames, totalFrames);
			const kfs   = kfMap.get(override.bone);
			if (kfs) {
				boneTracks.push({
					bone:      override.bone,
					keyframes: kfs,
					mode:      override.mode,
				});
			}
		}
	}

	// ── Source DSL bone tracks ────────────────────────────────────────────────
	if (dslGroups.length > 0) {
		const kfMap = framesToKeyframes(dslGroups, totalFrames);
		for (const [bone, keyframes] of kfMap) {
			// Don't double-add if already present as an override
			if (!boneTracks.find((t) => t.bone === bone)) {
				boneTracks.push({ bone, keyframes, mode: "replace" });
			}
		}
	}

	return {
		clipName:  route.source === "file" ? (route.clip ?? undefined) : undefined,
		clipSpeed: route.speed ?? 1.0,
		boneTracks,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
//  Frame interpolator — called per RAF by EngineManim3D
// ─────────────────────────────────────────────────────────────────────────────

type Vec3 = [number, number, number];

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Sample a bone track at normalised time t (0.0 – 1.0).
 * Interpolates between the surrounding keyframes.
 */
export function sampleBoneTrack(
	track: ResolvedBoneTrack,
	t:     number,
): SampledBoneState {
	const kfs = track.keyframes;
	if (kfs.length === 0) return {};

	// Before first keyframe — return first
	if (t <= kfs[0].time) {
		return { move: kfs[0].move, rotate: kfs[0].rotate, scale: kfs[0].scale };
	}
	// After last keyframe — return last
	if (t >= kfs[kfs.length - 1].time) {
		const last = kfs[kfs.length - 1];
		return { move: last.move, rotate: last.rotate, scale: last.scale };
	}

	// Find surrounding keyframes
	let lo = 0;
	for (let i = 0; i < kfs.length - 1; i++) {
		if (kfs[i].time <= t && kfs[i + 1].time >= t) { lo = i; break; }
	}
	const hi  = lo + 1;
	const span = kfs[hi].time - kfs[lo].time;
	const u    = span < 0.0001 ? 1 : (t - kfs[lo].time) / span;

	return {
		move:   kfs[lo].move && kfs[hi].move
			? lerpVec3(kfs[lo].move!, kfs[hi].move!, u)
			: (kfs[hi].move ?? kfs[lo].move),
		rotate: kfs[lo].rotate && kfs[hi].rotate
			? lerpVec3(kfs[lo].rotate!, kfs[hi].rotate!, u)
			: (kfs[hi].rotate ?? kfs[lo].rotate),
		scale:  kfs[lo].scale && kfs[hi].scale
			? lerpVec3(kfs[lo].scale!, kfs[hi].scale!, u)
			: (kfs[hi].scale ?? kfs[lo].scale),
	};
}