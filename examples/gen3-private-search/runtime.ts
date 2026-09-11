import {
	EngineAPIResolver,
	type EngineAPIConfig,
} from "../../src/engine/core/EngineAPIResolver";
import type { EngineDevicePublicIdentity } from "../../src/engine/core/enginecookies/types";
import {
	PrivateSearchSessionStore,
	type IssuedPrivateSearchSession,
	type PrivateSearchAccount,
} from "./sessionStore";

export class PrivateSearchAPIResolver extends EngineAPIResolver {
	constructor(
		config: EngineAPIConfig,
		private readonly sessions: PrivateSearchSessionStore,
	) {
		super(config);
	}

	issueSession(
		account: PrivateSearchAccount,
		identity: EngineDevicePublicIdentity,
	): Promise<IssuedPrivateSearchSession> {
		return this.sessions.issue(account, identity);
	}
}

export function requirePrivateSearchAPI(api: EngineAPIResolver): PrivateSearchAPIResolver {
	if (!(api instanceof PrivateSearchAPIResolver)) {
		throw new Error("[private-search example] The command requires its scoped server resolver.");
	}
	return api;
}
