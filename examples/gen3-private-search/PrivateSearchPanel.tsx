"use client";

import { useRef, useState, type FormEvent } from "react";
import type { NENCClientManifest } from "../../src/engine/network";
import {
	PrivateSearchClient,
	type PrivateSearchLoginResult,
	type PrivateSearchResult,
} from "./client";

export interface PrivateSearchPanelProps {
	manifest: NENCClientManifest;
}

export function PrivateSearchPanel({ manifest }: PrivateSearchPanelProps) {
	const client = useRef<Promise<PrivateSearchClient> | null>(null);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [query, setQuery] = useState("");
	const [account, setAccount] = useState<PrivateSearchLoginResult["account"] | null>(null);
	const [result, setResult] = useState<PrivateSearchResult | null>(null);
	const [status, setStatus] = useState("Ready");

	function connectedClient(): Promise<PrivateSearchClient> {
		client.current ??= PrivateSearchClient.connect(manifest);
		return client.current;
	}

	async function login(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setStatus("Signing in…");
		try {
			const response = await (await connectedClient()).login(email, password);
			setAccount(response.account);
			setPassword("");
			setStatus("Signed in with a device-bound session");
		} catch {
			setStatus("Sign-in failed");
		}
	}

	async function search(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setStatus("Searching private catalog…");
		try {
			const response = await (await connectedClient()).search(query);
			setResult(response);
			setStatus(`Found ${response.items.length} result(s)`);
		} catch {
			setStatus("Private search failed");
		}
	}

	return (
		<main>
			<h1>Generation 3 private search proof</h1>
			<p>{status}</p>
			<form onSubmit={login}>
				<label>
					Email
					<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
				</label>
				<label>
					Password
					<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
				</label>
				<button type="submit">Sign in</button>
			</form>
			<form onSubmit={search}>
				<label>
					Private search
					<input value={query} onChange={(event) => setQuery(event.target.value)} required />
				</label>
				<button type="submit" disabled={!account}>Search</button>
			</form>
			{account ? <p>Signed in as {account.displayName}</p> : null}
			<ul>
				{result?.items.map((item) => <li key={item.id}>{item.title}</li>)}
			</ul>
		</main>
	);
}
