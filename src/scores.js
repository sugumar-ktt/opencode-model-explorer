// Pure transforms for the OpenCode Data ranking. No DOM or network access here.

import { SCORE_WEIGHTS } from "./config.js";

const MIN_ASPECTS = 2;

// Weighted mean over the aspects that have data. OpenCode's scores already sit
// on a 0-100 scale, including its neutral placeholders, so no normalization is
// needed here.
export function compositeScore(aspects, weights) {
	if (!aspects) return null;
	const keys = Object.keys(weights);
	const present = keys.filter((key) => aspects[key] != null && Number.isFinite(aspects[key]));
	if (present.length < MIN_ASPECTS) return null;

	let weighted = 0;
	let total = 0;
	for (const key of present) {
		const weight = weights[key];
		weighted += aspects[key] * weight;
		total += weight;
	}
	return total > 0 ? weighted / total : null;
}

export function applyScores(rows, snapshot) {
	const models = snapshot?.models || {};
	const aspectKeys = Object.keys(SCORE_WEIGHTS);

	return rows.map((row) => {
		const entry = models[row.slug] || models[row.model] || null;
		const aspects = entry?.aspects || null;
		const next = { ...row, modelData: entry, score: compositeScore(aspects, SCORE_WEIGHTS) };
		for (const key of aspectKeys) next[key] = aspects?.[key] ?? null;
		return next;
	});
}

// Value balances capability with how many requests the plan allows. The request
// component is log-scaled so a single free model cannot dominate the ranking.
export function applyValue(rows) {
	const finite = rows
		.map((row) => row.go_requests_5h)
		.filter((requests) => requests != null && Number.isFinite(requests) && requests > 0);
	const maxRequests = finite.length ? Math.max(...finite) : 0;

	return rows.map((row) => {
		const requestScore = requestScoreOf(row.go_requests_5h, maxRequests);
		const value = row.score == null || requestScore == null ? null : 0.5 * row.score + 0.5 * requestScore;
		return { ...row, request_score: requestScore, value };
	});
}

function requestScoreOf(requests, maxRequests) {
	if (requests == null) return null;
	if (requests === Infinity) return 100;
	if (!(requests > 0) || !(maxRequests > 1)) return 0;
	return Math.min(100, (100 * Math.log(requests)) / Math.log(maxRequests));
}

// Money efficiency per model. A zero price is marked as Infinity ("Free") so
// it sorts above paid models without dividing by zero.
export function applyScorePerDollar(rows) {
	return rows.map((row) => {
		const price = row.blended_price;
		let scorePerDollar = null;
		if (row.score != null && price != null) {
			scorePerDollar = price <= 0 ? Infinity : row.score / price;
		}
		return { ...row, scorePerDollar };
	});
}

function rankBy(rows, getters) {
	return [...rows].sort((a, b) => {
		for (const get of getters) {
			const av = get(a) ?? -Infinity;
			const bv = get(b) ?? -Infinity;
			if (av !== bv) return av > bv ? -1 : 1;
		}
		return 0;
	});
}

function pick(rows, getters) {
	const ranked = rankBy(rows, getters);
	return { winner: ranked[0] ?? null, runnerUp: ranked[1] ?? null };
}

// Models with the highest Score, for compact comparison views.
export function topByScore(rows, limit = 12) {
	return rows
		.filter((row) => row.score != null)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
}

// Global recommendations, independent of search and current sort. Limited-time
// free models are excluded from overall and value because their price is zero.
export function topPicks(rows) {
	const paid = rows.filter(
		(row) => row.score != null && row.value != null && row.scorePerDollar != null && row.blended_price > 0,
	);
	const quality = rows.filter((row) => row.score != null);
	return {
		overall: pick(paid, [(row) => row.value, (row) => row.score, (row) => row.scorePerDollar]),
		quality: pick(quality, [(row) => row.score, (row) => row.value, (row) => row.scorePerDollar]),
		value: pick(paid, [(row) => row.scorePerDollar, (row) => row.score, (row) => row.value]),
	};
}
