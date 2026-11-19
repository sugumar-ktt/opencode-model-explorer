// Composition root: owns the single state object and wires controls to services.

import { fetchModels, fetchOpenCodeScores } from "./api.js";
import { bindChartTip } from "./charts.js";
import { buildRows } from "./models.js";
import { initSectionNav } from "./nav.js";
import { applyScorePerDollar, applyScores, applyValue } from "./scores.js";
import { initControls, render, setNotice, startLoading, stopLoading } from "./ui.js";

const state = {
	rows: [],
	search: "",
	sortKey: "value",
	sortDir: "desc",
	loading: true,
	loadError: null,
	snapshot: null,
	snapshotError: null,
};

async function refresh() {
	const main = document.querySelector("main");
	startLoading({ immediate: state.rows.length === 0 });
	state.loading = true;
	state.loadError = null;
	state.snapshotError = null;
	setNotice("", "");
	main.setAttribute("aria-busy", "true");
	render(state);

	const [modelsResult, snapshotResult] = await Promise.allSettled([fetchModels(), fetchOpenCodeScores()]);

	if (modelsResult.status === "rejected") {
		console.error(modelsResult.reason);
		state.rows = [];
		state.loadError = modelsResult.reason.message;
		setNotice("err", `Could not load models: ${state.loadError}`);
	} else {
		state.snapshotError = snapshotResult.status === "rejected" ? snapshotResult.reason.message : null;
		state.snapshot = snapshotResult.status === "fulfilled" ? snapshotResult.value : null;
		state.rows = rankRows(modelsResult.value);
		if (state.snapshotError) setNotice("err", `Scores are unavailable: ${state.snapshotError}`);
	}

	state.loading = false;
	stopLoading();
	main.setAttribute("aria-busy", "false");
	render(state);
}

function applyRanking(rows) {
	return applyScorePerDollar(applyValue(applyScores(rows, state.snapshot)));
}

function rankRows(models) {
	return applyRanking(buildRows(models));
}

initControls({
	state,
	onRender: () => render(state),
	onRefresh: () => refresh(),
});

initSectionNav();
bindChartTip("chartCapacity", "chartCapacityTip");
bindChartTip("chartAdoption", "chartAdoptionTip");
bindChartTip("chartRetention", "chartRetentionTip");
refresh();
