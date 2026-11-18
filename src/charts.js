// Scatter chart for score vs Go requests. Rendered as inline SVG; callers pass
// the rows they want plotted so charts stay independent of app state.

function esc(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function renderScatter(hostId, rows, metric, label, { loading = false } = {}) {
	const host = document.getElementById(hostId);
	const points = rows.filter((row) => row[metric] != null && row.go_requests_5h != null);
	if (!points.length) {
		// While loading with no data, leave the host empty so :empty shimmer
		// reserves the chart's space.
		if (!loading || rows.length) host.innerHTML = `<div class="empty">No scored models.</div>`;
		return;
	}

	const finite = points.filter((point) => Number.isFinite(point.go_requests_5h));
	let lo = finite.length ? Math.min(...finite.map((point) => point.go_requests_5h)) : 1;
	let hi = finite.length ? Math.max(...finite.map((point) => point.go_requests_5h)) : 10;
	if (hi <= lo) {
		lo /= 2;
		hi *= 2;
	}

	const W = 760;
	const H = 300;
	const ml = 48;
	const mr = 16;
	const mt = 12;
	const mb = 40;
	const slot = 34;
	const plotW = W - ml - mr - slot;
	const X = (requests) =>
		ml + (1 - (Math.log(requests) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * plotW;
	const XINF = W - mr - 6;
	const Y = (score) => mt + (1 - score / 100) * (H - mt - mb);
	const px = (point) => (point.inf ? XINF : X(point.row.go_requests_5h));
	const byReq = (point) => (point.inf ? Infinity : point.row.go_requests_5h);

	const ticks = [];
	for (let exponent = Math.floor(Math.log10(lo)); exponent <= Math.ceil(Math.log10(hi)) && ticks.length < 10; exponent++) {
		for (const factor of [1, 2, 5]) {
			const tick = factor * 10 ** exponent;
			if (tick >= lo && tick <= hi) ticks.push(tick);
		}
	}

	const plotted = points.map((row) => ({ row, inf: !Number.isFinite(row.go_requests_5h), score: row[metric] }));
	const sorted = [...plotted].sort((a, b) => byReq(a) - byReq(b));

	// Keep only the best point per request level, then walk upward to build the
	// Pareto frontier shown in the chart.
	const perRequest = new Map();
	for (const point of sorted) {
		const key = point.inf ? "inf" : point.row.go_requests_5h;
		const existing = perRequest.get(key);
		if (!existing || point.score > existing.score) perRequest.set(key, point);
	}
	const frontier = [];
	let bestScore = -Infinity;
	for (const point of [...perRequest.values()].sort((a, b) => byReq(a) - byReq(b))) {
		if (point.score > bestScore + 1e-9) {
			frontier.push(point);
			bestScore = point.score;
		}
	}
	const frontierSet = new Set(frontier);

	const f = (number) => number.toFixed(1);
	let frontierPath = "";
	frontier.forEach((point, index) => {
		frontierPath += index ? ` H${f(px(point))} V${f(Y(point.score))}` : `M${f(px(point))} ${f(Y(point.score))}`;
	});

	let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} versus requests scatter plot">`;
	svg += `<line class="axis" x1="${ml}" y1="${mt}" x2="${ml}" y2="${H - mb}"/><line class="axis" x1="${ml}" y1="${H - mb}" x2="${W - mr}" y2="${H - mb}"/>`;
	for (const tick of ticks) {
		svg +=
			`<line class="tick" x1="${f(X(tick))}" y1="${H - mb}" x2="${f(X(tick))}" y2="${H - mb + 5}"/>` +
			`<text x="${f(X(tick))}" y="${H - mb + 18}" text-anchor="middle">${tick >= 1000 ? `${tick / 1000}k` : tick}</text>`;
	}
	svg += `<line class="tick" x1="${f(XINF)}" y1="${H - mb}" x2="${f(XINF)}" y2="${H - mb + 5}"/><text x="${f(XINF)}" y="${H - mb + 18}" text-anchor="middle">∞</text>`;
	for (const score of [0, 25, 50, 75, 100]) {
		svg +=
			`<text x="${ml - 8}" y="${f(Y(score) + 3)}" text-anchor="end">${score}</text>` +
			`<line class="tick" x1="${ml - 5}" y1="${f(Y(score))}" x2="${ml}" y2="${f(Y(score))}"/>`;
	}
	svg += `<text x="${(ml + W - mr) / 2}" y="${H - 4}" text-anchor="middle">Go req/5h (log scale)</text>`;
	if (frontierPath) svg += `<path class="frontier" d="${frontierPath}"/>`;

	for (const point of plotted) {
		const isFrontier = frontierSet.has(point);
		const requestText = point.inf ? "∞ req/5h" : `${point.row.go_requests_5h} req/5h`;
		const monthly = point.row.go_monthly_limit;
		const monthlyText = monthly == null ? "—" : monthly === Infinity ? "∞" : `$${monthly}/mo`;
		const tip = `${point.row.model} · ${label} ${Math.round(point.score)} · ${requestText} · ${monthlyText}`;
		svg += `<circle class="pt${isFrontier ? " front" : ""}" cx="${f(px(point))}" cy="${f(Y(point.score))}" r="${isFrontier ? 6 : 5}" data-tip="${esc(tip)}"/>`;
	}
	svg += `</svg>`;
	host.innerHTML = svg;
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
		tip.textContent = circle.dataset.tip;
		const frame = tip.offsetParent && tip.offsetParent !== document.body ? tip.offsetParent : host;
		const rect = frame.getBoundingClientRect();
		tip.style.display = "block";
		tip.style.left = `${Math.max(0, Math.min(event.clientX - rect.left + 14, rect.width - 220))}px`;
		tip.style.top = `${event.clientY - rect.top + 12}px`;
	});
	host.addEventListener("mouseleave", () => {
		const tip = document.getElementById(tipId);
		if (tip) tip.style.display = "none";
	});
}
