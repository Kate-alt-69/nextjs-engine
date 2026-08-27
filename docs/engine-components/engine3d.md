# Engine3D retained rendering

`Engine3D` is the Three.js-backed renderer used by EngineCanvas graphics mode when `graphics.engine` is `"3d"`.

It is retained-mode: EC node ids are used as renderer identity. Stable mesh/group ids reuse their Three.js objects across frames, while transform and material values update in place.

## Geometry invalidation

A retained mesh rebuilds its Three.js `BufferGeometry` when any of these change:

- the `vertices` typed-array reference;
- the `indices` typed-array reference;
- the EC topology.

Editing a typed array in place does not change its reference. Replace the array when geometry should be recompiled.

## Topology identity

`strip` meshes and surface meshes use different Three.js object/material types:

```text
EC topology = strip
	→ THREE.Line + LineBasicMaterial

EC topology = fan / triangles
	→ THREE.Mesh + MeshBasicMaterial
```

When a retained EC mesh keeps the same id but crosses that boundary, Engine3D discards the old retained object and recreates the correct Three.js object. Reusing a `THREE.Line` as a triangle surface, or a `THREE.Mesh` as a strip, is not valid.

Changing `fan` ↔ `triangles` does not require an object-type replacement because both are surface meshes; only their geometry is rebuilt.

## Node-type replacement

If an EC node keeps the same id but changes between `group` and `mesh`, the old Three.js object is detached from its parent before its GPU resources are disposed. This prevents dead/ghost objects from remaining in the Three.js scene graph.

Full renderer disposal also detaches retained objects before disposing their geometry/material resources.

## Mesh counts

`ECMesh.faceCount()` follows topology semantics:

- `strip` → `0` faces, even when indexed;
- indexed surface mesh → `floor(indices.length / 3)`;
- non-indexed `fan` → `max(0, vertexCount - 2)`;
- non-indexed `triangles` → `floor(vertexCount / 3)`.

This keeps model introspection consistent with the geometry rendered by Engine2D, Engine3D, and EngineSVG.
