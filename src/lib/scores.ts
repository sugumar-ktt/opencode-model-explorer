import { SCORE_WEIGHTS } from "./config";
import type { Row, Snapshot } from "./types";

const MIN_ASPECTS = 2;

export function compositeScore(aspects: Record<string, number | null> | null, weights: Record<string, number>): number | null {
	if (!aspects) return null;
	const present = Object.keys(weights).filter(
		(key) => aspects[key] != null && Number.isFinite(aspects[key]),
	);
	if (present.length < MIN_ASPECTS) return null;

	let weighted = 0;
	let total = 0;
	for (const key of present) {
		const weight = weights[key];
		weighted += (aspects[key] as number) * weight;
		total += weight;
	}
	return total > 0 ? weighted / total : null;
}

export function applyScores(rows: Row[], snapshot: Snapshot | null): Row[] {
	const models = snapshot?.models ?? {};
	return rows.map((row) => {
		const entry = models[row.slug] || models[row.model] || null;
		const aspects = entry?.aspects ?? null;
		const score = compositeScore(aspects, SCORE_WEIGHTS);
		const next: Row = { ...row, modelData: entry, score };
		for (const key of Object.keys(SCORE_WEIGHTS)) next[key] = aspects?.[key] ?? null;
		return next;
	});
}

export function applyValue(rows: Row[]): Row[] {
	const finite = rows
		.map((row) => row.go_requests_5h)
		.filter((requests): requests is number => requests != null && Number.isFinite(requests) && requests > 0);
	const maxRequests = finite.length ? Math.max(...finite) : 0;

	return rows.map((row) => {
		const requestScore = requestScoreOf(row.go_requests_5h, maxRequests);
		const value = row.score == null || requestScore == null ? null : 0.5 * row.score + 0.5 * requestScore;
		return { ...row, request_score: requestScore, value };
	});
}

function requestScoreOf(requests: number | null, maxRequests: number): number | null {
	if (requests == null) return null;
	if (requests === Infinity) return 100;
	if (!(requests > 0) || !(maxRequests > 1)) return 0;
	return Math.min(100, (100 * Math.log(requests)) / Math.log(maxRequests));
}

export function applyScorePerDollar(rows: Row[]): Row[] {
	return rows.map((row) => {
		const price = row.blended_price;
		let scorePerDollar: number | null = null;
		if (row.score != null && price != null) {
			scorePerDollar = price <= 0 ? Infinity : row.score / price;
		}
		return { ...row, scorePerDollar };
	});
}

export function topByScore(rows: Row[], limit = 12): Row[] {
	return rows
		.filter((row) => row.score != null)
		.sort((a, b) => (b.score as number) - (a.score as number))
		.slice(0, limit);
}

function rankBy(rows: Row[], getters: Array<(row: Row) => number | null | undefined>): Row[] {
	return [...rows].sort((a, b) => {
		for (const get of getters) {
			const av = get(a) ?? -Infinity;
			const bv = get(b) ?? -Infinity;
			if (av !== bv) return av > bv ? -1 : 1;
		}
		return 0;
	});
}

function pick(rows: Row[], getters: Array<(row: Row) => number | null | undefined>) {
	const ranked = rankBy(rows, getters);
	return { winner: ranked[0] ?? null, runnerUp: ranked[1] ?? null };
}

export type Pick = ReturnType<typeof pick>;
export type TopPicks = { overall: Pick; quality: Pick; value: Pick };

export function topPicks(rows: Row[]): TopPicks {
	const paid = rows.filter(
		(row) =>
			row.score != null &&
			row.value != null &&
			row.scorePerDollar != null &&
			row.blended_price > 0,
	);
	const quality = rows.filter((row) => row.score != null);
	return {
		overall: pick(paid, [(row) => row.value, (row) => row.score, (row) => row.scorePerDollar]),
		quality: pick(quality, [(row) => row.score, (row) => row.value, (row) => row.scorePerDollar]),
		value: pick(paid, [(row) => row.scorePerDollar, (row) => row.score, (row) => row.value]),
	};
}
