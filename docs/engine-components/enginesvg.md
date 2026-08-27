# EngineSVG

`EngineSVGEngine` is the DOM-backed renderer for the EngineCanvas graphics model.
It consumes the same `ECScene` / `ECMesh` topology used by Engine2D and keeps SVG
DOM nodes retained between frames.

The implementation lives at:

```text
src/engine/core/enginecanvas/EngineSVG.ts
```

## Geometry fidelity

SVG mode follows the same mesh topology rules as Engine2D:

- `strip` follows the mesh vertex order, or `mesh.indices` when supplied;
- indexed non-strip meshes consume indices in triangle triples;
- `fan` meshes without indices expand from vertex `0` into triangle-fan triples;
- `triangles` meshes without indices consume sequential triples.

Triangle fills are emitted as closed SVG subpaths. Outlines are generated from
**boundary edges only**: edges shared by two triangles are not stroked as
internal seams. This keeps an indexed triangle mesh visually consistent between
Engine2D and EngineSVG.

For line strips, `material.stroke` is preferred. If no explicit stroke exists,
`material.fill` is used as the line colour, matching Engine2D's strip behavior.

## Retained geometry

Each retained mesh owns one SVG group with separate fill and outline paths.
Transforms, opacity, and material values update without recreating the group.

Geometry is rebuilt when any of these change by reference/value:

- `mesh.vertices` typed-array reference;
- `mesh.indices` typed-array reference;
- `mesh.topology`.

Replacing only the indices array is therefore enough to invalidate an indexed
mesh. Mutating a typed array in place follows the same stable-geometry contract
as the other retained EngineCanvas renderers: replace the typed array when the
renderer must rebuild geometry.

Removed scene ids remove their retained SVG groups. `dispose()` removes the SVG
surface and restores the Canvas element's previous `display` value.

## Scene background

Live SVG rendering includes `scene.background` when
`scene.environment !== "void"`.

`exportSVG(scene, width, height)` follows the same rule and emits a background
rectangle before scene nodes. `void` scenes remain transparent.

## SVG export

`exportSVG()` uses the same topology compiler as the retained live renderer, so
indexed triangle geometry and strip order do not diverge between the on-page SVG
surface and exported markup.

Material colour strings written into XML attributes are escaped before export.
This preserves valid XML when a colour/paint value contains XML-sensitive
characters instead of interpolating the raw string directly into an attribute.

## SVG import

`importSVG()` is browser-only because it requires `DOMParser`. It currently
imports these basic SVG elements:

- `path`;
- `circle`;
- `rect`;
- `line`;
- `polygon`.

`line` uses its native `x1`, `y1`, `x2`, and `y2` attributes. Imported shapes are
converted into EngineCanvas geometry through `ecPath()`.

The importer is intentionally a basic shape importer rather than a complete SVG
layout/CSS engine; unsupported SVG features should not be assumed to survive a
round trip.
