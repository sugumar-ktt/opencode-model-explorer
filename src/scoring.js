// Pure data transforms: turn API payloads into table rows and scores. No DOM
// access here, so every rule can be read and tested on its own.

import {
	DEFAULT_TOKEN_MIX,
	FIVE_HOUR_RATIO,
	PRESETS,
	TOKEN_MIX,
} from "./config.js";

const INTELLIGENCE_WEIGHT = 0.7;
const DESIGN_WEIGHT = 0.3;
const DESIGN_ELO_FLOOR = 800;
const DESIGN_ELO_RANGE = 600;

function numOrNull(value) {
	if (value == null) return null;
	const number = Number(value);
	return Number.isNaN(number) ? null : number;
}

// Model names differ between feeds by separators, date suffixes and variant
// names; reduce them to a common alphanumeric core before comparing.
function canon(value) {
	return String(value ?? "")
		.toLowerCase()
		.replace(/\(.*?\)/g, " ")
		.replace(/-?20\d{6}.*$/, "")
		.replace(/[^a-z0-9]/g, "");
}

function keysFor(...parts) {
	const keys = [];
	for (const part of parts) {
		if (!part) continue;
		const short = String(part).split("/").pop();
		for (const key of [canon(part), canon(short)]) {
			if (key && !keys.includes(key)) keys.push(key);
		}
	}
	return keys;
}

function pricesOf(model) {
	const text = model.cost?.text ?? {};
	const input = numOrNull(text.input?.price) ?? 0;
	const cacheRead = numOrNull(text.input?.cache?.read) ?? input;
	const output = numOrNull(text.output?.price) ?? 0;
	return { input, cacheRead, output };
}

// The console rounds request estimates to two significant digits; match it so
// the table agrees with opencode.ai/console/go.
function roundToTwoSignificant(value) {
	if (!Number.isFinite(value) || value <= 0) return value;
	const step = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 2);
	return Math.round(value / step) * step;
}

export function buildRows(models) {
	return models.map((model) => {
		const usage = model.go?.monthly_usage;
		const prices = pricesOf(model);
		const mix = TOKEN_MIX[model.id] || DEFAULT_TOKEN_MIX;
		const costPerRequest =
			(mix.input * prices.input + mix.cached * prices.cacheRead + mix.output * prices.output) / 1_000_000;

		// A null monthly_usage means an unlimited, limited-time free model.
		const allowanceFor = (tier) => (usage === null ? Infinity : usage?.[tier] ?? null);
		const requestsFor = (allowance) => {
			if (allowance === null) return null;
			if (!(costPerRequest > 0)) return Infinity;
			return roundToTwoSignificant((FIVE_HOUR_RATIO * allowance) / costPerRequest);
		};

		const goAllowance = allowanceFor("go");
		const goPlusAllowance = allowanceFor("go-plus");
		return {
			model: model.name || model.id,
			slug: model.id,
			keys: keysFor(model.id, model.canonical_id, model.name),
			go_requests_5h: requestsFor(goAllowance),
			go_plus_requests_5h: requestsFor(goPlusAllowance),
			go_monthly_limit: goAllowance,
			price: (prices.input + prices.output) / 2,
		};
	});
}

export function attachScores(rows, feeds) {
	const intelligenceIndex = toIndex(feeds.intelligence, (item) => numOrNull(item.intelligence_index));
	const designIndex = toIndex(feeds.design, (item) => numOrNull(item.elo));

	return rows.map((row) => {
		const intelligenceHit = matchRecord(row.keys, intelligenceIndex);
		const designHit = matchRecord(row.keys, designIndex);
		const intelligence = intelligenceHit?.value ?? null;
		const design = designHit ? eloToScore(designHit.value) : null;
		return {
			...row,
			intelligence,
			design,
			quality: weightedAverage([
				[intelligence, INTELLIGENCE_WEIGHT],
				[design, DESIGN_WEIGHT],
			]),
		};
	});
}

export function applyPreset(rows, presetKey) {
	const preset = PRESETS[presetKey] || PRESETS.balanced;
	const finiteRequests = rows.map((row) => row.go_requests_5h).filter((v) => v != null && Number.isFinite(v));
	const maxRequests = finiteRequests.length ? Math.max(...finiteRequests) : 0;
	const prices = rows.map((row) => row.price);
	const minPrice = prices.length ? Math.min(...prices) : 0;
	const maxPrice = prices.length ? Math.max(...prices) : 0;

	for (const row of rows) {
		const throughput = throughputScore(row.go_requests_5h, maxRequests);
		const costScore = costScoreOf(row.price, minPrice, maxPrice);
		row.throughput = throughput;
		row.costScore = costScore;
		row.efficiency = efficiencyOf(row.quality, row.price);
		row.value = valueOf(row.quality, throughput, costScore, preset);
		row.frontier = false;
	}

	const scored = rows.filter((row) => row.quality != null);
	for (const row of scored) {
		row.frontier = !scored.some(
			(other) =>
				other !== row &&
				other.quality >= row.quality &&
				other.price <= row.price &&
				(other.quality > row.quality || other.price < row.price),
		);
	}

	return rows;
}

function throughputScore(requests, maxRequests) {
	if (requests === Infinity) return 100;
	if (requests == null || maxRequests <= 0) return 0;
	return Math.min(100, (100 * requests) / maxRequests);
}

function costScoreOf(price, minPrice, maxPrice) {
	if (price <= 0) return 100;
	if (maxPrice <= minPrice) return 100;
	return (100 * (maxPrice - price)) / (maxPrice - minPrice);
}

function efficiencyOf(quality, price) {
	if (quality == null) return null;
	return price <= 0 ? Infinity : quality / price;
}

function valueOf(quality, throughput, costScore, preset) {
	if (quality == null) return null;
	return preset.wQ * quality + preset.wT * throughput + preset.wC * costScore;
}

function toIndex(items, pick) {
	return (items || [])
		.map((item) => ({
			keys: keysFor(item.model_permaslug, item.display_name),
			value: pick(item),
			label: item.display_name || item.model_permaslug || "",
		}))
		.filter((record) => record.value != null && record.keys.length > 0);
}

function matchRecord(queryKeys, records) {
	for (const record of records) {
		if (record.keys.some((key) => queryKeys.includes(key))) return record;
	}

	// Prefix matches handle date suffixes (…-1017) and longer canonical ids.
	// Prefer the shortest label so a base model wins over its variants.
	let best = null;
	for (const record of records) {
		for (const key of record.keys) {
			for (const query of queryKeys) {
				if (key.length < 6 || query.length < 6) continue;
				if (!key.startsWith(query) && !query.startsWith(key)) continue;
				if (!best || record.label.length < best.label.length) best = record;
			}
		}
	}
	return best;
}

function eloToScore(elo) {
	if (elo == null || Number.isNaN(elo)) return null;
	const normalized = (elo - DESIGN_ELO_FLOOR) / DESIGN_ELO_RANGE;
	return Math.max(0, Math.min(1, normalized)) * 100;
}

function weightedAverage(parts) {
	const present = parts.filter(([value]) => value != null);
	if (!present.length) return null;
	const totalWeight = present.reduce((sum, [, weight]) => sum + weight, 0);
	return present.reduce((sum, [value, weight]) => sum + value * weight, 0) / totalWeight;
}
