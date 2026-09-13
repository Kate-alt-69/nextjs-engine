"use client";

import { useEffect, useState, type FormEvent } from "react";
import { NENC_CLIENT_MANIFEST } from "../../.nextjs-engine/nenc/client";
import {
	EngineCommand,
	EngineDeviceKey,
	configureEngineCommandTransport,
	createNENCTransport,
} from "../../src/engine/network";
import styles from "./page.module.css";

interface PrivateSearchResult {
	readonly account: string;
	readonly items: readonly {
		readonly id: string;
		readonly title: string;
		readonly category: string;
	}[];
}

interface LoginResult {
	readonly account?: { readonly subject?: string; readonly email?: string };
	readonly deviceKeyId?: string;
	readonly expiresAt?: number;
	readonly error?: string;
}

export default function EnginePrivateSearchPage() {
	const [deviceKey, setDeviceKey] = useState<EngineDeviceKey | null>(null);
	const [deviceError, setDeviceError] = useState("");
	const [email, setEmail] = useState("kate@example.com");
	const [password, setPassword] = useState("engine-demo");
	const [query, setQuery] = useState("nebula");
	const [loginPending, setLoginPending] = useState(false);
	const [searchPending, setSearchPending] = useState(false);
	const [loggedIn, setLoggedIn] = useState(false);
	const [loginStatus, setLoginStatus] = useState("Create a device proof, then sign in.");
	const [searchStatus, setSearchStatus] = useState("Private results stay locked until NENC verifies the request.");
	const [result, setResult] = useState<PrivateSearchResult | null>(null);

	useEffect(() => {
		let active = true;
		void EngineDeviceKey.create({
			environment: `${navigator.platform}|${navigator.userAgent}`,
		}).then((createdKey) => {
			if (!active) return;
			configureEngineCommandTransport(createNENCTransport(NENC_CLIENT_MANIFEST, {
				deviceKey: createdKey,
				destinationOrigin: location.origin,
			}));
			setDeviceKey(createdKey);
			setLoginStatus("Device proof ready. Sign in to bind the session.");
		}).catch((error: unknown) => {
			if (!active) return;
			setDeviceError(error instanceof Error ? error.message : "Device proof setup failed.");
		});
		return () => {
			active = false;
			configureEngineCommandTransport(null);
		};
	}, []);

	async function signIn(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		if (!deviceKey || loginPending) return;
		setLoginPending(true);
		setLoginStatus("Verifying account and binding this device…");
		setResult(null);
		try {
			const response = await fetch("/engine-private-search/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ email, password, device: deviceKey.identity }),
			});
			const payload = await response.json() as LoginResult;
			if (!response.ok) throw new Error(payload.error === "invalid_credentials"
				? "Demo credentials were rejected."
				: `Login failed (${response.status}).`);
			setLoggedIn(true);
			setLoginStatus(`Signed in as ${payload.account?.email ?? email}. Session is HttpOnly and device-bound.`);
			setSearchStatus("Session ready. Run the private command.");
		} catch (error) {
			setLoggedIn(false);
			setLoginStatus(error instanceof Error ? error.message : "Login failed.");
		} finally {
			setLoginPending(false);
		}
	}

	async function runPrivateSearch(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		if (!deviceKey || searchPending) return;
		setSearchPending(true);
		setResult(null);
		setSearchStatus("Signing one opaque NENC request…");
		try {
			const payload = await EngineCommand.run<{ readonly query: string }, PrivateSearchResult>(
				"privateSearch",
				{ query },
			);
			setResult(payload);
			setLoggedIn(true);
			setSearchStatus(`Private backend returned ${payload.items.length} sanitized result${payload.items.length === 1 ? "" : "s"}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Private search failed.";
			if (/\(401\)/.test(message)) setLoggedIn(false);
			setSearchStatus(message);
		} finally {
			setSearchPending(false);
		}
	}

	async function signOut(): Promise<void> {
		await fetch("/engine-private-search/login", {
			method: "DELETE",
			credentials: "same-origin",
		});
		setLoggedIn(false);
		setResult(null);
		setLoginStatus("Signed out. The server-side session was revoked.");
		setSearchStatus("Private results stay locked until NENC verifies the request.");
	}

	return (
		<main className={styles.page}>
			<section className={styles.shell}>
				<header className={styles.hero}>
					<div>
						<p className={styles.eyebrow}>Generation 3 · Phase C proving application</p>
						<h1>Private search, without handing the browser your keys.</h1>
						<p className={styles.lede}>
							Login creates an HttpOnly session bound to a non-exportable device key. Search then crosses one opaque NENC endpoint before a server-only resolver reaches the private backend.
						</p>
					</div>
					<div className={styles.flow} aria-label="Private search request flow">
						<span>Browser</span><b>→</b><span>NENC</span><b>→</b><span>Private API</span>
					</div>
				</header>

				<div className={styles.grid}>
					<section className={styles.card}>
						<div className={styles.cardHeader}>
							<span className={styles.step}>01</span>
							<div><h2>Bind account session</h2><p>Demo-only credentials; the returned token never enters component state.</p></div>
						</div>
						<div className={styles.securityLine} data-testid="device-status">
							<span className={deviceKey ? styles.goodDot : styles.waitDot} />
							{deviceError || (deviceKey
								? `P-256 ready · private key exportable: ${String(deviceKey.privateKeyExtractable)}`
								: "Creating non-exportable P-256 key…")}
						</div>
						<form onSubmit={(event) => void signIn(event)} className={styles.form}>
							<label>Email<input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" /></label>
							<label>Password<input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
							<div className={styles.actions}>
								<button type="submit" disabled={!deviceKey || loginPending}>{loginPending ? "Binding…" : "Sign in + bind device"}</button>
								<button type="button" className={styles.secondary} disabled={!loggedIn} onClick={() => void signOut()}>Sign out</button>
							</div>
						</form>
						<p className={styles.status} data-testid="login-status">{loginStatus}</p>
					</section>

					<section className={styles.card}>
						<div className={styles.cardHeader}>
							<span className={styles.step}>02</span>
							<div><h2>Run private command</h2><p>The network sees an opaque selector and argument id, not a route per command.</p></div>
						</div>
						<form onSubmit={(event) => void runPrivateSearch(event)} className={styles.form}>
							<label>Private catalog query<input name="query" value={query} maxLength={80} onChange={(event) => setQuery(event.target.value)} /></label>
							<button data-testid="private-search" type="submit" disabled={!deviceKey || searchPending}>{searchPending ? "Verifying…" : "Search through NENC"}</button>
						</form>
						<p className={styles.status} data-testid="search-status">{searchStatus}</p>
						<div className={styles.results} data-testid="private-results">
							{result?.items.map((item) => (
								<article key={item.id} data-testid="private-result">
									<span>{item.category}</span><h3>{item.title}</h3><code>{item.id}</code>
								</article>
							))}
						</div>
					</section>
				</div>

				<footer className={styles.proof}>
					<span>✓ HttpOnly session</span><span>✓ Device signature</span><span>✓ Replay guard</span><span>✓ Permission check</span><span>✓ Sanitized response</span>
				</footer>
			</section>
		</main>
	);
}
