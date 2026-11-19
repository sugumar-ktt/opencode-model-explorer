# opencode-model-explorer

Single-page ranking of OpenCode Go models by OpenCode's capability scores, value, request capacity and real usage.

## Run

The page uses ES modules, so serve it over HTTP (opening `index.html` from disk will not work):

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. No API key is needed.

## Ranking

All scores come from [OpenCode Data](https://opencode.ai/data/): six normalized 0–100 aspects (Reasoning, Coding, Cost efficiency, Context window, Multimodal, Tool use).

- **Score** is a fixed weighted mean of the six aspects: Coding 30%, Tool use 30%, Reasoning 15%, Cost efficiency 10%, Context window 10%, Multimodal 5%. Hover or focus a Score for the per-aspect values; the aspect heatmap shows them for the top 12 models.
- **Value** balances Score with the estimated 5-hour request allowance.
- **Score/$** divides Score by the average input/output price per 1M tokens. Free models show **Free**.
- **Top picks** show the best overall, best quality and best value for money, each with a runner-up. Limited-time free models are excluded from overall and value.
- **Capability vs Capacity** plots Score against estimated 5-hour requests; **Capability vs Adoption** plots Score against weekly tokens; **Retention vs Score** is a reality check using the share of users who return the next week. Models newer than 14 days get a **New** badge; models with no monthly usage limit get **Limited-time**.

Model names, prices and allowances come from `https://opencode.ai/inference/go/v1/models`. Request estimates are derived from the monthly allowance and a per-model token mix. OpenCode's 50/100 placeholder means "supported but no comparable benchmark"; 0/100 means no measured score.

## Refreshing scores

OpenCode Data endpoints send no CORS headers, so a [Bun](https://bun.sh) script builds a static snapshot that the page loads from its own origin:

```sh
bun scripts/fetch-opencode-data.ts
```

This writes `data/opencode-scores.json` (checked in, refreshed on demand). The script fails loudly if any model's aspect scores are missing. Refresh the page after regenerating it.

Run the pure transform tests with:

```sh
bun test
```
