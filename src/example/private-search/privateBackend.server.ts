import "server-only";

export const PRIVATE_SEARCH_BACKEND_TOKEN = (
	process.env.ENGINE_PRIVATE_SEARCH_TOKEN?.trim()
	|| "gen3-private-backend-dev-token-2026"
);

interface PrivateCatalogRecord {
	readonly id: string;
	readonly title: string;
	readonly category: string;
	readonly databaseScore: number;
	readonly internalPartition: string;
}

const PRIVATE_CATALOG: readonly PrivateCatalogRecord[] = Object.freeze([
	Object.freeze({
		id: "nebula-7",
		title: "Nebula Render Kit",
		category: "graphics",
		databaseScore: 0.991,
		internalPartition: "catalog-private-a",
	}),
	Object.freeze({
		id: "vault-3",
		title: "Vault Session Monitor",
		category: "security",
		databaseScore: 0.963,
		internalPartition: "catalog-private-b",
	}),
	Object.freeze({
		id: "signal-9",
		title: "Signal Search Index",
		category: "network",
		databaseScore: 0.948,
		internalPartition: "catalog-private-a",
	}),
]);

export function searchPrivateCatalog(query: string): readonly PrivateCatalogRecord[] {
	const normalized = query.trim().toLowerCase();
	return PRIVATE_CATALOG
		.filter((record) => !normalized
			|| record.title.toLowerCase().includes(normalized)
			|| record.category.includes(normalized))
		.sort((left, right) => right.databaseScore - left.databaseScore);
}
