<script lang="ts">
	import { COPY } from "../lib/copy";
</script>

<section id="method" class="method" aria-label="Method">
	<h2>{COPY.methodTitle}</h2>
	<details>
	<summary>{COPY.receipts}</summary>
	<p>
		<strong>Score</strong> is a weighted mean of OpenCode's six normalized 0–100 aspects: Reasoning 15%, Coding 30%,
		Cost efficiency 10%, Context window 10%, Multimodal 5% and Tool use 30%. Hover or focus a Score to see the per-aspect
		values and weights; the aspect heatmap shows them for the top 12 models.
	</p>
	<p>
		<strong>Value</strong> balances Score with the estimated 5-hour request allowance. <strong>Score/$</strong> divides
		Score by the token-mix blended price per 1M tokens; free models show <em>Free</em>. Top picks exclude limited-time free
		models from overall and value, but allow them for quality. A model is <em>New</em> for 14 days after release and
		<em>Limited-time</em> when OpenCode lists no monthly usage limit.
	</p>
	<p>
		<strong>Retention vs Score</strong> is a reality check: retention is the share of users who return the next week.
		Trusted leaders score well and keep users; "hype" scores well but does not. Only models with retention data are plotted.
	</p>
</details>
</section>
