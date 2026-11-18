// Endpoints and fixed product data. Secrets never live here; the OpenRouter
// key is supplied by the user at runtime and kept in local storage.

export const API = {
	models: "https://opencode.ai/inference/go/v1/models",
	scores: "https://openrouter.ai/api/v1/benchmarks",
	intelligenceSource: "artificial-analysis",
	designSource: "design-arena",
	maxResults: 100,
};

export const REQUEST_TIMEOUT_MS = 12000;

export const STORAGE_KEYS = {
	openRouterKey: "opencode-model-explorer:openrouter-key",
};

export const PRESETS = {
	budget: { label: "Budget", wQ: 0.3, wT: 0.2, wC: 0.5 },
	balanced: { label: "Balanced", wQ: 0.5, wT: 0.25, wC: 0.25 },
	quality: { label: "Max quality", wQ: 0.8, wT: 0.15, wC: 0.05 },
};

export const COLUMNS = [
	{ key: "model", label: "Model", type: "text", align: "left" },
	{ key: "go_requests_5h", label: "Go req/5h", type: "num", align: "right" },
	{ key: "go_plus_requests_5h", label: "Go+ req/5h", type: "num", align: "right" },
	{ key: "go_monthly_limit", label: "Go $/mo", type: "num", align: "right" },
	{ key: "intelligence", label: "Intelligence", type: "bar-i", align: "right" },
	{ key: "design", label: "Design", type: "bar-d", align: "right" },
	{ key: "quality", label: "Quality", type: "bar-q", align: "right" },
	{ key: "efficiency", label: "Q/$", type: "num", align: "right" },
	{ key: "value", label: "Value", type: "num", align: "right" },
];

// The OpenCode console estimates 5h request allowances from the monthly
// allowance and a typical token mix. Every Go tier spends 20% of its paid
// period in the first five hours, so the ratio is shared.
export const FIVE_HOUR_RATIO = 0.2;

// Typical per-request token mix per model, mirroring the console. Unknown
// models fall back to DEFAULT_TOKEN_MIX. Update alongside new model releases.
export const TOKEN_MIX = {
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
	"hy4": { input: 830, cached: 71500, output: 295 },
	"hy4-preview": { input: 830, cached: 71500, output: 295 },
	"hy3": { input: 830, cached: 71500, output: 295 },
};

export const DEFAULT_TOKEN_MIX = { input: 800, cached: 65000, output: 250 };
