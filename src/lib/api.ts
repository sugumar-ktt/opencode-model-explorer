import { API, OPENCODE_DATA_URL, REQUEST_TIMEOUT_MS } from "./config";
import type { CatalogModel, Snapshot } from "./types";

async function fetchJson(url: string): Promise<unknown> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const response = await fetch(url, { cache: "no-store", signal: controller.signal });
		if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
		return await response.json();
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s: ${url}`);
		}
		throw error;
	} finally {
		clearTimeout(timer);
	}
}

export async function fetchModels(): Promise<CatalogModel[]> {
	const payload = (await fetchJson(API.models)) as { data?: CatalogModel[] };
	if (!Array.isArray(payload?.data)) throw new Error("Unexpected models response");
	return payload.data;
}

export async function fetchOpenCodeScores(): Promise<Snapshot> {
	const snapshot = (await fetchJson(OPENCODE_DATA_URL)) as Snapshot | null;
	if (!snapshot || typeof snapshot !== "object" || typeof snapshot.models !== "object") {
		throw new Error("OpenCode scores snapshot is incomplete");
	}
	return snapshot;
}
