import { EngineCommand } from "../../engine/network";

interface PrivateBackendPayload {
	readonly items?: readonly unknown[];
	readonly credentialEcho?: string;
	readonly internal?: unknown;
}

interface PrivateCatalogItem {
	readonly id: string;
	readonly title: string;
	readonly category: string;
}

function publicCatalogItems(payload: PrivateBackendPayload): readonly PrivateCatalogItem[] {
	if (!Array.isArray(payload.items)) throw new Error("[PrivateSearch] Invalid backend response.");
	return payload.items.map((value) => {
		if (!value || typeof value !== "object") throw new Error("[PrivateSearch] Invalid catalog item.");
		const item = value as Record<string, unknown>;
		if (
			typeof item.id !== "string"
			|| typeof item.title !== "string"
			|| typeof item.category !== "string"
		) throw new Error("[PrivateSearch] Invalid catalog item.");
		return Object.freeze({ id: item.id, title: item.title, category: item.category });
	});
}

EngineCommand.create("privateSearch", {
	run: "server",
	auth: "account",
	permissions: ["catalog.read"],
	input: {
		query: { type: "string", maxLength: 80 },
	},
	async execute({ input, api, principal }) {
		const response = await api.resolveRequest({ input });
		if (!response.ok) throw new Error("[PrivateSearch] Private backend request failed.");
		const payload = await response.json() as PrivateBackendPayload;
		const subject = (principal as { readonly subject?: unknown } | undefined)?.subject;
		if (typeof subject !== "string") throw new Error("[PrivateSearch] Account principal is unavailable.");
		return Object.freeze({
			account: subject,
			items: Object.freeze(publicCatalogItems(payload)),
		});
	},
});
