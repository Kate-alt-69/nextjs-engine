// Next.js Engine — server-only package surface
// Import from `nextjs-engine/server` in package consumers.

export { EngineServer, EngineServerSession } from "./core/EngineServer";
export type {
	EngineServerCookieView,
	EngineServerFetchOptions,
	EngineServerHeaderView,
} from "./core/EngineServer";
export { getServerDevice } from "./core/EngineDeviceServer";
export { detectDevice, DESKTOP_DEVICE } from "./core/EngineDeviceShared";
export type { DeviceBrand, DeviceInfo, DeviceOS } from "./core/EngineDeviceShared";

export { EngineCORS, EngineCORSRuleSet } from "./core/EngineCORS";
export type { EngineCORSConfig } from "./core/EngineCORS";

export {
	executeRegisteredEngineCommand,
	getEngineCommandBuildDescriptors,
	getRegisteredEngineCommand,
	inspectEngineCommands,
	validateEngineCommandInput,
} from "./core/nenc/EngineCommand";
export { createNENCDispatcher } from "./core/nenc/NENCDispatcher";
export { createNENCAccountPolicy, isNENCAccountPrincipal } from "./core/nenc/NENCAccountPolicy";
export type {
	NENCAccountPermissionWildcards,
	NENCAccountPolicy,
	NENCAccountPolicyOptions,
	NENCAccountPrincipal,
	NENCAccountSession,
	NENCAccountSessionRejection,
} from "./core/nenc/NENCAccountPolicy";
export { createNENCDeviceSignatureVerifier } from "./core/nenc/NENCDeviceProof";
export type {
	NENCDeviceIdentityContext,
	NENCDeviceSignatureVerifier,
	NENCDeviceSignatureVerifierOptions,
	NENCVerifiedDeviceKeySource,
} from "./core/nenc/NENCDeviceProof";
export { NENCReplayGuard, NENCMemoryReplayStore } from "./core/nenc/NENCReplay";
export type {
	NENCAuthenticationContext,
	NENCAuthenticationResult,
	NENCAuthorizationContext,
	NENCDispatcherOptions,
	NENCRequestHandler,
	NENCSignatureContext,
} from "./core/nenc/NENCDispatcherTypes";
export type {
	NENCReplayDecision,
	NENCReplayGuardOptions,
	NENCReplayStore,
} from "./core/nenc/NENCReplay";
export type {
	EngineCommandInputField,
	EngineCommandInputSchema,
	EngineCommandInputType,
	EngineCommandServerContext,
} from "./core/nenc/types";
export type { NENCServerCommand, NENCServerManifest, NENCWireHeaders } from "./core/nenc/NENCManifest";
