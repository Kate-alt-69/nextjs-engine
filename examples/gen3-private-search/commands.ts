import {
	EngineCommand,
	isEngineDevicePublicIdentity,
	type EngineDevicePublicIdentity,
} from "../../src/engine/network";
import type { NENCAccountPrincipal } from "../../src/engine/core/nenc/NENCSessionAuth";
import { requirePrivateSearchAPI } from "./runtime";
import type { PrivateSearchAccount } from "./sessionStore";

interface LoginInput {
	email: string;
	password: string;
	deviceIdentity: EngineDevicePublicIdentity;
}

interface SearchInput {
	search: string;
}

function validAccount(value: unknown): value is PrivateSearchAccount {
	if (!value || typeof value !== "object") return false;
	const account = value as Partial<PrivateSearchAccount>;
	return typeof account.id === "string" && account.id.length > 0
		&& typeof account.displayName === "string" && account.displayName.length > 0
		&& Array.isArray(account.permissions)
		&& account.permissions.every((permission) => typeof permission === "string" && permission.length > 0);
}

function safeItems(value: unknown): Array<{ id: string; title: string }> | null {
	if (!value || typeof value !== "object") return null;
	const items = (value as { items?: unknown }).items;
	if (!Array.isArray(items)) return null;
	const safe = [];
	for (const item of items.slice(0, 50)) {
		if (!item || typeof item !== "object") return null;
		const candidate = item as { id?: unknown; title?: unknown };
		if (typeof candidate.id !== "string" || typeof candidate.title !== "string") return null;
		safe.push({ id: candidate.id, title: candidate.title });
	}
	return safe;
}

export const loginCommand = EngineCommand.create<LoginInput, Response>("account.login", {
	run: "server",
	auth: "anonymous",
	input: {
		email: { type: "string", maxLength: 254 },
		password: { type: "string", maxLength: 1_024 },
		deviceIdentity: "object",
	},
	async execute({ input, api }) {
		if (!isEngineDevicePublicIdentity(input.deviceIdentity)) {
			return Response.json({ error: "invalid_request" }, { status: 400 });
		}
		const runtime = requirePrivateSearchAPI(api);
		const backend = await runtime.resolveRequest({
			input: { email: input.email, password: input.password },
		});
		if (!backend.ok) {
			return Response.json(
				{ error: backend.status === 401 ? "invalid_credentials" : "backend_unavailable" },
				{ status: backend.status === 401 ? 401 : 502 },
			);
		}
		let account: unknown;
		try {
			account = await backend.json();
		} catch {
			return Response.json({ error: "backend_unavailable" }, { status: 502 });
		}
		if (!validAccount(account)) {
			return Response.json({ error: "backend_unavailable" }, { status: 502 });
		}
		const session = await runtime.issueSession(account, input.deviceIdentity);
		return Response.json({
			account: { id: account.id, displayName: account.displayName },
			expiresAt: session.expiresAt,
		}, {
			headers: {
				"Cache-Control": "no-store",
				"Set-Cookie": session.cookie,
			},
		});
	},
});

export const privateSearchCommand = EngineCommand.create<SearchInput, Response>("catalog.privateSearch", {
	run: "server",
	auth: "account",
	permissions: ["catalog.read"],
	input: {
		search: { type: "string", maxLength: 120 },
	},
	async execute({ input, api, principal }) {
		const account = principal as NENCAccountPrincipal<{ displayName: string }>;
		const backend = await api.resolveRequest({
			input: { search: input.search, accountId: account.subject },
		});
		if (!backend.ok) {
			return Response.json({ error: "backend_unavailable" }, { status: 502 });
		}
		let payload: unknown;
		try {
			payload = await backend.json();
		} catch {
			return Response.json({ error: "backend_unavailable" }, { status: 502 });
		}
		const items = safeItems(payload);
		if (!items) return Response.json({ error: "backend_unavailable" }, { status: 502 });
		return Response.json({
			account: { id: account.subject, displayName: account.claims?.displayName },
			items,
		}, { headers: { "Cache-Control": "private, no-store" } });
	},
});
