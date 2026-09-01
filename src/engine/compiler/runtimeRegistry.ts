// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — built-in runtime profiles
// ─────────────────────────────────────────────────────────────────────────────

import type { NodeType, SchemaNode } from "../schema/types";
import type { EngineRuntimeKind, EngineRuntimeProfile } from "./types";

const DEFAULT_PROFILE: EngineRuntimeProfile = {
	runtime: "auto",
	reason: "Custom components default to automatic runtime classification.",
	defaultWorkClass: "visible",
};

const profiles = new Map<NodeType, EngineRuntimeProfile>();

function setBuiltin(type: NodeType, profile: EngineRuntimeProfile): void {
	profiles.set(type, Object.freeze({ ...profile }));
}

for (const type of ["box", "stack", "grid", "text", "heading", "section", "card", "spacer", "divider", "option", "optgroup"] as NodeType[]) {
	setBuiltin(type, {
		runtime: "static",
		reason: "This built-in renders deterministic markup and styles without browser state.",
		defaultWorkClass: "visible",
	});
}

setBuiltin("slot", {
	runtime: "server",
	reason: "Slots can contain arbitrary React values and are resolved by the page/component owner.",
	defaultWorkClass: "visible",
});
setBuiltin("markdown", {
	runtime: "server",
	reason: "Markdown content can be compiled/rendered on the server unless interactive animation is requested.",
	defaultWorkClass: "near",
});
setBuiltin("image", {
	runtime: "server",
	reason: "Image markup is server-renderable while the browser owns the image resource request and decode.",
	capabilities: ["intersection-observer"],
	defaultWorkClass: "near",
});
setBuiltin("video", {
	runtime: "client",
	reason: "Video loading and playback lifecycle depend on browser media state.",
	capabilities: ["dom", "intersection-observer", "media"],
	defaultWorkClass: "deferred",
	heavy: true,
});
setBuiltin("canvas", {
	runtime: "client",
	reason: "Canvas rendering requires browser drawing and frame lifecycle APIs.",
	capabilities: ["dom", "canvas", "request-animation-frame", "intersection-observer"],
	defaultWorkClass: "visible",
	heavy: true,
});
for (const type of ["manim", "EngineManim", "manim3d", "EngineManim3D"] as NodeType[]) {
	setBuiltin(type, {
		runtime: "client",
		reason: "EngineManim owns browser-side animation/rendering state.",
		capabilities: ["dom", "canvas", "request-animation-frame", "intersection-observer"],
		defaultWorkClass: "visible",
		heavy: true,
	});
}
for (const type of ["dialog", "EngineDialog", "drawer", "EngineDrawer", "popover", "EnginePopover"] as NodeType[]) {
	setBuiltin(type, {
		runtime: "client",
		reason: "Overlay focus, dismissal, portals and viewport positioning require browser interaction.",
		capabilities: ["dom", "visual-viewport"],
		defaultWorkClass: "visible",
	});
}
for (const type of ["form", "input", "textarea", "checkbox", "custom-select"] as NodeType[]) {
	setBuiltin(type, {
		runtime: "client",
		reason: "This form control owns interactive browser state.",
		capabilities: ["dom"],
		defaultWorkClass: "visible",
	});
}
setBuiltin("label", {
	runtime: "static",
	reason: "Labels render as deterministic markup unless client behavior is attached.",
	defaultWorkClass: "visible",
});
setBuiltin("button", {
	runtime: "auto",
	reason: "Buttons are server-renderable when they only navigate and become client islands when handlers/model state are used.",
	defaultWorkClass: "visible",
});
for (const type of ["link", "EngineLink", "nav", "EngineNav", "scroll"] as NodeType[]) {
	setBuiltin(type, {
		runtime: "auto",
		reason: "Navigation can stay server-rendered for ordinary links but browser-enhanced behavior may require a client island.",
		capabilities: ["dom"],
		defaultWorkClass: "visible",
	});
}
setBuiltin("hero", {
	runtime: "auto",
	reason: "Hero layout is server-renderable; parallax or interactive behavior upgrades only the hero boundary.",
	defaultWorkClass: "critical",
});
setBuiltin("suspense", {
	runtime: "auto",
	reason: "Suspense follows the runtime requirements of the async content it contains.",
	defaultWorkClass: "near",
});

export function registerEngineRuntimeProfile(type: NodeType, profile: EngineRuntimeProfile): void {
	profiles.set(type, Object.freeze({ ...profile }));
}

export function unregisterEngineRuntimeProfile(type: NodeType): void {
	profiles.delete(type);
}

export function getEngineRuntimeProfile(type: NodeType): EngineRuntimeProfile {
	return profiles.get(type) ?? DEFAULT_PROFILE;
}

function hasClientBehavior(node: SchemaNode): boolean {
	const props = node.props ?? {};
	if (typeof props.onClick === "string" && props.onClick.length > 0) return true;
	if (typeof props.onChange === "string" && props.onChange.length > 0) return true;
	if (typeof props.onSubmit === "string" && props.onSubmit.length > 0) return true;
	if (typeof props.onSetup === "string" || typeof props.onDraw === "string" || typeof props.onResize === "string") return true;
	if (props.model !== undefined || props.modelKey !== undefined || props.bind !== undefined) return true;
	if (props.parallax === true) return true;
	if (props.textAnimation && props.textAnimation !== "none") return true;
	if (props.blockAnimation && props.blockAnimation !== "none") return true;
	return false;
}

export function resolveNodeRuntime(node: SchemaNode): {
	runtime: Exclude<EngineRuntimeKind, "auto">;
	reason: string;
	profile: EngineRuntimeProfile;
} {
	const profile = getEngineRuntimeProfile(node.type);
	if (profile.runtime !== "auto") {
		if (profile.runtime !== "client" && hasClientBehavior(node)) {
			return {
				runtime: "client",
				reason: "Browser behavior is attached to an otherwise server-renderable node.",
				profile,
			};
		}
		return { runtime: profile.runtime, reason: profile.reason, profile };
	}

	if (hasClientBehavior(node)) {
		return {
			runtime: "client",
			reason: "Automatic classification found browser-side handlers, animation, model state or bindings.",
			profile,
		};
	}

	if (node.type === "button" && typeof node.props?.href === "string") {
		return {
			runtime: "static",
			reason: "This button only navigates, so browser state is not required.",
			profile,
		};
	}

	if (node.type === "link" || node.type === "EngineLink" || node.type === "nav" || node.type === "EngineNav") {
		const transition = node.props?.transition;
		if (transition === undefined || transition === "instant") {
			return {
				runtime: "server",
				reason: "Ordinary navigation can be rendered on the server without transition runtime state.",
				profile,
			};
		}
	}

	return {
		runtime: "server",
		reason: profile.reason,
		profile,
	};
}
