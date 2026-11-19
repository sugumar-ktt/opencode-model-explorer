import type { BadgeKey, Column } from "./types";

export const API = {
	models: "https://opencode.ai/inference/go/v1/models",
};

export const REQUEST_TIMEOUT_MS = 12000;
export const OPENCODE_DATA_URL = "/data/opencode-scores.json";

// The only Score formula: Coding and Tool use carry 30% each.
export const SCORE_WEIGHTS: Record<string, number> = {
	reasoning: 15,
	coding: 30,
	costEfficiency: 10,
	contextWindow: 10,
	multimodal: 5,
	toolUse: 30,
};

export const NEW_MODEL_DAYS = 14;

export const BADGES: Record<BadgeKey, string> = {
	new: "New",
	limited: "Limited-time",
};

export const COLUMNS: Column[] = [
	{ key: "model", label: "Model", type: "text", align: "left" },
	{
		key: "score",
		label: "Score",
		type: "bar-s",
		align: "right",
		description: "Weighted mean of OpenCode's six aspect scores, 0-100",
	},
	{
		key: "value",
		label: "Value",
		type: "num",
		align: "right",
		digits: 1,
		description: "Half Score, half log-scaled 5-hour request capacity",
	},
	{
		key: "scorePerDollar",
		label: "Score/$",
		type: "num",
		align: "right",
		description: "Score divided by the average input/output price per 1M tokens",
	},
	{
		key: "go_requests_5h",
		label: "Go req/5h",
		type: "num",
		align: "right",
		description: "Estimated requests in five hours from allowance and token prices",
	},
];

export const FIVE_HOUR_RATIO = 0.2;

export const TOKEN_MIX: Record<string, { input: number; cached: number; output: number }> = {
	"grok-4.7": { input: 390, cached: 32500, output: 120 },
	"glm-5.3-flash": { input: 1000, cached: 55000, output: 200 },
	"glm-5.3": { input: 700, cached: 52000, output: 150 },
	"glm-5.2": { input: 700, cached: 52000, output: 150 },
	"gpt-6-luna": { input: 1000, cached: 50000, output: 220 },
	"gpt-5.6-luna": { input: 1000, cached: 50000, output: 220 },
	"claude-haiku-5-5": { input: 1100, cached: 55000, output: 240 },
	"kimi-k3.1-pro": { input: 1050, cached: 76500, output: 300 },
	"kimi-k3": { input: 1050, cached: 76500, output: 300 },
	"kimi-k2.7-code": { input: 870, cached: 55000, output: 200 },
	"longcat-2.0": { input: 920, cached: 88900, output: 200 },
	"step-5-preview": { input: 1000, cached: 55000, output: 200 },
	"deepseek-v4.1-flash": { input: 410, cached: 71300, output: 310 },
	"deepseek-v4-pro": { input: 750, cached: 82000, output: 290 },
	"minimax-m3.1-flash": { input: 500, cached: 49400, output: 360 },
	"minimax-m3": { input: 510, cached: 56000, output: 190 },
	"muse-spark-1.3-contributor": { input: 620, cached: 71400, output: 300 },
	"muse-spark-1.2-contributor": { input: 620, cached: 71400, output: 300 },
	"mimo-v2.6-flash": { input: 830, cached: 71500, output: 295 },
	"mimo-v2.6-pro": { input: 790, cached: 86000, output: 305 },
	"qwen4-max": { input: 420, cached: 66000, output: 200 },
	"qwen3.8-max": { input: 420, cached: 66000, output: 200 },
	"qwen3.8-flash": { input: 600, cached: 58000, output: 200 },
	"qwen3.7-plus": { input: 500, cached: 57000, output: 190 },
	hy4: { input: 830, cached: 71500, output: 295 },
	"hy4-preview": { input: 830, cached: 71500, output: 295 },
	hy3: { input: 830, cached: 71500, output: 295 },
};

export const DEFAULT_TOKEN_MIX = { input: 800, cached: 65000, output: 250 };
