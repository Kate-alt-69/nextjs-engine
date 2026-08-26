// ============================================================================
// Engine3D.ts — Three.js-backed rendering engine
// ============================================================================
//
//  Primary purpose: interactive 3D scenes. Converts ECScene / ECMesh into
//  Three.js BufferGeometry + flat MeshBasicMaterial (artistic, not physically
//  based). Three.js is dynamically imported — only fetched on pages that
//  actually use engine: "3d".
//
//  This engine renders geometry only. It has NO bone/skeleton/animation API
//  — that responsibility belongs entirely to EngineManim3D, which is built
//  on top of raw Three.js separately and does not route through Engine3D.
// ============================================================================

import type { ECGroup, ECMesh, ECNode, ECScene, ECTransform } from "./ECTypes";
import type { ECRenderContext, RenderingEngine } from "./RenderingEngine";

// Three.js types are structurally duck-typed here to avoid a hard static
// import — the real module is loaded dynamically in init().
type ThreeModule = typeof import("three");

export class Engine3D implements RenderingEngine {

	public readonly name = "3d";

	private THREE:    ThreeModule | null = null;
	private renderer: InstanceType<ThreeModule["WebGLRenderer"]> | null = null;
	private camera:   InstanceType<ThreeModule["PerspectiveCamera"]> | null = null;
	private scene:    InstanceType<ThreeModule["Scene"]> | null = null;
	private width  = 0;
	private height = 0;

	// -------------------------------------------------------------------------

	public async init(context: ECRenderContext): Promise<void> {

		const THREE = await import("three");
		this.THREE  = THREE;

		this.width  = context.width;
		this.height = context.height;

		this.renderer = new THREE.WebGLRenderer({
			canvas:    context.canvas,
			alpha:     true,
			antialias: true,
		});
		this.renderer.setPixelRatio(context.dpr);
		this.renderer.setSize(this.width, this.height, false);

		this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
		this.camera.position.set(0, 0, 5);

		this.scene = new THREE.Scene();
		// Void environment: no scene.background, no fog assigned by default.

	}

	// -------------------------------------------------------------------------

	public resize(width: number, height: number): void {

		this.width  = width;
		this.height = height;

		if (this.camera) {
			this.camera.aspect = width / height;
			this.camera.updateProjectionMatrix();
		}

		this.renderer?.setSize(width, height, false);

	}

	// -------------------------------------------------------------------------

	public render(ecScene: ECScene, _delta: number, _frame: number): void {

		const THREE = this.THREE;
		if (!THREE || !this.renderer || !this.camera || !this.scene) return;

		// Rebuild the Three.js scene from the EC scene graph each frame.
		// ECScene objects are expected to be lightweight/stable — consumer
		// components are responsible for memoizing scene construction.
		this.scene.clear();

		this.applyEnvironment(ecScene);
		if (ecScene.camera) this.applyCamera(ecScene.camera);

		for (const node of ecScene.children) {
			const obj = this.buildNode(node);
			if (obj) this.scene.add(obj);
		}

		// Flat, high-contrast lighting only — no PBR.
		const ambient = new THREE.AmbientLight(0xffffff, 0.9);
		this.scene.add(ambient);

		this.renderer.render(this.scene, this.camera);

	}

	// -------------------------------------------------------------------------

	private applyEnvironment(ecScene: ECScene): void {

		if (!this.scene) return;

		if (ecScene.environment === "void") {
			// No background, no HDRI, no sky, no fog, no floor.
			this.scene.background = null;
			this.scene.fog        = null;
			return;
		}

		if (ecScene.background && this.THREE) {
			this.scene.background = new this.THREE.Color(ecScene.background);
		}

	}

	private applyCamera(cam: NonNullable<ECScene["camera"]>): void {

		if (!this.camera) return;

		this.camera.position.set(cam.position.x, cam.position.y, cam.position.z);
		if (cam.fov)  { this.camera.fov  = cam.fov;  this.camera.updateProjectionMatrix(); }
		if (cam.near) this.camera.near = cam.near;
		if (cam.far)  this.camera.far  = cam.far;

		if (cam.lookAt) {
			this.camera.lookAt(cam.lookAt.x, cam.lookAt.y, cam.lookAt.z);
		}

	}

	// -------------------------------------------------------------------------

	private buildNode(node: ECNode): InstanceType<ThreeModule["Object3D"]> | null {

		if (node.type === "group") return this.buildGroup(node);
		return this.buildMesh(node);

	}

	private buildGroup(group: ECGroup): InstanceType<ThreeModule["Group"]> | null {

		const THREE = this.THREE;
		if (!THREE) return null;

		const g = new THREE.Group();
		this.applyTransform(g, group.transform);

		for (const child of group.children) {
			const obj = this.buildNode(child);
			if (obj) g.add(obj);
		}

		return g;

	}

	private buildMesh(mesh: ECMesh): InstanceType<ThreeModule["Mesh"]> | null {

		const THREE = this.THREE;
		if (!THREE) return null;

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute("position", new THREE.BufferAttribute(mesh.vertices, 3));

		if (mesh.indices) {
			geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
		} else if (mesh.topology === "fan") {
			geometry.computeVertexNormals();
		}

		if (!mesh.indices) geometry.computeVertexNormals();

		const mat = mesh.material;

		// Flat/artistic material — never physically-based.
		const material = new THREE.MeshBasicMaterial({
			color:       mat.fill ?? "#60a5fa",
			transparent: (mat.opacity ?? 1) < 1,
			opacity:     mat.opacity ?? 1,
			wireframe:   mesh.topology === "strip",
		});

		const threeMesh = new THREE.Mesh(geometry, material);
		this.applyTransform(threeMesh, mesh.transform);

		// Rim-light hack: a slightly enlarged backside shell in rimColor,
		// the standard cheap toon rim-light technique — flat, not PBR.
		if (mat.shading === "rim" && mat.rimColor) {
			const rimMat = new THREE.MeshBasicMaterial({
				color: mat.rimColor,
				side:  THREE.BackSide,
				transparent: true,
				opacity: mat.rimIntensity ?? 0.5,
			});
			const rimMesh = new THREE.Mesh(geometry, rimMat);
			rimMesh.scale.multiplyScalar(1.06);
			threeMesh.add(rimMesh);
		}

		return threeMesh;

	}

	private applyTransform(
		obj: InstanceType<ThreeModule["Object3D"]>,
		t:   ECTransform,
	): void {

		obj.position.set(t.position.x, t.position.y, t.position.z);
		obj.rotation.set(
			(t.rotation.x * Math.PI) / 180,
			(t.rotation.y * Math.PI) / 180,
			(t.rotation.z * Math.PI) / 180,
		);
		obj.scale.set(t.scale.x, t.scale.y, t.scale.z);

	}

	// -------------------------------------------------------------------------

	public dispose(): void {

		this.renderer?.dispose();
		this.renderer = null;
		this.scene    = null;
		this.camera   = null;
		this.THREE    = null;

	}

}
