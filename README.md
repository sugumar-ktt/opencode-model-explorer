# opencode-model-explorer

Single-page ranking of OpenCode Go models by OpenCode's capability scores, value, request capacity and real usage. Built with Svelte 5, TypeScript, Vite, Noph UI (Material 3 Expressive) and SveltePlot.

## Run

```sh
bun install
bun run dev
```

Open <http://localhost:5173>. No API key is needed.

Production build:

```sh
bun run build
bun run preview
```

The build output is `dist/` and can be hosted as static files.

## Ranking

All scores come from [OpenCode Data](https://opencode.ai/data/): six normalized 0–100 aspects (Reasoning, Coding, Cost efficiency, Context window, Multimodal, Tool use).

- **Score** is a fixed weighted mean: Coding 30%, Tool use 30%, Reasoning 15%, Cost efficiency 10%, Context window 10%, Multimodal 5%. Hover or focus a Score for the per-aspect values.
- **Value** balances Score with the estimated 5-hour request allowance.
- **Score/$** divides Score by the average input/output price per 1M tokens; free models show **Free**.
- **Top picks** show the best overall, best quality and best value for money, each with a runner-up. Limited-time free models are excluded from overall and value.
- **Capability vs Capacity**, **Capability vs Adoption** and **Retention vs Score** are scatter plots; the aspect heatmap shows the top 12 models across all six aspects.
- Models newer than 14 days get a **New** badge; models with no monthly usage limit get **Limited-time**.

Model names, prices and allowances come from `https://opencode.ai/inference/go/v1/models`. OpenCode's 50/100 placeholder means "supported but no comparable benchmark"; 0/100 means no measured score.

## Refreshing scores

OpenCode Data endpoints send no CORS headers, so a [Bun](https://bun.sh) script builds a static snapshot that the app loads from its own origin:

```sh
bun scripts/fetch-opencode-data.ts
```

This writes `public/data/opencode-scores.json` (checked in, refreshed on demand). The script fails loudly if any model's aspect scores are missing. Reload the page after regenerating it.

## Theme and copy

`src/theme.css` is generated from the violet/pink/mint “Arcade Candy” palette:
`bun scripts/generate-theme.ts`. UI microcopy lives in `src/lib/copy.ts`.

## Checks

```sh
bun test        # pure transforms
bun run check   # svelte-check + TypeScript
bun run build   # production bundle
bun run shots   # 1440px + 375px screenshots in light/dark (needs Chromium)
```
