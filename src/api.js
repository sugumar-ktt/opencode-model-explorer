// Network boundary: validate responses here so the rest of the app can trust
// the data. Every request has a timeout and surfaces its own failures.

import { API, OPENCODE_DATA_URL, REQUEST_TIMEOUT_MS } from "./config.js";

async function fetchJson(url, { headers = {} } = {}) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const response = await fetch(url, { headers, cache: "no-store", signal: controller.signal });
		if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
		return await response.json();
	} catch (error) {
		if (error.name === "AbortError") {
			throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s: ${url}`);
		}
		throw error;
	} finally {
		clearTimeout(timer);
	}
}

export async function fetchModels() {
	const payload = await fetchJson(API.models);
	if (!Array.isArray(payload?.data)) throw new Error("Unexpected models response");
	return payload.data;
}

// The snapshot is same-origin and needs no credentials. A missing file means
// the fetch script has not been run yet; the caller explains that to the user.
export async function fetchOpenCodeScores() {
	const snapshot = await fetchJson(OPENCODE_DATA_URL);
	if (!snapshot || typeof snapshot !== "object" || typeof snapshot.models !== "object") {
		throw new Error("OpenCode scores snapshot is incomplete");
	}
	return snapshot;
}
