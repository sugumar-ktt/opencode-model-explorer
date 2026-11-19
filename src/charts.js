// Inline SVG scatter charts. Callers pass rows and axis configuration so the
// charts stay independent of app state.

import { BADGES } from "./config.js";

function esc(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function compact(value) {
	if (value >= 1e12) return `${(value / 1e12).toFixed(value >= 1e13 ? 0 : 1)}T`;
	if (value >= 1e9) return `${(value / 1e9).toFixed(value >= 1e10 ? 0 : 1)}B`;
	if (value >= 1e6) return `${(value / 1e6).toFixed(value >= 1e7 ? 0 : 1)}M`;
	if (value >= 1e3) return `${(value / 1e3).toFixed(value >= 1e4 ? 0 : 1)}K`;
	return String(Math.round(value));
}

function median(values) {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function renderScatter(hostId, rows, options) {
	const {
		caption,
		getX,
		getTip,
		quadrants,
		includeInfinity = false,
		loading = false,
		scale = "log",
		domain = [0, 100],
		xTicks = [0, 25, 50, 75, 100],
		yTicks = [0, 25, 50, 75, 100],
		maxTicks = 12,
		width: W = 760,
		height: H = 300,
	} = options;
	const host = document.getElementById(hostId);
	const isLog = scale === "log";
	const points = rows
		.map((row) => ({ row, score: row.score, value: getX(row) }))
		.filter((point) => {
			if (point.score == null) return false;
			if (point.value === Infinity) return includeInfinity;
			return Number.isFinite(point.value) && (isLog ? point.value > 0 : point.value >= 0);
		});

	if (!points.length) {
		if (!loading || rows.length) host.innerHTML = `<div class="empty">No scored models with chart data.</div>`;
		return;
	}

	const finite = points.filter((point) => Number.isFinite(point.value));
	const values = finite.map((point) => (isLog ? Math.log10(point.value) : point.value));
	let lo = isLog ? Math.min(...values) : domain[0];
	let hi = isLog ? Math.max(...values) : domain[1];
	if (hi <= lo) {
		lo -= 1;
		hi += 1;
	}

	const ml = 48;
	const mr = 20;
	const mt = 16;
	const mb = 42;
	const plotW = W - ml - mr;
	const plotH = H - mt - mb;
	const X = (value) => ml + (((isLog ? Math.log10(value) : value) - lo) / (hi - lo)) * plotW;
	const linearX = (value) => ml + ((value - lo) / (hi - lo)) * plotW;
	const XINF = W - mr - 6;
	const Y = (score) => mt + (1 - score / 100) * plotH;
	const medianX = median(values);

	const ticks = isLog ? [] : xTicks;
	if (isLog) {
		for (let exponent = Math.floor(lo); exponent <= Math.ceil(hi) && ticks.length < maxTicks; exponent++) {
			for (const factor of [1, 2, 5]) {
				const tick = factor * 10 ** exponent;
				if (tick >= 10 ** lo && tick <= 10 ** hi) ticks.push(tick);
			}
		}
	}

	const f = (number) => number.toFixed(1);
	let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(caption)}">`;
	svg += `<line class="axis" x1="${ml}" y1="${mt}" x2="${ml}" y2="${H - mb}"/>`;
	svg += `<line class="axis" x1="${ml}" y1="${H - mb}" x2="${W - mr}" y2="${H - mb}"/>`;
	for (const tick of ticks) {
		const x = isLog ? X(tick) : linearX(tick);
		svg +=
			`<line class="tick" x1="${f(x)}" y1="${H - mb}" x2="${f(x)}" y2="${H - mb + 4}"/>` +
			`<text x="${f(x)}" y="${H - mb + 18}" text-anchor="middle">${isLog ? compact(tick) : `${tick}%`}</text>`;
	}
	if (includeInfinity) {
		svg += `<text x="${XINF}" y="${H - mb + 18}" text-anchor="middle">∞</text>`;
	}
	for (const score of yTicks) {
		svg +=
			`<text x="${ml - 8}" y="${f(Y(score) + 3)}" text-anchor="end">${score}</text>` +
			`<line class="tick" x1="${ml - 5}" y1="${f(Y(score))}" x2="${ml}" y2="${f(Y(score))}"/>`;
	}

	const medianXPos = isLog
		? ml + ((medianX - lo) / (hi - lo)) * plotW
		: linearX(medianX);
	svg += `<line class="quadrant-line" x1="${f(medianXPos)}" y1="${mt}" x2="${f(medianXPos)}" y2="${H - mb}"/>`;
	svg += `<line class="quadrant-line" x1="${ml}" y1="${f(Y(50))}" x2="${W - mr}" y2="${f(Y(50))}"/>`;
	svg += `<text class="quadrant-label" x="${ml + 8}" y="${mt + 12}">${esc(quadrants.topLeft)}</text>`;
	svg += `<text class="quadrant-label" x="${W - mr - 8}" y="${mt + 12}" text-anchor="end">${esc(quadrants.topRight)}</text>`;
	svg += `<text class="quadrant-label" x="${ml + 8}" y="${H - mb - 8}">${esc(quadrants.bottomLeft)}</text>`;
	svg += `<text class="quadrant-label" x="${W - mr - 8}" y="${H - mb - 8}" text-anchor="end">${esc(quadrants.bottomRight)}</text>`;

	for (const point of points) {
		const infinite = point.value === Infinity;
		const cx = infinite ? XINF : X(point.value);
		const highX = infinite || (isLog ? Math.log10(point.value) >= medianX : point.value >= medianX);
		const quadrant = point.score >= 50 ? (highX ? "leaders" : "premium") : highX ? "bulk" : "niche";
		const badges = (point.row.badges || []).join(",");
		svg +=
			`<circle class="pt ${quadrant}" cx="${f(cx)}" cy="${f(Y(point.score))}" r="6" ` +
			`data-model="${esc(point.row.model)}" data-badges="${esc(badges)}" data-tip="${esc(getTip(point.row))}"/>`;
	}
	svg += `</svg>`;
	host.innerHTML = svg;
}

export function renderCapacity(hostId, rows, options = {}) {
	renderScatter(hostId, rows, {
		caption: "Score versus estimated 5-hour request capacity",
		width: 760,
		height: 220,
		yTicks: [0, 50, 100],
		maxTicks: 6,
		includeInfinity: true,
		quadrants: { topLeft: "Constrained", topRight: "Leaders", bottomLeft: "Niche", bottomRight: "Workhorses" },
		getX: (row) => row.go_requests_5h,
		getTip: (row) =>
			`Score ${Math.round(row.score)} · ${row.go_requests_5h === Infinity ? "∞" : compact(row.go_requests_5h)} req/5h · $${row.blended_price?.toFixed(2)}/1M`,
		...options,
	});
}

export function renderAdoption(hostId, rows, options = {}) {
	renderScatter(hostId, rows, {
		caption: "Score versus weekly OpenCode token usage",
		width: 560,
		height: 240,
		quadrants: { topLeft: "Hidden gems", topRight: "Leaders", bottomLeft: "Niche", bottomRight: "Overused" },
		getX: (row) => row.modelData?.usage?.tokens,
		getTip: (row) =>
			`Score ${Math.round(row.score)} · ${compact(row.modelData?.usage?.tokens ?? 0)} tokens · ${compact(row.modelData?.usage?.uniqueUsers ?? 0)} users`,
		...options,
	});
}

export function renderRetention(hostId, rows, options = {}) {
	renderScatter(hostId, rows, {
		caption: "Score versus weekly user retention",
		scale: "linear",
		domain: [40, 100],
		xTicks: [40, 50, 60, 70, 80, 90, 100],
		width: 560,
		height: 240,
		yTicks: [0, 50, 100],
		quadrants: {
			topLeft: "Hype",
			topRight: "Trusted leaders",
			bottomLeft: "Niche",
			bottomRight: "Sticky workhorses",
		},
		getX: (row) => row.modelData?.usage?.weeklyRetentionPercent,
		getTip: (row) =>
			`Retention ${row.modelData?.usage?.weeklyRetentionPercent}% · Score ${Math.round(row.score)} · ${compact(row.modelData?.usage?.tokens ?? 0)} tokens`,
		...options,
	});
}

export function bindChartTip(hostId, tipId) {
	const host = document.getElementById(hostId);
	host.addEventListener("mousemove", (event) => {
		const tip = document.getElementById(tipId);
		const circle = event.target.closest?.("circle");
		if (!circle || !tip) {
			if (tip) tip.style.display = "none";
			return;
		}
		buildTip(tip, circle);
		const frame = tip.offsetParent && tip.offsetParent !== document.body ? tip.offsetParent : host;
		const rect = frame.getBoundingClientRect();
		tip.style.display = "block";
		tip.style.left = `${Math.max(0, Math.min(event.clientX - rect.left + 14, rect.width - 240))}px`;
		tip.style.top = `${event.clientY - rect.top + 12}px`;
	});
	host.addEventListener("mouseleave", () => {
		const tip = document.getElementById(tipId);
		if (tip) tip.style.display = "none";
	});
}

function buildTip(tip, circle) {
	tip.replaceChildren();
	const title = document.createElement("strong");
	title.textContent = circle.dataset.model || "";
	tip.appendChild(title);
	for (const badge of (circle.dataset.badges || "").split(",").filter(Boolean)) {
		const span = document.createElement("span");
		span.className = "tip-badge";
		span.textContent = BADGES[badge] || badge;
		tip.appendChild(span);
	}
	const detail = document.createElement("span");
	detail.className = "tip-detail";
	detail.textContent = circle.dataset.tip || "";
	tip.appendChild(detail);
}
