import { expect, test } from "bun:test";
import { buildRows, modelBadges } from "../src/lib/models";
import { applyScorePerDollar, applyScores, applyValue, compositeScore, topByScore, topPicks } from "../src/lib/scores";
import type { Row } from "../src/lib/types";

const weights = { reasoning: 15, coding: 30, costEfficiency: 10, contextWindow: 10, multimodal: 5, toolUse: 30 };
const aspects = { reasoning: 50, coding: 100, costEfficiency: 50, contextWindow: 80, multimodal: 30, toolUse: 50 };
const today = new Date("2026-11-18T12:00:00Z");

function row(values: Partial<Row> = {}): Row {
	return {
		model: "Test Model",
		slug: "test-model",
		badges: [],
		go_requests_5h: null,
		blended_price: 0,
		price_input: 0,
		price_output: 0,
		price_cache: 0,
		modelData: null,
		score: null,
		request_score: null,
		value: null,
		scorePerDollar: null,
		...values,
	};
}

test("composite score weights the six aspects and renormalizes missing data", () => {
	expect(compositeScore({ reasoning: 60, coding: 80 }, weights)).toBeCloseTo(73.333);
	expect(compositeScore({ ...aspects, reasoning: 100, coding: 0, costEfficiency: 50 }, weights)).toBeCloseTo(44.5);
	expect(compositeScore({ coding: 90 }, weights)).toBeNull();
});

test("model badges use a 14-day window and the limited-time flag", () => {
	expect(modelBadges({ id: "a", release_date: "2026-11-16", go: { monthly_usage: null } }, today)).toEqual(["new", "limited"]);
	expect(modelBadges({ id: "b", release_date: "2026-11-04", go: { monthly_usage: { go: 60 } } }, today)).toEqual(["new"]);
	expect(modelBadges({ id: "c", release_date: "2026-10-17", go: { monthly_usage: { go: 100 } } }, today)).toEqual([]);
	expect(modelBadges({ id: "d", release_date: "2026-10-05", go: { monthly_usage: null } }, today)).toEqual(["limited"]);
});

test("buildRows exposes a readable blended price from list prices", () => {
	const [result] = buildRows(
		[
			{
				id: "test-model",
				name: "Test Model",
				cost: { text: { input: { price: 0.1, cache: { read: 0.01 } }, output: { price: 0.2 } } },
				go: { monthly_usage: { go: 100 } },
			},
		],
		{ today },
	);
	expect(result.blended_price).toBeCloseTo(0.15);
	expect(result.price_input).toBe(0.1);
	expect(result.price_output).toBe(0.2);
});

test("value balances score and log-scaled requests, capping free models", () => {
	const results = applyValue([
		row({ score: 80, go_requests_5h: 100 }),
		row({ score: 60, go_requests_5h: 10 }),
		row({ score: 50, go_requests_5h: Infinity }),
		row({ score: null, go_requests_5h: 50 }),
	]);
	expect(results[0].value).toBeCloseTo(90);
	expect(results[1].value).toBeCloseTo(55);
	expect(results[2].value).toBeCloseTo(75);
	expect(results[3].value).toBeNull();
});

test("score per dollar divides by price and marks free models", () => {
	const results = applyScorePerDollar([
		row({ score: 90, blended_price: 0.15 }),
		row({ score: 50, blended_price: 5 }),
		row({ score: 60, blended_price: 0 }),
		row({ score: null, blended_price: 0.1 }),
	]);
	expect(results[0].scorePerDollar).toBeCloseTo(600);
	expect(results[1].scorePerDollar).toBe(10);
	expect(results[2].scorePerDollar).toBe(Infinity);
	expect(results[3].scorePerDollar).toBeNull();
});

test("top picks exclude free models from overall and value, not quality", () => {
	const rows = [
		row({ slug: "paid", score: 90, value: 95, blended_price: 0.15, scorePerDollar: 600 }),
		row({ slug: "cheap", score: 90, value: 70, blended_price: 0.1, scorePerDollar: 900 }),
		row({ slug: "free", score: 100, value: 100, blended_price: 0, scorePerDollar: Infinity }),
	];
	const picks = topPicks(rows);
	expect(picks.overall.winner?.slug).toBe("paid");
	expect(picks.quality.winner?.slug).toBe("free");
	expect(picks.value.winner?.slug).toBe("cheap");
});

test("topByScore returns the highest scoring models first", () => {
	const rows = [
		row({ slug: "a", score: 70 }),
		row({ slug: "b", score: 90 }),
		row({ slug: "c", score: null }),
		row({ slug: "d", score: 80 }),
	];
	expect(topByScore(rows, 2).map((item) => item.slug)).toEqual(["b", "d"]);
	expect(topByScore(rows).map((item) => item.slug)).toEqual(["b", "d", "a"]);
});

test("applyScores attaches the model entry and aspect values", () => {
	const snapshot = { models: { "deepseek-v4.1-flash": { aspects } } };
	const [result] = applyScores([row({ slug: "deepseek-v4.1-flash" })], snapshot as never);
	expect(result.score ?? 0).toBeCloseTo(compositeScore(aspects, weights) as number);
	expect(result.coding).toBe(100);
	expect(result.modelData?.aspects).toBe(aspects);
});
