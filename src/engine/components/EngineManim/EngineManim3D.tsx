"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineManim3D  (Tiers 1–4)
//
//  Three.js-based 3D renderer integrated with the EngineManim DSL.
//
//  Tier 1 — Static GLTF/GLB/OBJ mesh via WebGL
//  Tier 2 — GLTF built-in animation clip playback
//  Tier 2.5 — Animation routing: file clip | source DSL | per-bone overrides
//  Tier 3 — DSL frame() blocks driving bone transforms
//  Tier 4 — Constraint bindings: camera.look.content = boneName
//
//  Three.js is dynamically imported so it only ships to pages that use manim3d.
//
//  Schema type: "manim3d"
// ─────────────────────────────────────────────────────────────────────────────

import {
	useRef,
	useEffect,
	memo,
	type CSSProperties,
} from "react";
import type { Manim3DConfig }          from "./manimTypes";
import { parseManimDSL }               from "./manimDSLParser";
import { routeAnimation, sampleBoneTrack } from "./manimAnimationRouter";

// ─────────────────────────────────────────────────────────────────────────────
//  Props
// ─────────────────────────────────────────────────────────────────────────────

export interface EngineManim3DProps {
	cprop: { manim3d: Manim3DConfig };
	width?:     number;
	height?:    number;
	className?: string;
	style?:     CSSProperties;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function hexToThreeColor(color: string, THREE: any): any {
	return new THREE.Color(color.startsWith("var(") ? "#ffffff" : color);
}

function toRad(deg: number): number {
	return (deg * Math.PI) / 180;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────────────────────

export const EngineManim3D = memo(function EngineManim3D({
	cprop,
	width,
	height,
	className,
	style,
}: EngineManim3DProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const cfg       = cprop.manim3d;

	useEffect(() => {
		if (!canvasRef.current) return;
		const canvas = canvasRef.current;
		let   raf    = 0;
		let   stopped = false;

		// ── Dynamic imports — keep Three.js out of main bundle ────────────────
		async function init() {
			const THREE       = await import("three.js" as any);
			const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js" as any);
			const { OBJLoader }  = await import("three/examples/jsm/loaders/OBJLoader.js"  as any);

			// ── Renderer ──────────────────────────────────────────────────────
			const renderer = new THREE.WebGLRenderer({
				canvas,
				antialias: true,
				alpha:     true,
				powerPreference: "high-performance",
			});
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
			renderer.shadowMap.enabled = cfg.settings?.shadows ?? false;
			renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

			const w = width  ?? canvas.clientWidth  ?? 800;
			const h = height ?? canvas.clientHeight ?? 600;
			renderer.setSize(w, h, false);

			// ── Scene ─────────────────────────────────────────────────────────
			const scene = new THREE.Scene();
			if (cfg.settings?.background && cfg.settings.background !== "transparent") {
				scene.background = hexToThreeColor(cfg.settings.background, THREE);
			}

			// ── Camera ────────────────────────────────────────────────────────
			const camCfg = cfg.camera ?? {};
			const camera = new THREE.PerspectiveCamera(
				camCfg.fov  ?? 60,
				w / h,
				camCfg.near ?? 0.1,
				camCfg.far  ?? 1000,
			);
			const camPos = camCfg.position ?? [0, 2, 5];
			camera.position.set(camPos[0], camPos[1], camPos[2]);

			// ── Lights ────────────────────────────────────────────────────────
			const lights = cfg.lights ?? [
				{ type: "ambient",     intensity: 0.4, color: "#ffffff" },
				{ type: "directional", intensity: 0.8, direction: [1, -1, 0.5] },
			];

			for (const lCfg of lights) {
				const color = hexToThreeColor(lCfg.color ?? "#ffffff", THREE);
				switch (lCfg.type) {
					case "ambient": {
						scene.add(new THREE.AmbientLight(color, lCfg.intensity ?? 0.4));
						break;
					}
					case "directional": {
						const dl = new THREE.DirectionalLight(color, lCfg.intensity ?? 0.8);
						if (lCfg.direction) {
							const d = lCfg.direction;
							dl.position.set(-d[0], -d[1], -d[2]).normalize();
						}
						dl.castShadow = lCfg.castShadow ?? false;
						scene.add(dl);
						break;
					}
					case "point": {
						const pl = new THREE.PointLight(color, lCfg.intensity ?? 1);
						if (lCfg.position) pl.position.set(...lCfg.position);
						scene.add(pl);
						break;
					}
					case "spot": {
						const sl = new THREE.SpotLight(color, lCfg.intensity ?? 1);
						if (lCfg.position) sl.position.set(...lCfg.position);
						scene.add(sl);
						break;
					}
				}
			}

			// ── Load model ────────────────────────────────────────────────────
			let mixer:     any       = null; // THREE.AnimationMixer
			let boneMap:   Map<string, any>  = new Map();
			let gltfClips: any[]     = [];
			let activeAction: any    = null;

			const fmt = cfg.format ?? (cfg.src.endsWith(".obj") ? "obj" : "gltf");

			if (fmt === "obj") {
				const loader   = new OBJLoader();
				const object   = await loader.loadAsync(cfg.src);
				if (cfg.settings?.wireframe) {
					object.traverse((child: any) => {
						if (child.isMesh) child.material.wireframe = true;
					});
				}
				scene.add(object);

			} else {
				// GLTF / GLB
				const loader   = new GLTFLoader();
				const gltf     = await loader.loadAsync(cfg.src);
				const model    = gltf.scene;
				gltfClips      = gltf.animations ?? [];

				if (cfg.settings?.wireframe) {
					model.traverse((child: any) => {
						if (child.isMesh) child.material.wireframe = true;
					});
				}
				scene.add(model);

				// Build bone name → THREE.Bone map for DSL access
				model.traverse((obj: any) => {
					if (obj.isBone) boneMap.set(obj.name, obj);
				});

				// ── Tier 2: GLTF clip playback ────────────────────────────────
				if (gltfClips.length > 0 && cfg.animation) {
					mixer = new THREE.AnimationMixer(model);
					const route   = routeAnimation(cfg.animation, 240);

					if (route.clipName) {
						const clip = gltfClips.find((c: any) => c.name === route.clipName)
							?? gltfClips[0];
						if (clip) {
							activeAction = mixer.clipAction(clip);
							activeAction.timeScale = route.clipSpeed;
							activeAction.play();
						}
					}

					// ── Tier 2.5 / 3: Per-bone DSL overrides ─────────────────
					if (route.boneTracks.length > 0) {
						// Stored for per-frame sampling in the RAF loop
						(renderer as any).__engineBoneTracks = route.boneTracks;
					}
				}

				// ── Tier 4: Camera constraint — camera.look.content = boneName ─
				const lookContent = cfg.camera?.look?.content;
				if (lookContent && typeof lookContent === "string") {
					(renderer as any).__engineLookTarget = boneMap.get(lookContent) ?? null;
				}
			}

			// ── ResizeObserver ────────────────────────────────────────────────
			const ro = new ResizeObserver(() => {
				const pw = canvas.clientWidth;
				const ph = canvas.clientHeight;
				camera.aspect = pw / ph;
				camera.updateProjectionMatrix();
				renderer.setSize(pw, ph, false);
			});
			ro.observe(canvas.parentElement ?? canvas);

			// ── IntersectionObserver (pause when off-screen) ──────────────────
			let visible = true;
			const io = new IntersectionObserver(
				([entry]) => { visible = entry.isIntersecting; },
				{ threshold: 0.01 },
			);
			io.observe(canvas);

			// ── RAF loop ──────────────────────────────────────────────────────
			const clock  = new THREE.Clock();
			const fpsInterval = 1 / (cfg.settings?.fps ?? 60);
			let   fpsAccum    = 0;

			function tick() {
				if (stopped) return;
				raf = requestAnimationFrame(tick);
				if (!visible) return;

				const delta = clock.getDelta();
				fpsAccum += delta;
				if (fpsAccum < fpsInterval) return;
				fpsAccum = 0;

				// Advance GLTF mixer
				if (mixer) mixer.update(delta);

				// ── Tier 3: Apply DSL bone transforms ────────────────────────
				const boneTracks = (renderer as any).__engineBoneTracks;
				if (boneTracks && mixer) {
					const normalT = (mixer.time % (activeAction?.getClip()?.duration ?? 1))
						/ (activeAction?.getClip()?.duration ?? 1);

					for (const track of boneTracks) {
						const bone = boneMap.get(track.bone);
						if (!bone) continue;
						const state = sampleBoneTrack(track, normalT);

						if (state.move) {
							bone.position.x += state.move[0] * (track.mode === "additive" ? 1 : 0);
							if (track.mode === "replace") bone.position.set(...state.move);
						}
						if (state.rotate) {
							bone.rotation.set(
								toRad(state.rotate[0]),
								toRad(state.rotate[1]),
								toRad(state.rotate[2]),
							);
						}
						if (state.scale) {
							bone.scale.set(...state.scale);
						}
					}
				}

				// ── Tier 4: Camera look constraint ────────────────────────────
				const lookTarget = (renderer as any).__engineLookTarget;
				if (lookTarget) {
					const worldPos = new THREE.Vector3();
					lookTarget.getWorldPosition(worldPos);
					camera.lookAt(worldPos);
				} else if (cfg.camera?.look?.content && Array.isArray(cfg.camera.look.content)) {
					camera.lookAt(...(cfg.camera.look.content as [number, number, number]));
				}

				renderer.render(scene, camera);
			}

			tick();

			// Cleanup
			return () => {
				stopped = true;
				cancelAnimationFrame(raf);
				ro.disconnect();
				io.disconnect();
				renderer.dispose();
			};
		}

		let cleanup: (() => void) | undefined;
		init().then((fn) => { cleanup = fn; });

		return () => {
			stopped = true;
			cancelAnimationFrame(raf);
			cleanup?.();
		};
	}, [cfg, width, height]);

	const canvasStyle: CSSProperties = {
		display: "block",
		width:   width  ? `${width}px`  : "100%",
		height:  height ? `${height}px` : "100%",
		...style,
	};

	return (
		<canvas
			ref={canvasRef}
			className={className}
			style={canvasStyle}
			width={width}
			height={height}
		/>
	);
});
