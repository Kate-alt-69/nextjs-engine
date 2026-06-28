// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineDevice
//
//  Device detection for mobile schema patching.
//  Safe on both server (via next/headers) and client (navigator.userAgent).
//
//  Detected brands:
//    Apple    → iPhone, iPad
//    Samsung  → Galaxy, GT-, SM- prefixes, SamsungBrowser UA token
//    Xiaomi   → MIUI, Redmi, Mi, HMNote (Xiaomi sub-brand)
//    Huawei   → Huawei, Honor
//    OnePlus  → OnePlus, OPD-
//    OPPO     → OPPO, Realme, Vivo
//    Google   → Pixel, Nexus
//    Motorola → Moto, Motorola
//    Nokia    → Nokia, HMD
//    Generic  → any other Android/mobile UA
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DeviceOS = "ios" | "android" | "windows-phone" | "desktop" | "other";

export type DeviceBrand =
	| "apple"
	| "samsung"
	| "xiaomi"
	| "huawei"
	| "oneplus"
	| "oppo"
	| "realme"
	| "vivo"
	| "google"
	| "motorola"
	| "nokia"
	| "unknown";

export interface DeviceInfo {
	/** User is on a phone-sized device */
	isMobile:  boolean;
	/** User is on a tablet */
	isTablet:  boolean;
	/** User is on a desktop/laptop */
	isDesktop: boolean;
	/** Detected operating system */
	os:        DeviceOS;
	/** Detected hardware brand */
	brand:     DeviceBrand;
	/**
	 * Specific device type string.
	 * e.g. "iphone", "ipad", "samsung", "xiaomi", "android", "desktop"
	 */
	type:      string;
}

// ── Server-side defaults ──────────────────────────────────────────────────────

const DESKTOP_DEVICE: DeviceInfo = {
	isMobile:  false,
	isTablet:  false,
	isDesktop: true,
	os:        "desktop",
	brand:     "unknown",
	type:      "desktop",
};

// ── UA detection ──────────────────────────────────────────────────────────────

/**
 * Parse a User-Agent string into structured device info.
 * Pure function — no side effects, safe everywhere.
 */
export function detectDevice(ua: string): DeviceInfo {
	if (!ua) return DESKTOP_DEVICE;
	const u = ua.toLowerCase();

	// ── iPad detection (must come before phone — some iPads say "mobile") ─────
	const isIpad = /ipad/.test(u) || (/macintosh/.test(u) && /touch/.test(u));
	if (isIpad) {
		return {
			isMobile:  false,
			isTablet:  true,
			isDesktop: false,
			os:        "ios",
			brand:     "apple",
			type:      "ipad",
		};
	}

	// ── Android tablet (Android but no "mobile" token) ────────────────────────
	if (/android/.test(u) && !/mobile/.test(u)) {
		const brand = resolveAndroidBrand(u);
		return {
			isMobile:  false,
			isTablet:  true,
			isDesktop: false,
			os:        "android",
			brand,
			type:      `${brand}-tablet`,
		};
	}

	// ── iPhone ────────────────────────────────────────────────────────────────
	if (/iphone|ipod/.test(u)) {
		return {
			isMobile:  true,
			isTablet:  false,
			isDesktop: false,
			os:        "ios",
			brand:     "apple",
			type:      "iphone",
		};
	}

	// ── Windows Phone ─────────────────────────────────────────────────────────
	if (/windows phone/.test(u)) {
		const brand = /nokia|lumia/.test(u) ? "nokia" : /samsung/.test(u) ? "samsung" : "unknown";
		return {
			isMobile:  true,
			isTablet:  false,
			isDesktop: false,
			os:        "windows-phone",
			brand,
			type:      "windows-phone",
		};
	}

	// ── Android phone ─────────────────────────────────────────────────────────
	if (/android/.test(u) && /mobile/.test(u)) {
		const brand = resolveAndroidBrand(u);
		return {
			isMobile:  true,
			isTablet:  false,
			isDesktop: false,
			os:        "android",
			brand,
			type:      brand === "unknown" ? "android" : brand,
		};
	}

	// ── Generic mobile signals ────────────────────────────────────────────────
	if (/\bmobile\b|\bphone\b/.test(u)) {
		return {
			isMobile:  true,
			isTablet:  false,
			isDesktop: false,
			os:        "other",
			brand:     "unknown",
			type:      "mobile",
		};
	}

	return DESKTOP_DEVICE;
}

function resolveAndroidBrand(ua: string): DeviceBrand {
	// Samsung — SamsungBrowser, SM-, GT-, Galaxy
	if (/samsungbrowser|samsung|sm-[a-z]|gt-[a-z]|galaxy/.test(ua)) return "samsung";
	// Xiaomi / MIUI / Redmi / Mi phones
	if (/xiaomi|miui|redmi|\bmi\s|\bmi\/|hmnote|poco/.test(ua))      return "xiaomi";
	// Huawei / Honor
	if (/huawei|honor/.test(ua))                                       return "huawei";
	// OnePlus
	if (/oneplus|opd-|le2/.test(ua))                                   return "oneplus";
	// OPPO
	if (/\boppo\b/.test(ua))                                           return "oppo";
	// Realme (OPPO sub-brand)
	if (/realme/.test(ua))                                             return "realme";
	// Vivo
	if (/\bvivo\b/.test(ua))                                           return "vivo";
	// Motorola
	if (/motorola|\bmoto\b/.test(ua))                                  return "motorola";
	// Nokia / HMD Global
	if (/\bnokia\b|hmd\s/.test(ua))                                    return "nokia";
	// Google Pixel / Nexus
	if (/pixel|nexus/.test(ua))                                        return "google";
	return "unknown";
}

// ── Server-side helper (Next.js App Router Server Components only) ────────────

/**
 * Read the User-Agent from Next.js request headers and return device info.
 * Must be called from a Server Component, Server Action, or Route Handler.
 * Silently returns desktop defaults in any other context.
 */
export async function getServerDevice(): Promise<DeviceInfo> {
	try {
		const { headers } = await import("next/headers");
		const ua = (await headers()).get("user-agent") ?? "";
		return detectDevice(ua);
	} catch {
		// Not in a server context — return desktop defaults
		return DESKTOP_DEVICE;
	}
}

// ── Client-side hook ──────────────────────────────────────────────────────────

/**
 * React hook that returns device info on the client.
 * SSR-safe — returns desktop defaults until after first mount.
 *
 * @example
 * ```tsx
 * const device = useMobileDevice();
 * if (device.isMobile) return <MobileLayout />;
 * return <DesktopLayout />;
 * ```
 */
export function useMobileDevice(): DeviceInfo {
	const [info, setInfo] = useState<DeviceInfo>(DESKTOP_DEVICE);

	useEffect(() => {
		if (typeof navigator !== "undefined") {
			setInfo(detectDevice(navigator.userAgent));
		}
	}, []);

	return info;
}