import type { EngineShaderInput } from "../core/engineshader/EngineShaderTypes";

/**
 * Schema surfaces that can attach a compiled EngineShader program without
 * introducing an extra layout wrapper.
 */
export interface EngineShaderSurfaceProps {
	shader?: EngineShaderInput;
}

declare module "./types" {
	interface BoxProps extends EngineShaderSurfaceProps {}
	interface StackProps extends EngineShaderSurfaceProps {}
	interface GridProps extends EngineShaderSurfaceProps {}
	interface SectionProps extends EngineShaderSurfaceProps {}
	interface CardProps extends EngineShaderSurfaceProps {}
	interface CanvasNodeProps extends EngineShaderSurfaceProps {}
}
