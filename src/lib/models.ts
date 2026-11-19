import { DEFAULT_TOKEN_MIX, FIVE_HOUR_RATIO, NEW_MODEL_DAYS, TOKEN_MIX } from "./config";
import type { BadgeKey, CatalogModel, Row } from "./types";

function numOrNull(value: unknown): number | null {
	if (value == null) return null;
	const number = Number(value);
	return Number.isNaN(number) ? null : number;
}

function pricesOf(model: CatalogModel): { input: number; cacheRead: number; output: number } {
	const text = model.cost?.text ?? {};
	const input = numOrNull(text.input?.price) ?? 0;
	const cacheRead = numOrNull(text.input?.cache?.read) ?? input;
	const output = numOrNull(text.output?.price) ?? 0;
	return { input, cacheRead, output };
}

export function modelBadges(model: CatalogModel, today = new Date()): BadgeKey[] {
	const badges: BadgeKey[] = [];
	const released = model.release_date ? Date.parse(`${model.release_date}T00:00:00Z`) : NaN;
	if (Number.isFinite(released)) {
		const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
		const days = (todayStart - released) / 86_400_000;
		if (days >= 0 && days <= NEW_MODEL_DAYS) badges.push("new");
	}
	if (model.go?.monthly_usage === null) badges.push("limited");
	return badges;
}

function roundToTwoSignificant(value: number): number {
	if (!Number.isFinite(value) || value <= 0) return value;
	const step = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 2);
	return Math.round(value / step) * step;
}

export function buildRows(models: CatalogModel[], { today = new Date() } = {}): Row[] {
	return models.map((model) => {
		const usage = model.go?.monthly_usage;
		const prices = pricesOf(model);
		const mix = TOKEN_MIX[model.id] || DEFAULT_TOKEN_MIX;
		const costPerRequest =
			(mix.input * prices.input + mix.cached * prices.cacheRead + mix.output * prices.output) / 1_000_000;
		const blendedPrice = (prices.input + prices.output) / 2;

		const allowanceFor = (tier: string): number | null =>
			usage === null ? Infinity : (usage?.[tier] ?? null);
		const requestsFor = (allowance: number | null): number | null => {
			if (allowance === null) return null;
			if (!(costPerRequest > 0)) return Infinity;
			return roundToTwoSignificant((FIVE_HOUR_RATIO * allowance) / costPerRequest);
		};

		return {
			model: model.name || model.id,
			slug: model.id,
			badges: modelBadges(model, today),
			go_requests_5h: requestsFor(allowanceFor("go")),
			blended_price: blendedPrice,
			price_input: prices.input,
			price_output: prices.output,
			price_cache: prices.cacheRead,
			modelData: null,
			score: null,
			request_score: null,
			value: null,
			scorePerDollar: null,
		};
	});
}
