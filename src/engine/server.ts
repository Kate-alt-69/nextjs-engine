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
