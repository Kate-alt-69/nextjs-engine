// Next.js Engine Generation 3 — client-safe network surface.
// Server dispatch/CORS helpers live in `nextjs-engine/server`.

export { EngineCookies, EngineCookieIndex, EngineTrustList } from "./core/enginecookies";
export type {
	EngineCookieAccessDecision,
	EngineCookieAccessRequest,
	EngineCookieAction,
	EngineCookieBindingMode,
	EngineCookieGrant,
	EngineCookieIndexEntry,
	EngineCookieRegistration,
	EngineTrustListConfig,
	EngineTrustRule,
	NativeCookieOptions,
} from "./core/enginecookies";

export {
	EngineCommand,
	configureEngineCommandTransport,
	registerEngineCommand,
} from "./core/nenc";
export type {
	EngineCommandAuth,
	EngineCommandDefinition,
	EngineCommandDescriptor,
	EngineCommandExecutionContext,
	EngineCommandHandle,
	EngineCommandRuntime,
	EngineCommandServerContext,
	EngineCommandTransport,
} from "./core/nenc";
