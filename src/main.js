// Composition root: owns the single state object, wires controls to services
// and decides when the key prompt is needed.

import "@material/web/all.js";
import { fetchModels, fetchScores } from "./api.js";
import { bindChartTip } from "./charts.js";
import { applyPreset, attachScores, buildRows } from "./scoring.js";
import { currentKey, hasKey, setKey } from "./storage.js";
import {
	initControls,
	initSettings,
	openSettings,
	render,
	setKeyInput,
	setStatus,
	startLoading,
	stopLoading,
} from "./ui.js";

const state = {
	rows: [],
	sortKey: "value",
	sortDir: "desc",
	search: "",
	preset: "balanced",
	loading: true,
};

async function refresh({ withScores = hasKey() } = {}) {
	startLoading({ immediate: state.rows.length === 0 });
	state.loading = true;
	setStatus("loading", "Fetching…");
	render(state);

	let scoreError = null;
	const scoresRequested = withScores && hasKey();
	try {
		let rows = buildRows(await fetchModels());
		if (scoresRequested) {
			try {
				rows = attachScores(rows, await fetchScores(currentKey()));
			} catch (error) {
				scoreError = error;
			}
		}
		state.rows = applyPreset(rows, state.preset);
		reportStatus(scoreError, scoresRequested);
	} catch (error) {
		console.error(error);
		state.rows = [];
		setStatus("err", "Could not load models", error.message);
	} finally {
		state.loading = false;
		stopLoading();
		render(state);
	}
}

function reportStatus(scoreError, scoresRequested) {
	const scored = state.rows.filter((row) => row.quality != null).length;

	if (!scoresRequested) {
		setStatus(
			"err",
			`${state.rows.length} models · no scores`,
			"Add an OpenRouter API key in settings to load scores.",
		);
		return;
	}
	if (scoreError) {
		setStatus("err", `${state.rows.length} models · scores failed`, scoreError.message);
		return;
	}
	setStatus(
		"ok",
		`${state.rows.length} models · ${scored} scored`,
		"Scores: Artificial Analysis and Design Arena via OpenRouter · req/5h estimated from monthly allowance and token prices",
	);
}

initControls({
	state,
	onPreset: () => {
		applyPreset(state.rows, state.preset);
		render(state);
	},
	onRender: () => render(state),
	onRefresh: () => refresh(),
});

initSettings({
	onSave: (key) => {
		setKey(key);
		refresh({ withScores: true });
	},
	onSkip: () => {
		reportStatus(null, false);
	},
	onClear: () => {
		setKey("");
		refresh({ withScores: false });
	},
});

bindChartTip("chartIntel", "chartIntelTip");
bindChartTip("chartDesign", "chartDesignTip");

document.getElementById("gear").addEventListener("click", () => {
	setKeyInput(currentKey());
	openSettings({ canClear: hasKey() });
});

if (hasKey()) {
	setKeyInput(currentKey());
} else {
	openSettings({ firstLoad: true });
}

refresh({ withScores: hasKey() });
