// ============================================================================
// Engine3D.ts — Three.js-backed rendering engine
// ============================================================================
//
// Retained-mode renderer: EC nodes are compiled to Three.js objects once and
// then reused across frames. Transform/material changes are applied in-place;
// geometry is rebuilt only when its typed-array source changes. Removed nodes
// are disposed explicitly so GPU buffers and materials do not leak.
// ============================================================================

import type { ECCamera, ECGroup, ECMesh, ECNode, ECScene, ECTransform } from "./ECTypes";
import type { ECRenderContext, RenderingEngine } from "./RenderingEngine";

type ThreeModule = typeof import("three");
type IndexArray = Uint16Array | Uint32Array;

interface RetainedNode {
	type: ECNode["type"];
	object: any;
	geometry?: any;
	material?: any;
	rimMaterial?: any;
	rimMesh?: any;
	vertices?: Float32Array;
	indices?: IndexArray;
	topology?: ECMesh["topology"];
}

export class Engine3D implements RenderingEngine {
	public readonly name = "3d";

	private THREE: ThreeModule | null = null;
	private renderer: InstanceType<ThreeModule["WebGLRenderer"]> | null = null;
	private camera: InstanceType<ThreeModule["PerspectiveCamera"]> | null = null;
	private scene: InstanceType<ThreeModule["Scene"]> | null = null;
	private readonly retainedNodes = new Map<string, RetainedNode>();
	private width = 0;
	private height = 0;
	private dpr = 1;
	private backgroundValue: string | undefined;

	public async init(context: ECRenderContext): Promise<void> {
		const THREE = await import("three");
		this.THREE = THREE;
		this.width = context.width;
		this.height = context.height;
		this.dpr = context.dpr;

		this.renderer = new THREE.WebGLRenderer({
			canvas: context.canvas,
			...(context.gl ? { context: context.gl as WebGLRenderingContext } : {}),
			alpha: true,
			antialias: true,
			powerPreference: "high-performance",
		});
		this.renderer.setPixelRatio(this.dpr);
		this.renderer.setSize(this.width, this.height, false);

		this.camera = new THREE.PerspectiveCamera(60, this.width / Math.max(this.height, 1), 0.1, 1000);
		this.camera.position.set(0, 0, 5);
		this.scene = new THREE.Scene();
	}

	public resize(width: number, height: number, dpr = this.dpr): void {
		this.width = width;
		this.height = height;

		if (this.camera) {
			this.camera.aspect = width / Math.max(height, 1);
			this.camera.updateProjectionMatrix();
		}

		if (this.renderer) {
			if (dpr !== this.dpr) {
				this.dpr = dpr;
				this.renderer.setPixelRatio(dpr);
			}
			this.renderer.setSize(width, height, false);
		}
	}

	public render(ecScene: ECScene, _delta: number, _frame: number): void {
		if (!this.THREE || !this.renderer || !this.camera || !this.scene) return;

		this.applyEnvironment(ecScene);
		if (ecScene.camera) this.applyCamera(ecScene.camera);

		const seenIds = new Set<string>();
		for (const node of ecScene.children) {
			this.syncNode(node, this.scene, seenIds);
		}
		this.disposeMissingNodes(seenIds);

		this.renderer.render(this.scene, this.camera);
	}

	private applyEnvironment(ecScene: ECScene): void {
		const scene = this.scene;
		const THREE = this.THREE;
		if (!scene || !THREE) return;

		if (ecScene.environment === "void" || !ecScene.background) {
			if (this.backgroundValue !== undefined || scene.background !== null) {
				scene.background = null;
				this.backgroundValue = undefined;
			}
			scene.fog = null;
			return;
		}

		if (ecScene.background !== this.backgroundValue) {
			if (scene.background instanceof THREE.Color) {
				scene.background.set(ecScene.background);
			} else {
				scene.background = new THREE.Color(ecScene.background);
			}
			this.backgroundValue = ecScene.background;
		}
	}

	private applyCamera(cameraConfig: ECCamera): void {
		const camera = this.camera;
		if (!camera) return;

		camera.position.set(
			cameraConfig.position.x,
			cameraConfig.position.y,
			cameraConfig.position.z,
		);

		let projectionChanged = false;
		if (cameraConfig.fov !== undefined && camera.fov !== cameraConfig.fov) {
			camera.fov = cameraConfig.fov;
			projectionChanged = true;
		}
		if (cameraConfig.near !== undefined && camera.near !== cameraConfig.near) {
			camera.near = cameraConfig.near;
			projectionChanged = true;
		}
		if (cameraConfig.far !== undefined && camera.far !== cameraConfig.far) {
			camera.far = cameraConfig.far;
			projectionChanged = true;
		}
		if (projectionChanged) camera.updateProjectionMatrix();

		if (cameraConfig.lookAt) {
			camera.lookAt(cameraConfig.lookAt.x, cameraConfig.lookAt.y, cameraConfig.lookAt.z);
		}
	}

	private syncNode(node: ECNode, parent: any, seenIds: Set<string>): any {
		seenIds.add(node.id);

		let retained = this.retainedNodes.get(node.id);
		if (retained && retained.type !== node.type) {
			retained.object.parent?.remove?.(retained.object);
			this.disposeRetainedNode(retained);
			this.retainedNodes.delete(node.id);
			retained = undefined;
		}

		if (node.type === "group") {
			return this.syncGroup(node, parent, retained, seenIds);
		}
		return this.syncMesh(node, parent, retained);
	}

	private syncGroup(
		group: ECGroup,
		parent: any,
		retained: RetainedNode | undefined,
		seenIds: Set<string>,
	): any {
		const THREE = this.THREE;
		if (!THREE) return null;

		if (!retained) {
			const object = new THREE.Group();
			retained = { type: "group", object };
			this.retainedNodes.set(group.id, retained);
		}

		const object = retained.object;
		this.attachToParent(object, parent);
		this.applyTransform(object, group.transform);

		for (const child of group.children) {
			this.syncNode(child, object, seenIds);
		}

		return object;
	}

	private syncMesh(mesh: ECMesh, parent: any, retained?: RetainedNode): any {
		const THREE = this.THREE;
		if (!THREE) return null;

		const retainedIsStrip = retained?.topology === "strip";
		const nextIsStrip = mesh.topology === "strip";
		if (retained && retainedIsStrip !== nextIsStrip) {
			retained.object.parent?.remove?.(retained.object);
			this.disposeRetainedNode(retained);
			this.retainedNodes.delete(mesh.id);
			retained = undefined;
		}

		const geometryChanged = !retained
			|| retained.vertices !== mesh.vertices
			|| retained.indices !== mesh.indices
			|| retained.topology !== mesh.topology;

		if (!retained) {
			const geometry = this.createGeometry(mesh);
			const material = this.createMaterial(mesh);
			const object = nextIsStrip
				? new THREE.Line(geometry, material)
				: new THREE.Mesh(geometry, material);

			retained = {
				type: "mesh",
				object,
				geometry,
				material,
				vertices: mesh.vertices,
				indices: mesh.indices,
				topology: mesh.topology,
			};
			this.retainedNodes.set(mesh.id, retained);
		} else if (geometryChanged) {
			const oldGeometry = retained.geometry;
			const newGeometry = this.createGeometry(mesh);
			retained.geometry = newGeometry;
			retained.vertices = mesh.vertices;
			retained.indices = mesh.indices;
			retained.topology = mesh.topology;
			retained.object.geometry = newGeometry;
			if (retained.rimMesh) retained.rimMesh.geometry = newGeometry;
			oldGeometry?.dispose?.();
		}

		this.attachToParent(retained.object, parent);
		this.applyTransform(retained.object, mesh.transform);
		this.updateMaterial(retained, mesh);
		this.syncRim(retained, mesh);
		return retained.object;
	}

	private createGeometry(mesh: ECMesh): any {
		const THREE = this.THREE!;
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute("position", new THREE.BufferAttribute(mesh.vertices, 3));

		if (mesh.indices) {
			geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
		} else if (mesh.topology === "fan") {
			const vertexCount = mesh.vertices.length / 3;
			const triangleCount = Math.max(0, vertexCount - 2);
			const FanIndexArray = vertexCount > 65535 ? Uint32Array : Uint16Array;
			const fanIndices = new FanIndexArray(triangleCount * 3);
			for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex++) {
				const indexOffset = triangleIndex * 3;
				fanIndices[indexOffset] = 0;
				fanIndices[indexOffset + 1] = triangleIndex + 1;
				fanIndices[indexOffset + 2] = triangleIndex + 2;
			}
			geometry.setIndex(new THREE.BufferAttribute(fanIndices, 1));
		}

		return geometry;
	}

	private createMaterial(mesh: ECMesh): any {
		const THREE = this.THREE!;
		const materialConfig = mesh.material;

		if (mesh.topology === "strip") {
			return new THREE.LineBasicMaterial({
				color: materialConfig.stroke ?? materialConfig.fill ?? "#60a5fa",
				transparent: (materialConfig.opacity ?? 1) < 1,
				opacity: materialConfig.opacity ?? 1,
			});
		}

		return new THREE.MeshBasicMaterial({
			color: materialConfig.fill ?? "#60a5fa",
			transparent: (materialConfig.opacity ?? 1) < 1,
			opacity: materialConfig.opacity ?? 1,
		});
	}

	private updateMaterial(retained: RetainedNode, mesh: ECMesh): void {
		const material = retained.material;
		if (!material) return;

		const materialConfig = mesh.material;
		const color = mesh.topology === "strip"
			? materialConfig.stroke ?? materialConfig.fill ?? "#60a5fa"
			: materialConfig.fill ?? "#60a5fa";
		material.color?.set?.(color);

		const opacity = materialConfig.opacity ?? 1;
		const transparent = opacity < 1;
		if (material.transparent !== transparent) {
			material.transparent = transparent;
			material.needsUpdate = true;
		}
		material.opacity = opacity;
	}

	private syncRim(retained: RetainedNode, mesh: ECMesh): void {
		const THREE = this.THREE!;
		const rimEnabled = mesh.topology !== "strip"
			&& mesh.material.shading === "rim"
			&& Boolean(mesh.material.rimColor);

		if (!rimEnabled) {
			if (retained.rimMesh) {
				retained.object.remove(retained.rimMesh);
				retained.rimMaterial?.dispose?.();
				retained.rimMesh = undefined;
				retained.rimMaterial = undefined;
			}
			return;
		}

		if (!retained.rimMesh) {
			const rimMaterial = new THREE.MeshBasicMaterial({
				color: mesh.material.rimColor,
				side: THREE.BackSide,
				transparent: true,
				opacity: mesh.material.rimIntensity ?? 0.5,
			});
			const rimMesh = new THREE.Mesh(retained.geometry, rimMaterial);
			rimMesh.scale.setScalar(1.06);
			retained.object.add(rimMesh);
			retained.rimMaterial = rimMaterial;
			retained.rimMesh = rimMesh;
		}

		retained.rimMaterial.color.set(mesh.material.rimColor);
		retained.rimMaterial.opacity = mesh.material.rimIntensity ?? 0.5;
	}

	private attachToParent(object: any, parent: any): void {
		if (object.parent === parent) return;
		object.parent?.remove?.(object);
		parent.add(object);
	}

	private applyTransform(object: any, transform: ECTransform): void {
		object.position.set(transform.position.x, transform.position.y, transform.position.z);
		object.rotation.set(
			(transform.rotation.x * Math.PI) / 180,
			(transform.rotation.y * Math.PI) / 180,
			(transform.rotation.z * Math.PI) / 180,
		);
		object.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
	}

	private disposeMissingNodes(seenIds: Set<string>): void {
		for (const [nodeId, retained] of this.retainedNodes) {
			if (seenIds.has(nodeId)) continue;
			retained.object.parent?.remove?.(retained.object);
			this.disposeRetainedNode(retained);
			this.retainedNodes.delete(nodeId);
		}
	}

	private disposeRetainedNode(retained: RetainedNode): void {
		retained.geometry?.dispose?.();
		retained.material?.dispose?.();
		retained.rimMaterial?.dispose?.();
	}

	public dispose(): void {
		for (const retained of this.retainedNodes.values()) {
			retained.object.parent?.remove?.(retained.object);
			this.disposeRetainedNode(retained);
		}
		this.retainedNodes.clear();
		this.renderer?.dispose();
		this.renderer = null;
		this.scene = null;
		this.camera = null;
		this.THREE = null;
		this.backgroundValue = undefined;
	}
}
