import type { ECScene } from "./ECTypes";
export type ECRenderContextType = "2d" | "webgl" | "webgl2" | "auto";
export interface ECRenderContext { canvas: HTMLCanvasElement; ctx2d?: CanvasRenderingContext2D; gl?: WebGLRenderingContext | WebGL2RenderingContext; width: number; height: number; dpr: number; }
export interface RenderingEngine { readonly name: string; readonly contextType?: ECRenderContextType; init(context: ECRenderContext): void | Promise<void>; render(scene: ECScene, delta: number, frame: number): void; resize(width: number, height: number, dpr?: number): void; dispose(): void; }
