"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineManim3D
// ─────────────────────────────────────────────────────────────────────────────

import {
	memo,
	useEffect,
	useRef,
	type CSSProperties,
} from "react";
import type { Manim3DConfig } from "./manimTypes";
import { routeAnimation, sampleBoneTrack } from "./manimAnimationRouter";

type ThreeModule = typeof import("three");
type ThreeObject = InstanceType<ThreeModule["Object3D"]>;

type BoneBaseState = {
	position: [number, number, number];
	rotation: [number, number, number];
	scale: [number, number, number];
};

export interface EngineManim3DProps {
	cprop: { manim3d: Manim3DConfig };
	width?: number;
	height?: number;
	className?: string;
	style?: CSSProperties;
}

function toRad(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

function resolveThreeColor(color: string, THREE: ThreeModule): InstanceType<ThreeModule["Color"]> {
	// Three.js cannot resolve CSS custom properties from a WebGL canvas. Keep the
	// fallback explicit instead of handing `var(...)` to THREE.Color and throwing.
	return new THREE.Color(color.startsWith("var(") ? "#ffffff" : color);
}

function disposeObjectTree(root: ThreeObject): void {
	const disposedTextures = new Set<unknown>();
	const disposedMaterials = new Set<unknown>();
	const disposedGeometries = new Set<unknown>();

	root.traverse((child: any) => {
		const geometry = child.geometry;
		if (geometry?.dispose && !disposedGeometries.has(geometry)) {
			disposedGeometries.add(geometry);
			geometry.dispose();
		}

		const materials = Array.isArray(child.material) ? child.material : [child.material];
		for (const material of materials) {
			if (!material || disposedMaterials.has(material)) continue;
			disposedMaterials.add(material);
			for (const value of Object.values(material)) {
				if ((value as any)?.isTexture && !disposedTextures.has(value)) {
					disposedTextures.add(value);
					(value as any).dispose?.();
				}
			}
			material.dispose?.();
		}
	});
}

function setWireframe(root: ThreeObject, enabled: boolean): void {
	if (!enabled) return;
	root.traverse((child: any) => {
		if (!child.isMesh) return;
		const materials = Array.isArray(child.material) ? child.material : [child.material];
		for (const material of materials) {
			if (material && "wireframe" in material) material.wireframe = true;
		}
	});
}

export const EngineManim3D = memo(function EngineManim3D({
	cprop,
	width,
	height,
	className,
	style,
}: EngineManim3DProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const cfg = cprop.manim3d;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		let disposed = false;
		let cleanupInitializedRuntime: (() => void) | undefined;

		async function init(): Promise<(() => void) | undefined> {
			const THREE = await import("three");
			if (disposed) return undefined;

			const format = cfg.format ?? (cfg.src.toLowerCase().endsWith(".obj") ? "obj" : "gltf");
			const measuredWidth = width ?? canvas.clientWidth;
			const measuredHeight = height ?? canvas.clientHeight;
			const initialWidth = Math.max(1, measuredWidth || 800);
			const initialHeight = Math.max(1, measuredHeight || 600);

			const renderer = new THREE.WebGLRenderer({
				canvas,
				antialias: true,
				alpha: true,
				powerPreference: "high-performance",
			});
			renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
			renderer.shadowMap.enabled = cfg.settings?.shadows ?? false;
			renderer.shadowMap.type = THREE.PCFSoftShadowMap;
			renderer.setSize(initialWidth, initialHeight, false);

			const scene = new THREE.Scene();
			if (cfg.settings?.background && cfg.settings.background !== "transparent") {
				scene.background = resolveThreeColor(cfg.settings.background, THREE);
			}

			const cameraConfig = cfg.camera ?? {};
			const camera = new THREE.PerspectiveCamera(
				cameraConfig.fov ?? 60,
				initialWidth / initialHeight,
				cameraConfig.near ?? 0.1,
				cameraConfig.far ?? 1000,
			);
			const cameraPosition = cameraConfig.position ?? [0, 2, 5];
			camera.position.set(...cameraPosition);

			const lights = cfg.lights ?? [
				{ type: "ambient", intensity: 0.4, color: "#ffffff" },
				{ type: "directional", intensity: 0.8, direction: [1, -1, 0.5] },
			];
			for (const lightConfig of lights) {
				const color = resolveThreeColor(lightConfig.color ?? "#ffffff", THREE);
				switch (lightConfig.type) {
					case "ambient":
					scene.add(new THREE.AmbientLight(color, lightConfig.intensity ?? 0.4));
					break;
					case "directional": {
						const light = new THREE.DirectionalLight(color, lightConfig.intensity ?? 0.8);
						if (lightConfig.direction) {
							const direction = lightConfig.direction;
							light.position.set(-direction[0], -direction[1], -direction[2]).normalize();
						}
						light.castShadow = lightConfig.castShadow ?? false;
						scene.add(light);
						break;
					}
					case "point": {
						const light = new THREE.PointLight(color, lightConfig.intensity ?? 1);
						if (lightConfig.position) light.position.set(...lightConfig.position);
						scene.add(light);
						break;
					}
					case "spot": {
						const light = new THREE.SpotLight(color, lightConfig.intensity ?? 1);
						if (lightConfig.position) light.position.set(...lightConfig.position);
						scene.add(light);
						break;
					}
				}
			}

			let modelRoot: ThreeObject | null = null;
			let mixer: InstanceType<ThreeModule["AnimationMixer"]> | null = null;
			let activeAction: InstanceType<ThreeModule["AnimationAction"]> | null = null;
			const boneMap = new Map<string, any>();
			const boneBaseState = new Map<string, BoneBaseState>();
			let boneTracks: ReturnType<typeof routeAnimation>["boneTracks"] = [];
			let lookTarget: any = null;

			if (format === "obj") {
				const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
				if (disposed) {
					renderer.dispose();
					return undefined;
				}
				modelRoot = await new OBJLoader().loadAsync(cfg.src);
			} else {
				const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
				if (disposed) {
					renderer.dispose();
					return undefined;
				}
				const gltf = await new GLTFLoader().loadAsync(cfg.src);
				modelRoot = gltf.scene;

				modelRoot.traverse((object: any) => {
					if (!object.isBone) return;
					boneMap.set(object.name, object);
					boneBaseState.set(object.name, {
						position: [object.position.x, object.position.y, object.position.z],
						rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
						scale: [object.scale.x, object.scale.y, object.scale.z],
					});
				});

				if (cfg.animation) {
					const route = routeAnimation(cfg.animation, 240);
					boneTracks = route.boneTracks;
					if (route.clipName && gltf.animations.length > 0) {
						const clip = gltf.animations.find((candidate: any) => candidate.name === route.clipName)
							?? gltf.animations[0];
						if (clip) {
							mixer = new THREE.AnimationMixer(modelRoot);
							activeAction = mixer.clipAction(clip);
							activeAction.timeScale = route.clipSpeed;
							activeAction.play();
						}
					}
				}

				const lookContent = cfg.camera?.look?.content;
				if (typeof lookContent === "string") lookTarget = boneMap.get(lookContent) ?? null;
			}

			if (!modelRoot) {
				renderer.dispose();
				return undefined;
			}

			if (disposed) {
				disposeObjectTree(modelRoot);
				renderer.dispose();
				return undefined;
			}

			setWireframe(modelRoot, cfg.settings?.wireframe ?? false);
			scene.add(modelRoot);

			let raf = 0;
			let nearViewport = true;
			let documentVisible = !document.hidden;
			let running = false;
			const clock = new THREE.Clock(false);
			const fpsInterval = 1 / Math.max(1, cfg.settings?.fps ?? 60);
			let fpsAccumulator = 0;
			let sourceAnimationTime = 0;
			const sourceDuration = 240 / Math.max(1, cfg.settings?.fps ?? 60);
			const continuous = Boolean(mixer || boneTracks.length > 0);

			const applyBoneTracks = (normalTime: number): void => {
				for (const track of boneTracks) {
					const bone = boneMap.get(track.bone);
					if (!bone) continue;
					const sampled = sampleBoneTrack(track, normalTime);
					const base = boneBaseState.get(track.bone);

					if (sampled.move) {
						if (track.mode === "additive") {
							const origin = mixer ? [bone.position.x, bone.position.y, bone.position.z] : (base?.position ?? [0, 0, 0]);
							bone.position.set(
								origin[0] + sampled.move[0],
								origin[1] + sampled.move[1],
								origin[2] + sampled.move[2],
							);
						} else {
							bone.position.set(...sampled.move);
						}
					}

					if (sampled.rotate) {
						const rotation = sampled.rotate.map(toRad) as [number, number, number];
						if (track.mode === "additive") {
							const origin = mixer ? [bone.rotation.x, bone.rotation.y, bone.rotation.z] : (base?.rotation ?? [0, 0, 0]);
							bone.rotation.set(origin[0] + rotation[0], origin[1] + rotation[1], origin[2] + rotation[2]);
						} else {
							bone.rotation.set(...rotation);
						}
					}

					if (sampled.scale) {
						if (track.mode === "additive") {
							const origin = mixer ? [bone.scale.x, bone.scale.y, bone.scale.z] : (base?.scale ?? [1, 1, 1]);
							bone.scale.set(
								origin[0] * sampled.scale[0],
								origin[1] * sampled.scale[1],
								origin[2] * sampled.scale[2],
							);
						} else {
							bone.scale.set(...sampled.scale);
						}
					}
				}
			};

			const updateCameraConstraint = (): void => {
				if (lookTarget) {
					const worldPosition = new THREE.Vector3();
					lookTarget.getWorldPosition(worldPosition);
					camera.lookAt(worldPosition);
				} else if (Array.isArray(cfg.camera?.look?.content)) {
					camera.lookAt(...(cfg.camera!.look!.content as [number, number, number]));
				}
			};

			const renderOnce = (): void => {
				if (disposed || !nearViewport || !documentVisible) return;
				updateCameraConstraint();
				renderer.render(scene, camera);
			};

			const tick = (): void => {
				if (disposed || !running) return;
				if (!nearViewport || !documentVisible) {
					running = false;
					clock.stop();
					return;
				}

				const delta = Math.min(clock.getDelta(), 0.1);
				fpsAccumulator += delta;
				if (fpsAccumulator >= fpsInterval) {
					const step = fpsAccumulator;
					fpsAccumulator %= fpsInterval;
					if (mixer) mixer.update(step);
					sourceAnimationTime += step;

					if (boneTracks.length > 0) {
						const clipDuration = activeAction?.getClip()?.duration;
						const duration = Math.max(0.001, clipDuration ?? sourceDuration);
						const normalTime = (mixer ? mixer.time : sourceAnimationTime) % duration / duration;
						applyBoneTracks(normalTime);
					}
					updateCameraConstraint();
					renderer.render(scene, camera);
				}

				raf = requestAnimationFrame(tick);
			};

			const startLoop = (): void => {
				if (!continuous) {
					renderOnce();
					return;
				}
				if (running || disposed || !nearViewport || !documentVisible) return;
				running = true;
				fpsAccumulator = 0;
				clock.start();
				raf = requestAnimationFrame(tick);
			};

			const stopLoop = (): void => {
				if (!running && raf === 0) return;
				running = false;
				cancelAnimationFrame(raf);
				raf = 0;
				clock.stop();
			};

			const resizeObserver = new ResizeObserver(() => {
				const nextWidth = Math.max(1, (width ?? canvas.clientWidth) || initialWidth);
				const nextHeight = Math.max(1, (height ?? canvas.clientHeight) || initialHeight);
				camera.aspect = nextWidth / nextHeight;
				camera.updateProjectionMatrix();
				renderer.setSize(nextWidth, nextHeight, false);
				if (!continuous) renderOnce();
			});
			resizeObserver.observe(canvas.parentElement ?? canvas);

			const intersectionObserver = new IntersectionObserver(([entry]) => {
				nearViewport = entry.isIntersecting;
				if (nearViewport) startLoop();
				else stopLoop();
			}, { rootMargin: "200px 0px", threshold: 0.01 });
			intersectionObserver.observe(canvas);

			const onVisibilityChange = (): void => {
				documentVisible = !document.hidden;
				if (documentVisible) startLoop();
				else stopLoop();
			};
			document.addEventListener("visibilitychange", onVisibilityChange);

			startLoop();

			return () => {
				stopLoop();
				resizeObserver.disconnect();
				intersectionObserver.disconnect();
				document.removeEventListener("visibilitychange", onVisibilityChange);
				mixer?.stopAllAction();
				if (mixer && modelRoot) mixer.uncacheRoot(modelRoot);
				disposeObjectTree(modelRoot);
				renderer.dispose();
			};
		}

		void init()
			.then((cleanup) => {
				if (disposed) cleanup?.();
				else cleanupInitializedRuntime = cleanup;
			})
			.catch((error) => {
				if (!disposed) console.error("[EngineManim3D] Failed to initialize model renderer.", error);
			});

		return () => {
			disposed = true;
			cleanupInitializedRuntime?.();
		};
	}, [cfg, width, height]);

	const canvasStyle: CSSProperties = {
		display: "block",
		width: width ? `${width}px` : "100%",
		height: height ? `${height}px` : "100%",
		minHeight: height ? undefined : "150px",
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
