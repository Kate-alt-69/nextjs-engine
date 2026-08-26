"use client";
import { useEffect, useRef, memo, type CSSProperties } from "react";
import type { Manim3DConfig, ResolvedBoneTrack } from "./manimTypes";
import { routeAnimation, sampleBoneTrack } from "./manimAnimationRouter";
export interface EngineManim3DProps { cprop: { manim3d: Manim3DConfig; }; width?: number; height?: number; className?: string; style?: CSSProperties; }
function hexToThreeColor(color: string, THREE: any): any { return new THREE.Color(color.startsWith("var(") ? "#ffffff" : color); }
function toRad(degrees: number): number { return degrees * Math.PI / 180; }
function disposeObject(root: any): void { root?.traverse?.((child: any) => { child.geometry?.dispose?.(); if (Array.isArray(child.material)) child.material.forEach((material: any) => material?.dispose?.()); else child.material?.dispose?.(); }); }
export const EngineManim3D = memo(function EngineManim3D({ cprop, width, height, className, style }: EngineManim3DProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const cfg = cprop.manim3d;
	useEffect(() => {
		const canvas = canvasRef.current; if (!canvas) return;
		let stopped = false; let raf = 0; let cleanup: (() => void) | undefined;
		const init = async (): Promise<(() => void) | undefined> => {
			const THREE = await import("three" as any);
			const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js" as any);
			const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js" as any);
			const { MTLLoader } = await import("three/examples/jsm/loaders/MTLLoader.js" as any);
			if (stopped) return;
			const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
			renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
			renderer.shadowMap.enabled = cfg.settings?.shadows ?? false;
			renderer.shadowMap.type = THREE.PCFSoftShadowMap;
			const measure = () => { const rect = canvas.getBoundingClientRect(); return { width: width ?? (rect.width > 0 ? rect.width : 800), height: height ?? (rect.height > 0 ? rect.height : 600) }; };
			const initialSize = measure(); renderer.setSize(initialSize.width, initialSize.height, false);
			const scene = new THREE.Scene(); if (cfg.settings?.background && cfg.settings.background !== "transparent") scene.background = hexToThreeColor(cfg.settings.background, THREE);
			const cameraConfig = cfg.camera ?? {}; const camera = new THREE.PerspectiveCamera(cameraConfig.fov ?? 60, initialSize.width / Math.max(1, initialSize.height), cameraConfig.near ?? .1, cameraConfig.far ?? 1000);
			const cameraPosition = cameraConfig.position ?? [0, 2, 5]; camera.position.set(cameraPosition[0], cameraPosition[1], cameraPosition[2]);
			const lights = cfg.lights ?? [{ type: "ambient", intensity: .4, color: "#ffffff" }, { type: "directional", intensity: .8, direction: [1, -1, .5] }];
			for (const lightConfig of lights) { const color = hexToThreeColor(lightConfig.color ?? "#ffffff", THREE); if (lightConfig.type === "ambient") scene.add(new THREE.AmbientLight(color, lightConfig.intensity ?? .4)); else if (lightConfig.type === "directional") { const light = new THREE.DirectionalLight(color, lightConfig.intensity ?? .8); if (lightConfig.direction) light.position.set(-lightConfig.direction[0], -lightConfig.direction[1], -lightConfig.direction[2]).normalize(); light.castShadow = lightConfig.castShadow ?? false; scene.add(light); } else if (lightConfig.type === "point") { const light = new THREE.PointLight(color, lightConfig.intensity ?? 1); if (lightConfig.position) light.position.set(...lightConfig.position); scene.add(light); } else if (lightConfig.type === "spot") { const light = new THREE.SpotLight(color, lightConfig.intensity ?? 1); if (lightConfig.position) light.position.set(...lightConfig.position); scene.add(light); } }
			let model: any = null; let mixer: any = null; let activeAction: any = null;
			const boneMap = new Map<string, any>(); const baseTransforms = new Map<string, { position: any; rotation: any; scale: any }>();
			const route = cfg.animation ? routeAnimation(cfg.animation, 240) : null; const format = cfg.format ?? (cfg.src.endsWith(".obj") ? "obj" : "gltf");
			if (format === "obj") { const objLoader = new OBJLoader(); if (cfg.mtlSrc) { const materials = await new MTLLoader().loadAsync(cfg.mtlSrc); materials.preload(); objLoader.setMaterials(materials); } model = await objLoader.loadAsync(cfg.src); }
			else { const gltf = await new GLTFLoader().loadAsync(cfg.src); model = gltf.scene; const clips = gltf.animations ?? []; model.traverse((object: any) => { if (object.isBone) boneMap.set(object.name, object); }); if (route?.clipName && clips.length) { const clip = clips.find((candidate: any) => candidate.name === route.clipName) ?? clips[0]; if (clip) { mixer = new THREE.AnimationMixer(model); activeAction = mixer.clipAction(clip); activeAction.timeScale = route.clipSpeed; if ((cfg.settings?.loop ?? true) === false) { activeAction.setLoop(THREE.LoopOnce, 1); activeAction.clampWhenFinished = true; } activeAction.play(); } } }
			if (stopped) { disposeObject(model); renderer.dispose(); return; }
			if (cfg.settings?.wireframe) model.traverse?.((child: any) => { if (child.isMesh && child.material) child.material.wireframe = true; });
			if (cfg.settings?.autoFrame) { const bounds = new THREE.Box3().setFromObject(model); const center = bounds.getCenter(new THREE.Vector3()); const size = bounds.getSize(new THREE.Vector3()); const maxDimension = Math.max(size.x, size.y, size.z, .001); model.position.sub(center); const fovRadians = toRad(camera.fov); const distance = maxDimension / (2 * Math.tan(Math.max(.01, fovRadians / 2))); camera.position.set(0, maxDimension * .28, distance * 1.45); camera.near = Math.max(.01, distance / 100); camera.far = Math.max(1000, distance * 20); camera.updateProjectionMatrix(); camera.lookAt(0, 0, 0); }
			scene.add(model);
			for (const track of route?.boneTracks ?? []) { const bone = boneMap.get(track.bone); if (bone) baseTransforms.set(track.bone, { position: bone.position.clone(), rotation: bone.rotation.clone(), scale: bone.scale.clone() }); }
			const lookTarget = typeof cfg.camera?.look?.content === "string" ? boneMap.get(cfg.camera.look.content) ?? null : null;
			const resizeObserver = new ResizeObserver(() => { const size = measure(); camera.aspect = size.width / Math.max(1, size.height); camera.updateProjectionMatrix(); renderer.setSize(size.width, size.height, false); }); resizeObserver.observe(canvas.parentElement ?? canvas);
			let visible = true; const intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? true; }, { threshold: .01 }); intersectionObserver.observe(canvas);
			const clock = new THREE.Clock(); const fpsInterval = 1 / Math.max(1, cfg.settings?.fps ?? 60); const sourceDuration = 240 / Math.max(1, cfg.settings?.fps ?? 60); let sourceElapsed = 0; let fpsAccum = 0; const tracks: ResolvedBoneTrack[] = route?.boneTracks ?? [];
			const applyTracks = (normalTime: number): void => { for (const track of tracks) { const bone = boneMap.get(track.bone); if (!bone) continue; const state = sampleBoneTrack(track, normalTime); const savedBase = baseTransforms.get(track.bone); const base = mixer ? { position: bone.position.clone(), rotation: bone.rotation.clone(), scale: bone.scale.clone() } : savedBase; if (track.mode === "replace") { if (state.move) bone.position.set(...state.move); if (state.rotate) bone.rotation.set(toRad(state.rotate[0]), toRad(state.rotate[1]), toRad(state.rotate[2])); if (state.scale) bone.scale.set(...state.scale); } else if (base) { if (state.move) bone.position.set(base.position.x + state.move[0], base.position.y + state.move[1], base.position.z + state.move[2]); else bone.position.copy(base.position); if (state.rotate) bone.rotation.set(base.rotation.x + toRad(state.rotate[0]), base.rotation.y + toRad(state.rotate[1]), base.rotation.z + toRad(state.rotate[2])); else bone.rotation.copy(base.rotation); if (state.scale) bone.scale.set(base.scale.x * state.scale[0], base.scale.y * state.scale[1], base.scale.z * state.scale[2]); else bone.scale.copy(base.scale); } } };
			const tick = () => { if (stopped) return; raf = requestAnimationFrame(tick); const delta = Math.min(.25, clock.getDelta()); if (!visible) return; fpsAccum += delta; if (fpsAccum < fpsInterval) return; const frameDelta = fpsAccum; fpsAccum = 0; if (mixer) mixer.update(frameDelta); const autoRotate = cfg.settings?.autoRotate; if (model && autoRotate) { const speed = typeof autoRotate === "number" ? autoRotate : .22; model.rotation.y += frameDelta * speed; } if (tracks.length) { let normalTime = 0; if (activeAction?.getClip?.()) { const duration = Math.max(.0001, activeAction.getClip().duration); normalTime = Math.min(1, activeAction.time / duration); } else { sourceElapsed += frameDelta * (route?.clipSpeed ?? 1); const raw = sourceElapsed / Math.max(.0001, sourceDuration); normalTime = cfg.settings?.loop ?? true ? raw % 1 : Math.min(1, raw); } applyTracks(normalTime); } if (lookTarget) { const worldPosition = new THREE.Vector3(); lookTarget.getWorldPosition(worldPosition); camera.lookAt(worldPosition); } else if (Array.isArray(cfg.camera?.look?.content)) camera.lookAt(...cfg.camera.look.content as [number, number, number]); renderer.render(scene, camera); };
			tick(); return () => { cancelAnimationFrame(raf); resizeObserver.disconnect(); intersectionObserver.disconnect(); mixer?.stopAllAction?.(); disposeObject(model); renderer.dispose(); };
		};
		void init().then((dispose) => { if (stopped) dispose?.(); else cleanup = dispose; }).catch((error) => { if (!stopped) console.error("[EngineManim3D] Failed to initialize:", error); });
		return () => { stopped = true; cancelAnimationFrame(raf); cleanup?.(); };
	}, [cfg, width, height]);
	return <canvas ref={canvasRef} className={className} style={{ display: "block", width: width ? `${width}px` : "100%", height: height ? `${height}px` : (style?.height ?? "600px"), minHeight: height ? undefined : "150px", ...style }} width={width} height={height} />;
});
