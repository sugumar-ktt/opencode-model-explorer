// Network boundary: validate responses here so the rest of the app can trust
// the data. Every request has a timeout and surfaces its own failures.

import { API, REQUEST_TIMEOUT_MS } from "./config.js";

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

// Both score feeds come from the same provider (OpenRouter Data API). Fetch
// them together so a slow or failed feed cannot hold up the other.
export async function fetchScores(key) {
	const headers = { Authorization: `Bearer ${key}` };
	const intelligenceUrl = `${API.scores}?source=${API.intelligenceSource}&max_results=${API.maxResults}`;
	const designUrl = `${API.scores}?source=${API.designSource}&arena=models&category=uicomponent&max_results=${API.maxResults}`;

	const [intelligence, design] = await Promise.all([
		fetchJson(intelligenceUrl, { headers }),
		fetchJson(designUrl, { headers }),
	]);

	return {
		intelligence: Array.isArray(intelligence?.data) ? intelligence.data : [],
		design: Array.isArray(design?.data) ? design.data : [],
	};
}
