"use client";

import {
	EngineCommand,
	EngineDeviceKey,
	configureEngineCommandTransport,
	createNENCTransport,
	type EngineDevicePublicIdentity,
	type NENCClientManifest,
} from "../../src/engine/network";

export interface PrivateSearchClientOptions {
	fetcher?: typeof fetch;
	destinationOrigin?: string;
	deviceKey?: EngineDeviceKey;
}

export interface PrivateSearchLoginResult {
	account: { id: string; displayName: string };
	expiresAt: number;
}

export interface PrivateSearchResult {
	account: { id: string; displayName?: string };
	items: Array<{ id: string; title: string }>;
}

export class PrivateSearchClient {
	private constructor(private readonly deviceKey: EngineDeviceKey) {}

	static async connect(
		manifest: NENCClientManifest,
		options: PrivateSearchClientOptions = {},
	): Promise<PrivateSearchClient> {
		const deviceKey = options.deviceKey ?? await EngineDeviceKey.create();
		configureEngineCommandTransport(createNENCTransport(manifest, {
			fetcher: options.fetcher,
			destinationOrigin: options.destinationOrigin,
			deviceKey,
		}));
		return new PrivateSearchClient(deviceKey);
	}

	get deviceIdentity(): EngineDevicePublicIdentity {
		return this.deviceKey.identity;
	}

	login(email: string, password: string): Promise<PrivateSearchLoginResult> {
		return EngineCommand.run("account.login", {
			email,
			password,
			deviceIdentity: this.deviceKey.identity,
		});
	}

	search(search: string): Promise<PrivateSearchResult> {
		return EngineCommand.run("catalog.privateSearch", { search });
	}
}
