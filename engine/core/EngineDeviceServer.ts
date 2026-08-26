// ─────────────────────────────────────────────────────────────────────────────
// EngineDeviceServer — Next.js request-aware device detection
// ─────────────────────────────────────────────────────────────────────────────

import {
	DESKTOP_DEVICE,
	detectDevice,
	type DeviceInfo,
} from "./EngineDeviceShared";

/**
 * Read the request User-Agent from Next.js headers.
 * Call only from a Server Component, Server Action, Route Handler, or another
 * request-aware server path. Returns desktop defaults outside that context.
 */
export async function getServerDevice(): Promise<DeviceInfo> {
	try {
		const { headers } = await import("next/headers");
		const userAgent = (await headers()).get("user-agent") ?? "";
		return detectDevice(userAgent);
	} catch {
		return DESKTOP_DEVICE;
	}
}
