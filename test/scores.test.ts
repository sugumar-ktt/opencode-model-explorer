import { expect, test } from "bun:test";
import { buildRows, modelBadges } from "../src/models.js";
import { applyScorePerDollar, applyScores, applyValue, compositeScore, topByScore, topPicks } from "../src/scores.js";

const weights = { reasoning: 15, coding: 30, costEfficiency: 10, contextWindow: 10, multimodal: 5, toolUse: 30 };
const aspects = { reasoning: 50, coding: 100, costEfficiency: 50, contextWindow: 80, multimodal: 30, toolUse: 50 };
const today = new Date("2026-11-18T12:00:00Z");

test("composite score weights the six aspects and renormalizes missing data", () => {
	expect(compositeScore({ reasoning: 60, coding: 80 }, weights)).toBeCloseTo(73.333);
	expect(compositeScore({ ...aspects, reasoning: 100, coding: 0, costEfficiency: 50 }, weights)).toBeCloseTo(44.5);
	expect(compositeScore({ coding: 90 }, weights)).toBeNull();
});

test("model badges use a 14-day window and the limited-time flag", () => {
	expect(modelBadges({ release_date: "2026-11-16", go: { monthly_usage: null } }, today)).toEqual(["new", "limited"]);
	expect(modelBadges({ release_date: "2026-11-04", go: { monthly_usage: 60 } }, today)).toEqual(["new"]);
	expect(modelBadges({ release_date: "2026-10-17", go: { monthly_usage: 100 } }, today)).toEqual([]);
	expect(modelBadges({ release_date: "2026-10-05", go: { monthly_usage: null } }, today)).toEqual(["limited"]);
});

test("buildRows exposes a readable blended price from list prices", () => {
	const [row] = buildRows(
		[
			{
				id: "test-model",
				name: "Test Model",
				cost: { text: { input: { price: 0.1, cache: { read: 0.01 } }, output: { price: 0.2 } } },
				go: { monthly_usage: 100 },
			},
		],
		{ today },
	);
	expect(row.blended_price).toBeCloseTo(0.15);
	expect(row.price_input).toBe(0.1);
	expect(row.price_output).toBe(0.2);
});

test("value balances score and log-scaled requests, capping free models", () => {
	const rows = applyValue([
		{ score: 80, go_requests_5h: 100 },
		{ score: 60, go_requests_5h: 10 },
		{ score: 50, go_requests_5h: Infinity },
		{ score: null, go_requests_5h: 50 },
	]);
	expect(rows[0].value).toBeCloseTo(90);
	expect(rows[1].value).toBeCloseTo(55);
	expect(rows[2].value).toBeCloseTo(75);
	expect(rows[3].value).toBeNull();
});

test("score per dollar divides by price and marks free models", () => {
	const rows = applyScorePerDollar([
		{ score: 90, blended_price: 0.15 },
		{ score: 50, blended_price: 5 },
		{ score: 60, blended_price: 0 },
		{ score: null, blended_price: 0.1 },
	]);
	expect(rows[0].scorePerDollar).toBeCloseTo(600);
	expect(rows[1].scorePerDollar).toBe(10);
	expect(rows[2].scorePerDollar).toBe(Infinity);
	expect(rows[3].scorePerDollar).toBeNull();
});

test("top picks exclude free models from overall and value, not quality", () => {
	const rows = [
		{ slug: "paid", model: "Paid", score: 90, value: 95, blended_price: 0.15, scorePerDollar: 600 },
		{ slug: "cheap", model: "Cheap", score: 90, value: 70, blended_price: 0.1, scorePerDollar: 900 },
		{ slug: "free", model: "Free", score: 100, value: 100, blended_price: 0, scorePerDollar: Infinity },
	];
	const picks = topPicks(rows);
	expect(picks.overall.winner.slug).toBe("paid");
	expect(picks.quality.winner.slug).toBe("free");
	expect(picks.value.winner.slug).toBe("cheap");
});

test("topByScore returns the highest scoring models first", () => {
	const rows = [{ slug: "a", score: 70 }, { slug: "b", score: 90 }, { slug: "c", score: null }, { slug: "d", score: 80 }];
	expect(topByScore(rows, 2).map((row) => row.slug)).toEqual(["b", "d"]);
	expect(topByScore(rows).map((row) => row.slug)).toEqual(["b", "d", "a"]);
});

test("applyScores attaches the model entry and aspect values", () => {
	const snapshot = { models: { "deepseek-v4.1-flash": { aspects } } };
	const [row] = applyScores([{ slug: "deepseek-v4.1-flash", model: "DeepSeek V4.1 Flash" }], snapshot);
	expect(row.score).toBeCloseTo(compositeScore(aspects, weights));
	expect(row.coding).toBe(100);
	expect(row.modelData).toBe(snapshot.models["deepseek-v4.1-flash"]);
});
