# opencode-model-explorer

Single-page explorer for OpenCode Go models: monthly allowances, estimated 5-hour request limits and benchmark scores.

## Run

The page uses ES modules, so serve it over HTTP (opening `index.html` from disk will not work):

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## API key

Model data and monthly allowances come from `https://opencode.ai/inference/go/v1/models`. No proxy or scraping is involved.

Scores come from the OpenRouter Data API. On first load the page prompts for an OpenRouter API key, stores it in this browser only, and never ships a key in the source. Choose **Continue without scores** to browse models while a key is unavailable.
