// Pure transforms: turn the OpenCode model catalog into table rows. No DOM
// access here, so the allowance math can be read and tested on its own.

import { DEFAULT_TOKEN_MIX, FIVE_HOUR_RATIO, NEW_MODEL_DAYS, TOKEN_MIX } from "./config.js";

function numOrNull(value) {
	if (value == null) return null;
	const number = Number(value);
	return Number.isNaN(number) ? null : number;
}

function pricesOf(model) {
	const text = model.cost?.text ?? {};
	const input = numOrNull(text.input?.price) ?? 0;
	const cacheRead = numOrNull(text.input?.cache?.read) ?? input;
	const output = numOrNull(text.output?.price) ?? 0;
	return { input, cacheRead, output };
}

// A null monthly_usage signals an unlimited, limited-time free model.
export function modelBadges(model, today = new Date()) {
	const badges = [];
	const released = model.release_date ? Date.parse(`${model.release_date}T00:00:00Z`) : NaN;
	if (Number.isFinite(released)) {
		const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
		const days = (todayStart - released) / 86_400_000;
		if (days >= 0 && days <= NEW_MODEL_DAYS) badges.push("new");
	}
	if (model.go?.monthly_usage === null) badges.push("limited");
	return badges;
}

// The console rounds request estimates to two significant digits; match it so
// the table agrees with opencode.ai/console/go.
function roundToTwoSignificant(value) {
	if (!Number.isFinite(value) || value <= 0) return value;
	const step = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 2);
	return Math.round(value / step) * step;
}

export function buildRows(models, { today = new Date() } = {}) {
	return models.map((model) => {
		const usage = model.go?.monthly_usage;
		const prices = pricesOf(model);
		const mix = TOKEN_MIX[model.id] || DEFAULT_TOKEN_MIX;
		const costPerRequest =
			(mix.input * prices.input + mix.cached * prices.cacheRead + mix.output * prices.output) / 1_000_000;
		// A simple input/output average keeps Score/$ readable; the cache price is
		// still shown in the tooltip and used in the request estimate above.
		const blendedPrice = (prices.input + prices.output) / 2;

		const allowanceFor = (tier) => (usage === null ? Infinity : usage?.[tier] ?? null);
		const requestsFor = (allowance) => {
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
		};
	});
}
