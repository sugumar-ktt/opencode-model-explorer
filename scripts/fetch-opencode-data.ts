// Builds data/opencode-scores.json from OpenCode Data (opencode.ai/data).
//
// Run with: bun scripts/fetch-opencode-data.ts
//
// OpenCode Data serves public, hourly JSON but sends no CORS headers, so the
// browser cannot fetch it. This script runs server-side and writes a snapshot
// that the explorer loads from its own origin. No credentials are involved.

const MODELS_URL = "https://opencode.ai/inference/go/v1/models";
const DATA_BASE = "https://opencode.ai/data";
const REFERENCE_PATH = "deepseek/deepseek-v4-1-flash-1017";
const TIMEOUT_MS = 20_000;

// Order matches the "Normalized model capability scores" table on compare pages.
const ASPECTS = [
	{ key: "reasoning", label: "Reasoning" },
	{ key: "coding", label: "Coding" },
	{ key: "costEfficiency", label: "Cost efficiency" },
	{ key: "contextWindow", label: "Context window" },
	{ key: "multimodal", label: "Multimodal" },
	{ key: "toolUse", label: "Tool use" },
] as const;

type AspectKey = (typeof ASPECTS)[number]["key"];
type Aspects = Record<AspectKey, number | null>;
type AspectNotes = Record<AspectKey, string | null>;
type AspectResult = { aspects: Aspects; notes: AspectNotes };

type Model = { id: string; canonical_id?: string; name?: string };

type Entry = {
	path: string;
	name: string;
	updatedAt: string | null;
	aspects: Aspects;
	aspectNotes: AspectNotes;
	benchmarks: unknown[];
	facts: Record<string, unknown>;
	usage: Record<string, unknown>;
};

type Snapshot = {
	source: string;
	sourceUrl: string;
	fetchedAt: string;
	updatedAt: string | null;
	aspects: { key: string; label: string }[];
	models: Record<string, Entry>;
};

async function fetchText(url: string): Promise<string> {
	const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
	if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
	return response.text();
}

async function fetchJson(url: string): Promise<unknown> {
	const text = await fetchText(url);
	try {
		return JSON.parse(text);
	} catch {
		throw new Error(`Invalid JSON from ${url}`);
	}
}

function asObject(value: unknown, url: string): Record<string, any> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`Unexpected JSON shape from ${url}`);
	}
	return value as Record<string, any>;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, async () => {
			while (next < items.length) {
				const index = next++;
				results[index] = await fn(items[index]);
			}
		}),
	);
	return results;
}

function candidatePaths(model: Model): string[] {
	const paths: string[] = [];
	const canonical = String(model.canonical_id ?? "").replace(/\./g, "-");
	if (canonical) {
		paths.push(canonical);
		if (!canonical.endsWith("-contributor")) paths.push(`${canonical}-contributor`);
		paths.push(canonical.replace(/-\d{8}$/, ""));
	}
	paths.push(String(model.id).replace(/\./g, "-"));
	return [...new Set(paths)];
}

function decode(value: string): string {
	return value
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

// The compare pages render the six aspect scores into an SSR table. Parsing it
// keeps OpenCode's own normalization (including neutral placeholders) intact.
function parseAspectRows(html: string): Map<string, AspectResult> {
	const table = html.match(/<table><caption>Normalized model capability scores<\/caption>[\s\S]*?<\/table>/)?.[0];
	if (!table) throw new Error("Compare page has no capability score table");

	const rows = new Map<string, AspectResult>();
	for (const match of table.matchAll(/<tr[^>]*><th>([^<]+)<\/th>([\s\S]*?)<\/tr>/g)) {
		const name = decode(match[1]);
		const cells = [...match[2].matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((cell) => decode(cell[1]));
		if (cells.length < ASPECTS.length) continue;

		const aspects = {} as Aspects;
		const notes = {} as AspectNotes;
		ASPECTS.forEach((aspect, index) => {
			const cell = cells[index];
			const separator = cell.indexOf("—");
			const scorePart = (separator < 0 ? cell : cell.slice(0, separator)).trim();
			const score = Number(scorePart.split("/")[0]);
			aspects[aspect.key] = Number.isFinite(score) ? score : null;
			notes[aspect.key] = separator < 0 ? null : cell.slice(separator + 1).trim() || null;
		});
		rows.set(name, { aspects, notes });
	}
	if (!rows.size) throw new Error("Compare page capability table had no rows");
	return rows;
}

function emptyAspects(): AspectResult {
	const aspects = {} as Aspects;
	const notes = {} as AspectNotes;
	for (const aspect of ASPECTS) {
		aspects[aspect.key] = null;
		notes[aspect.key] = null;
	}
	return { aspects, notes };
}

async function comparePaths(left: string, right: string): Promise<Map<string, AspectResult>> {
	return parseAspectRows(await fetchText(`${DATA_BASE}/compare/${left}/${right}`));
}

function assignAspects(entries: Entry[], rows: Map<string, AspectResult>) {
	entries.forEach((entry, index) => {
		if (!rows.size) return;
		const parsed = rows.get(entry.name) ?? (rows.size === entries.length ? [...rows.values()][index] : undefined);
		if (!parsed) return;
		entry.aspects = parsed.aspects;
		entry.aspectNotes = parsed.notes;
	});
}

async function main() {
	const payload = asObject(await fetchJson(MODELS_URL), MODELS_URL);
	const models: Model[] = payload.data;
	if (!Array.isArray(models) || !models.length) throw new Error("No models returned by OpenCode");

	// Resolve each explorer id to an OpenCode Data path.
	const paths = new Map<string, string>();
	await mapLimit(models, 10, async (model) => {
		for (const path of candidatePaths(model)) {
			try {
				const response = await fetch(`${DATA_BASE}/${path}.json`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
				if (response.ok) {
					paths.set(model.id, path);
					return;
				}
			} catch {
				// try the next candidate
			}
		}
	});
	if (!paths.size) throw new Error("No OpenCode Data pages resolved for any model");

	const snapshot: Snapshot = {
		source: "OpenCode Data",
		sourceUrl: `${DATA_BASE}/`,
		fetchedAt: new Date().toISOString(),
		updatedAt: null,
		aspects: ASPECTS.map(({ key, label }) => ({ key, label })),
		models: {},
	};

	const resolved = models.filter((model) => paths.has(model.id));
	const loaded = await mapLimit(resolved, 8, async (model) => {
		const path = paths.get(model.id)!;
		const url = `${DATA_BASE}/${path}.json`;
		const data = asObject(await fetchJson(url), url);
		const facts = asObject(data.model ?? {}, url);
		const usage = asObject(data.usage ?? {}, url);
		const blank = emptyAspects();
		const entry: Entry = {
			path,
			name: facts.name || model.name || model.id,
			updatedAt: data.updatedAt ?? null,
			aspects: blank.aspects,
			aspectNotes: blank.notes,
			benchmarks: Array.isArray(facts.benchmarks) ? facts.benchmarks : [],
			facts: {
				contextTokens: facts.contextTokens ?? null,
				outputTokens: facts.outputTokens ?? null,
				inputModalities: facts.inputModalities ?? [],
				outputModalities: facts.outputModalities ?? [],
				reasoning: facts.reasoning ?? null,
				toolCall: facts.toolCall ?? null,
				openWeights: facts.openWeights ?? null,
				releaseDate: facts.releaseDate ?? null,
			},
			usage: {
				rankLastWeek: usage.rankLastWeek ?? null,
				tokens: usage.tokens ?? null,
				sharePercent: usage.sharePercent ?? null,
				uniqueUsers: usage.uniqueUsers ?? null,
				sessions: usage.sessions ?? null,
				weeklyRetentionPercent: usage.weeklyRetentionPercent ?? null,
				costPerSessionUsd: usage.costPerSessionUsd ?? null,
				cachedInputPercent: usage.cachedInputPercent ?? null,
			},
		};
		return { id: model.id, entry };
	});

	for (const { id, entry } of loaded) snapshot.models[id] = entry;
	snapshot.updatedAt = loaded.map(({ entry }) => entry.updatedAt).filter(Boolean).sort().at(-1) ?? null;

	// Fetch the six normalized scores in pairs so each compare page serves two models.
	const failures: string[] = [];
	await mapLimit(
		Array.from({ length: Math.ceil(loaded.length / 2) }, (_, index) => index),
		4,
		async (index) => {
			const pair = loaded.slice(index * 2, index * 2 + 2);
			const paths = pair.map(({ entry }) => entry.path);
			try {
				const rows = await comparePaths(paths[0], paths[1] ?? REFERENCE_PATH);
				assignAspects(
					pair.map(({ entry }) => entry),
					rows,
				);
			} catch (error) {
				failures.push(`${paths[0]} / ${paths[1] ?? REFERENCE_PATH}: ${error instanceof Error ? error.message : error}`);
			}
		},
	);

	// Retry models whose names did not match a compare row, using a reference model.
	for (const { entry } of loaded) {
		if (entry.aspects[ASPECTS[0].key] !== null) continue;
		try {
			assignAspects([entry], await comparePaths(entry.path, REFERENCE_PATH));
		} catch (error) {
			failures.push(`${entry.path}: ${error instanceof Error ? error.message : error}`);
		}
	}

	const missing = loaded.filter(({ entry }) => entry.aspects[ASPECTS[0].key] === null).map(({ id }) => id);
	if (missing.length) {
		throw new Error(`Missing aspect scores for: ${missing.join(", ")}${failures.length ? `\n${failures.join("\n")}` : ""}`);
	}

	const output = new URL("../public/data/opencode-scores.json", import.meta.url);
	await Bun.write(output, `${JSON.stringify(snapshot, null, 2)}\n`);
	console.log(`Wrote public/data/opencode-scores.json · ${loaded.length} models · updated ${snapshot.updatedAt}`);
}

await main();
