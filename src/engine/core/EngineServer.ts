// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — server runtime
// ─────────────────────────────────────────────────────────────────────────────

import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getServerDevice } from "./EngineDeviceServer";
import type { DeviceInfo } from "./EngineDeviceShared";

export interface EngineServerFetchOptions extends RequestInit {
	next?: {
		revalidate?: number | false;
		tags?: string[];
	};
}

export interface EngineServerCookieView {
	get(name: string): string | undefined;
	has(name: string): boolean;
	all(): Array<{ name: string; value: string }>;
}

export interface EngineServerHeaderView {
	get(name: string): string | null;
	has(name: string): boolean;
	entries(): Array<[string, string]>;
}

export class EngineServerSession {
	public readonly device: DeviceInfo;
	public readonly cookies: EngineServerCookieView;
	public readonly headers: EngineServerHeaderView;

	private constructor(
		device: DeviceInfo,
		cookieStore: Awaited<ReturnType<typeof cookies>>,
		headerStore: Awaited<ReturnType<typeof headers>>,
	) {
		this.device = device;
		this.cookies = Object.freeze({
			get: (name: string) => cookieStore.get(name)?.value,
			has: (name: string) => cookieStore.has(name),
			all: () => cookieStore.getAll().map(({ name, value }) => ({ name, value })),
		});
		this.headers = Object.freeze({
			get: (name: string) => headerStore.get(name),
			has: (name: string) => headerStore.has(name),
			entries: () => [...headerStore.entries()],
		});
	}

	static async open(): Promise<EngineServerSession> {
		const [cookieStore, headerStore, device] = await Promise.all([
			cookies(),
			headers(),
			getServerDevice(),
		]);
		return new EngineServerSession(device, cookieStore, headerStore);
	}

	fetch(input: RequestInfo | URL, init?: EngineServerFetchOptions): Promise<Response> {
		return fetch(input, init);
	}

	async fetchJSON<T>(input: RequestInfo | URL, init?: EngineServerFetchOptions): Promise<T> {
		const response = await this.fetch(input, init);
		if (!response.ok) {
			throw new Error(`[EngineServer] Request failed with ${response.status} ${response.statusText}.`);
		}
		return response.json() as Promise<T>;
	}

	redirect(url: string): never {
		return redirect(url);
	}

	notFound(): never {
		return notFound();
	}
}

export const EngineServer = Object.freeze({
	open: () => EngineServerSession.open(),
	page<T>(handler: (server: EngineServerSession) => T | Promise<T>): () => Promise<T> {
		return async function EngineServerPage(): Promise<T> {
			const server = await EngineServerSession.open();
			return handler(server);
		};
	},
});
