// DOM layer: rendering, controls and the settings dialog. State and network
// orchestration live in main.js; this module only reads the state it is given.

import { COLUMNS, PRESETS } from "./config.js";
import { renderScatter } from "./charts.js";

const INDICATOR_DELAY_MS = 200;
let indicatorTimer = 0;
let settingsDialog = null;

export function startLoading({ immediate = false } = {}) {
	clearTimeout(indicatorTimer);
	if (immediate) {
		document.body.classList.add("indicators");
		return;
	}
	indicatorTimer = setTimeout(() => document.body.classList.add("indicators"), INDICATOR_DELAY_MS);
}

export function stopLoading() {
	clearTimeout(indicatorTimer);
	document.body.classList.remove("indicators");
	document.body.classList.add("ready");
}

export function setStatus(kind, text, title) {
	document.getElementById("dot").className = `dot ${kind}`;
	const status = document.getElementById("status");
	status.textContent = text;
	status.title = title === undefined ? text : title || "";
	if (!status.getAttribute("title")) status.removeAttribute("title");
}

export function render(state) {
	syncPresets(state.preset);
	renderHeader(state);

	const isLoading = state.loading && state.rows.length === 0;
	document.querySelector("main").classList.toggle("is-loading", isLoading);

	const rows = filteredRows(state);
	const plottable = rows.some(
		(row) => row.go_requests_5h != null && (row.intelligence != null || row.design != null),
	);
	document.getElementById("charts").hidden = !plottable && !isLoading;
	renderScatter("chartIntel", rows, "intelligence", "Intelligence", { loading: state.loading });
	renderScatter("chartDesign", rows, "design", "Design", { loading: state.loading });

	const tbody = document.getElementById("tbody");
	if (!rows.length) {
		// The static skeleton rows in the markup stay put while loading.
		if (state.loading) return;
		tbody.innerHTML = `<tr><td colspan="${COLUMNS.length}" class="empty">${
			state.rows.length ? "No models match your search." : "No data. Click Refresh to fetch."
		}</td></tr>`;
		return;
	}

	const sorted = [...rows].sort((a, b) => compareRows(a, b, state.sortKey, state.sortDir));
	tbody.replaceChildren(...sorted.map((row) => buildRow(row, state)));
}

export function initControls({ state, onPreset, onRender, onRefresh }) {
	document.getElementById("presets").addEventListener("click", (event) => {
		const button = event.target.closest("button[data-preset]");
		if (!button) return;
		state.preset = button.dataset.preset;
		state.sortKey = state.preset === "budget" ? "go_requests_5h" : "value";
		state.sortDir = "desc";
		onPreset();
	});

	document.getElementById("search").addEventListener("input", (event) => {
		state.search = event.target.value;
		onRender();
	});

	document.getElementById("thead").addEventListener("click", (event) => {
		const header = event.target.closest("th[data-key]");
		if (!header) return;
		const column = COLUMNS.find((item) => item.key === header.dataset.key);
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

export function initSettings({ onSave, onSkip, onClear }) {
	settingsDialog = document.getElementById("settings");
	const input = document.getElementById("dlgOrKey");
	const error = document.getElementById("dlgError");

	const close = () => settingsDialog.close();
	const clearError = () => {
		error.hidden = true;
		error.textContent = "";
	};

	document.getElementById("settingsApply").addEventListener("click", () => {
		const key = input.value.trim();
		if (!key) {
			error.textContent = "Enter an OpenRouter API key.";
			error.hidden = false;
			input.focus();
			return;
		}
		clearError();
		close();
		onSave(key);
	});

	document.getElementById("settingsSkip").addEventListener("click", () => {
		clearError();
		close();
		onSkip();
	});

	document.getElementById("settingsCancel").addEventListener("click", () => {
		clearError();
		close();
	});

	document.getElementById("settingsClear").addEventListener("click", () => {
		clearError();
		close();
		onClear();
	});

	settingsDialog.addEventListener("open", clearError);
}

export function openSettings({ firstLoad = false, canClear = false } = {}) {
	setVisible(document.getElementById("settingsCancel"), !firstLoad);
	setVisible(document.getElementById("settingsSkip"), firstLoad);
	setVisible(document.getElementById("settingsClear"), !firstLoad && canClear);
	document.getElementById("dlgError").hidden = true;
	settingsDialog.show();
}

export function setKeyInput(key) {
	document.getElementById("dlgOrKey").value = key;
}

function setVisible(element, visible) {
	element.style.display = visible ? "" : "none";
}

function syncPresets(preset) {
	for (const button of document.querySelectorAll("#presets button")) {
		button.setAttribute("aria-pressed", String(button.dataset.preset === preset));
	}
}

function filteredRows(state) {
	if (!state.search) return state.rows;
	const query = state.search.toLowerCase();
	return state.rows.filter((row) => row.model.toLowerCase().includes(query));
}

function compareRows(a, b, key, direction) {
	let av = a[key];
	let bv = b[key];
	if (key === "go_monthly_limit" || key === "go_plus_monthly_limit") {
		if (av === Infinity) av = 0;
		if (bv === Infinity) bv = 0;
	}
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

function buildRow(row, state) {
	const tr = document.createElement("tr");
	for (const column of COLUMNS) {
		const td = document.createElement("td");
		const value = row[column.key];

		if (column.type === "text") {
			td.className = "model";
			td.textContent = value;
		} else if (column.type === "num") {
			td.className = "num";
			td.textContent = formatNumber(value);
			if (value != null && (column.key === "value" || column.key === "efficiency" || column.key === "quality")) {
				td.title = cellTip(column.key, value, state);
			}
		} else if (column.type.startsWith("bar")) {
			td.className = "num";
			td.appendChild(buildScoreCell(value, column, state));
		}

		tr.appendChild(td);
	}
	return tr;
}

function buildScoreCell(value, column, state) {
	if (value == null) {
		const none = document.createElement("span");
		none.className = "val none";
		none.textContent = "—";
		return none;
	}

	const wrapper = document.createElement("div");
	wrapper.className = "score";
	wrapper.title = cellTip(column.key, value, state);

	const bar = document.createElement("span");
	bar.className = `bar ${column.type.slice(-1)}`;
	const fill = document.createElement("span");
	fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
	bar.appendChild(fill);

	const label = document.createElement("span");
	label.className = "val";
	label.textContent = String(Math.round(value));

	wrapper.append(bar, label);
	return wrapper;
}

function renderHeader(state) {
	const thead = document.getElementById("thead");
	const tr = document.createElement("tr");

	for (const column of COLUMNS) {
		const th = document.createElement("th");
		th.dataset.key = column.key;
		th.textContent = column.label;

		const arrow = document.createElement("span");
		arrow.className = "arrow";
		arrow.textContent = state.sortKey === column.key ? (state.sortDir === "desc" ? "↓" : "↑") : "↕";
		th.appendChild(arrow);

		if (state.sortKey === column.key) th.classList.add("sorted");
		if (column.align === "right") th.style.textAlign = "right";
		tr.appendChild(th);
	}

	thead.replaceChildren(tr);
}

function formatNumber(value) {
	if (value == null) return "—";
	if (value === Infinity) return "∞";
	if (Number.isInteger(value)) return String(value);
	return value.toFixed(2);
}

function cellTip(key, value, state) {
	switch (key) {
		case "intelligence":
			return value == null
				? "Intelligence — no score"
				: `Intelligence ${Math.round(value)}/100 · Artificial Analysis via OpenRouter`;
		case "design":
			return value == null
				? "Design — no data"
				: `Design ${Math.round(value)}/100 · Design Arena Elo, 800–1400 scale`;
		case "quality":
			return value == null
				? "Quality — no data"
				: `Quality ${Math.round(value)}/100 · 0.7 intelligence + 0.3 design`;
		case "efficiency":
			if (value == null) return "Efficiency — no data";
			return value === Infinity
				? "Efficiency — free model"
				: `Quality per $/M tokens: ${value.toFixed(2)}`;
		case "value":
			return value == null
				? "Value — no data"
				: `Value ${value.toFixed(2)} · ${(PRESETS[state.preset] || PRESETS.balanced).label} preset`;
		default:
			return "";
	}
}
