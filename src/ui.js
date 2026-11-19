// DOM layer: renders the ranking table, its charts, top picks and controls.
// State and network orchestration live in main.js; this module reads state only.

import { BADGES, COLUMNS, SCORE_WEIGHTS } from "./config.js";
import { renderAdoption, renderCapacity, renderRetention } from "./charts.js";
import { topByScore, topPicks } from "./scores.js";

const INDICATOR_DELAY_MS = 200;
let indicatorTimer = 0;

export function startLoading({ immediate = false } = {}) {
	clearTimeout(indicatorTimer);
	if (immediate) {
		document.body.classList.add("indicators");
		document.getElementById("refreshIcon")?.classList.add("spin");
		return;
	}
	indicatorTimer = setTimeout(() => {
		document.body.classList.add("indicators");
		document.getElementById("refreshIcon")?.classList.add("spin");
	}, INDICATOR_DELAY_MS);
}

export function stopLoading() {
	clearTimeout(indicatorTimer);
	document.body.classList.remove("indicators");
	document.getElementById("refreshIcon")?.classList.remove("spin");
	document.body.classList.add("ready");
	const refresh = document.getElementById("refresh");
	refresh.disabled = false;
	refresh.removeAttribute("disabled");
}

export function setNotice(kind, text) {
	const notice = document.getElementById("notice");
	notice.className = `notice ${kind}`;
	notice.textContent = text;
	notice.hidden = !text;
}

export function render(state) {
	renderHeader(state);
	renderPicks(state);
	renderHeatmap(state);

	const rows = filteredRows(state);
	renderCapacity("chartCapacity", rows, { loading: state.loading });
	renderAdoption("chartAdoption", rows, { loading: state.loading });
	renderRetention("chartRetention", rows, { loading: state.loading });

	const tbody = document.getElementById("tbody");
	if (!rows.length && !state.loading) {
		const cell = document.createElement("td");
		cell.colSpan = COLUMNS.length;
		cell.className = "empty";
		cell.textContent = emptyMessage(state);
		const tr = document.createElement("tr");
		tr.appendChild(cell);
		tbody.replaceChildren(tr);
		return;
	}
	if (!rows.length) {
		renderSkeleton();
		return;
	}

	const sorted = [...rows].sort((a, b) => compareRows(a, b, state.sortKey, state.sortDir));
	tbody.replaceChildren(...sorted.map((row) => buildRow(row, state)));
}

export function initControls({ state, onRender, onRefresh }) {
	document.getElementById("search").addEventListener("input", (event) => {
		state.search = event.target.value;
		onRender();
	});

	document.getElementById("thead").addEventListener("click", (event) => {
		const header = event.target.closest("th[data-key]");
		if (!header) return;
		const column = COLUMNS.find((item) => item.key === header.dataset.key);
		if (!column) return;
		if (state.sortKey === column.key) {
			state.sortDir = state.sortDir === "desc" ? "asc" : "desc";
		} else {
			state.sortKey = column.key;
			state.sortDir = column.type === "text" ? "asc" : "desc";
		}
		onRender();
	});

	document.getElementById("refresh").addEventListener("click", onRefresh);
}

function renderSkeleton() {
	const rows = Array.from({ length: 8 }, () => {
		const tr = document.createElement("tr");
		tr.className = "skel-row";
		for (const column of COLUMNS) {
			const td = document.createElement("td");
			const bar = document.createElement("span");
			bar.className = "skel";
			bar.style.width = column.type === "text" ? "70%" : "34%";
			td.appendChild(bar);
			tr.appendChild(td);
		}
		return tr;
	});
	document.getElementById("tbody").replaceChildren(...rows);
}

function emptyMessage(state) {
	if (state.loadError) return `Could not load models: ${state.loadError}`;
	if (state.snapshotError) return "Scores are unavailable. Run bun scripts/fetch-opencode-data.ts and refresh.";
	return "No models match your search.";
}

function filteredRows(state) {
	if (!state.search) return state.rows;
	const query = state.search.toLowerCase();
	return state.rows.filter((row) => row.model.toLowerCase().includes(query));
}

function compareRows(a, b, key, direction) {
	let av = a[key];
	let bv = b[key];
	if (av == null && bv == null) return 0;
	if (av == null) return 1;
	if (bv == null) return -1;
	if (typeof av === "string" || typeof bv === "string") {
		const compared = String(av).localeCompare(String(bv));
		return direction === "asc" ? compared : -compared;
	}
	if (av !== bv) return direction === "asc" ? av - bv : bv - av;
	return 0;
}

function renderHeader(state) {
	const tr = document.createElement("tr");
	for (const column of COLUMNS) {
		const th = document.createElement("th");
		th.dataset.key = column.key;
		th.textContent = column.label;
		if (column.description) th.title = column.description;
		if (column.align === "right") th.style.textAlign = "right";
		const arrow = document.createElement("span");
		arrow.className = "arrow";
		arrow.textContent = state.sortKey === column.key ? (state.sortDir === "desc" ? "↓" : "↑") : "↕";
		th.appendChild(arrow);
		if (state.sortKey === column.key) th.classList.add("sorted");
		tr.appendChild(th);
	}
	document.getElementById("thead").replaceChildren(tr);
}

function renderPicks(state) {
	const host = document.getElementById("picks");
	const picks = topPicks(state.rows);
	const sweep = picks.overall.winner && picks.overall.winner.slug === picks.quality.winner?.slug &&
		picks.overall.winner.slug === picks.value.winner?.slug;

	host.replaceChildren();
	const head = document.createElement("div");
	head.className = "picks-head";
	const title = document.createElement("h2");
	title.textContent = "Top picks";
	head.appendChild(title);
	if (sweep) {
		const note = document.createElement("span");
		note.className = "picks-note";
		note.textContent = "One model leads all three";
		head.appendChild(note);
	}
	host.appendChild(head);

	const items = [
		{ label: "Best overall", pick: picks.overall, text: (row) => `${row.value.toFixed(1)} Value` },
		{ label: "Best quality", pick: picks.quality, text: (row) => `${Math.round(row.score)} Score` },
		{ label: "Best value for money", pick: picks.value, text: (row) => `${formatPerDollar(row.scorePerDollar)} Score/$` },
	];
	for (const item of items) {
		const row = document.createElement("div");
		row.className = "pick";
		const label = document.createElement("span");
		label.className = "pick-label";
		label.textContent = item.label;
		row.appendChild(label);
		row.appendChild(pickModel(item.pick.winner));
		const metric = document.createElement("span");
		metric.className = "pick-metric";
		metric.textContent = item.pick.winner ? item.text(item.pick.winner) : "—";
		row.appendChild(metric);
		const next = document.createElement("span");
		next.className = "pick-next";
		next.textContent = item.pick.runnerUp ? `Next: ${item.pick.runnerUp.model}` : "—";
		row.appendChild(next);
		host.appendChild(row);
	}
}

function renderHeatmap(state) {
	const host = document.getElementById("heatmapTable");
	const meta =
		state.snapshot?.aspects ||
		Object.keys(SCORE_WEIGHTS).map((key) => ({ key, label: key }));
	const rows = topByScore(state.rows);
	if (!rows.length) {
		renderHeatmapSkeleton(host, meta);
		return;
	}

	const head = document.createElement("thead");
	const headRow = document.createElement("tr");
	const name = document.createElement("th");
	name.textContent = "Model";
	headRow.appendChild(name);
	for (const aspect of meta) {
		const th = document.createElement("th");
		th.textContent = aspect.label;
		headRow.appendChild(th);
	}
	const scoreHead = document.createElement("th");
	scoreHead.textContent = "Score";
	headRow.appendChild(scoreHead);
	head.appendChild(headRow);

	const body = document.createElement("tbody");
	for (const row of rows) {
		const tr = document.createElement("tr");
		const model = document.createElement("th");
		model.scope = "row";
		model.textContent = row.model;
		for (const badge of row.badges || []) model.appendChild(badgePill(badge));
		tr.appendChild(model);
		for (const aspect of meta) {
			const cell = document.createElement("td");
			const value = row.modelData?.aspects?.[aspect.key];
			if (value == null) {
				cell.className = "heat none";
				cell.textContent = "—";
			} else {
				cell.className = "heat";
				cell.style.setProperty("--heat", `${(8 + value * 0.24).toFixed(1)}%`);
				cell.textContent = String(Math.round(value));
			}
			tr.appendChild(cell);
		}
		const scoreCell = document.createElement("td");
		scoreCell.className = "heat-score";
		scoreCell.textContent = String(Math.round(row.score));
		tr.appendChild(scoreCell);
		body.appendChild(tr);
	}
	host.replaceChildren(head, body);
}

function renderHeatmapSkeleton(host, meta) {
	const head = document.createElement("thead");
	const headRow = document.createElement("tr");
	for (const label of ["Model", ...meta.map((aspect) => aspect.label), "Score"]) {
		const th = document.createElement("th");
		th.textContent = label;
		headRow.appendChild(th);
	}
	head.appendChild(headRow);
	const body = document.createElement("tbody");
	for (let i = 0; i < 12; i++) {
		const tr = document.createElement("tr");
		for (let column = 0; column < meta.length + 2; column++) {
			const td = document.createElement("td");
			const bar = document.createElement("span");
			bar.className = "skel";
			bar.style.width = column === 0 ? "70%" : "40%";
			td.appendChild(bar);
			tr.appendChild(td);
		}
		body.appendChild(tr);
	}
	host.replaceChildren(head, body);
}

function pickModel(row) {
	const span = document.createElement("span");
	span.className = "pick-model";
	if (!row) {
		span.textContent = "—";
		return span;
	}
	span.textContent = row.model;
	for (const badge of row.badges || []) span.appendChild(badgePill(badge));
	return span;
}

function buildRow(row, state) {
	const tr = document.createElement("tr");
	for (const column of COLUMNS) {
		const td = document.createElement("td");
		if (column.type === "text") {
			td.className = "model";
			td.textContent = row.model;
			for (const badge of row.badges || []) td.appendChild(badgePill(badge));
		} else if (column.type === "bar-s") {
			td.className = "num";
			td.appendChild(buildScoreCell(row, state));
		} else {
			td.className = "num";
			td.appendChild(buildNumberCell(column, row));
		}
		tr.appendChild(td);
	}
	return tr;
}

function badgePill(badge) {
	const span = document.createElement("span");
	span.className = `badge badge-${badge}`;
	span.textContent = BADGES[badge] || badge;
	return span;
}

function buildScoreCell(row, state) {
	if (row.score == null) return none();
	const wrapper = document.createElement("div");
	wrapper.className = "score";
	wrapper.tabIndex = 0;
	const breakdown = aspectBreakdown(row, state);
	wrapper.title = `Score ${Math.round(row.score)}/100 · ${breakdown}`;
	wrapper.setAttribute("aria-label", wrapper.title);
	const bar = document.createElement("span");
	bar.className = "bar s";
	const fill = document.createElement("span");
	fill.style.width = `${Math.max(0, Math.min(100, row.score))}%`;
	bar.appendChild(fill);
	const label = document.createElement("span");
	label.className = "val";
	label.textContent = String(Math.round(row.score));
	wrapper.append(bar, label);
	return wrapper;
}

function aspectBreakdown(row, state) {
	const aspects = row.modelData?.aspects || {};
	const labels = new Map((state.snapshot?.aspects || []).map((aspect) => [aspect.key, aspect.label]));
	return Object.keys(SCORE_WEIGHTS)
		.map((key) => `${labels.get(key) || key} ${aspects[key] ?? "—"} (${SCORE_WEIGHTS[key]}%)`)
		.join(", ");
}

function buildNumberCell(column, row) {
	if (row[column.key] == null) return none();
	const span = document.createElement("span");
	span.className = "val";
	if (column.key === "scorePerDollar") {
		span.textContent = formatPerDollar(row.scorePerDollar);
		span.title = moneyTip(row);
		span.tabIndex = 0;
	} else if (column.key === "value") {
		span.textContent = row.value.toFixed(column.digits ?? 1);
		const request = row.request_score == null ? "—" : Math.round(row.request_score);
		span.title = `Value ${row.value.toFixed(1)} · score ${Math.round(row.score)} + request score ${request}`;
		span.tabIndex = 0;
	} else {
		span.textContent = column.digits == null ? formatNumber(row[column.key]) : row[column.key].toFixed(column.digits);
	}
	if (span.title) span.setAttribute("aria-label", span.title);
	return span;
}

function moneyTip(row) {
	if (row.scorePerDollar === Infinity) return "Free model — no charge for tokens.";
	const money = (value) => `$${Number(value ?? 0).toFixed(2)}`;
	return `Score ${Math.round(row.score)} ÷ ${money(row.blended_price)}/1M (average in/out) = ${formatPerDollar(row.scorePerDollar)} · in ${money(row.price_input)} · out ${money(row.price_output)} · cached ${money(row.price_cache)}`;
}

function formatPerDollar(value) {
	if (value == null) return "—";
	if (value === Infinity) return "Free";
	return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}

function none() {
	const span = document.createElement("span");
	span.className = "val none";
	span.textContent = "—";
	return span;
}

function formatNumber(value) {
	if (value === Infinity) return "∞";
	if (Number.isInteger(value)) return String(value);
	return value.toFixed(2);
}
