<script lang="ts">
	import Badge from "./Badge.svelte";
	import { COLUMNS, SCORE_WEIGHTS } from "../lib/config";
	import { formatNumber, formatPerDollar, money } from "../lib/format";
	import type { AspectMeta, Column, Row } from "../lib/types";

	let {
		rows,
		sortKey,
		sortDir,
		meta,
		onSort,
		emptyMessage,
	}: {
		rows: Row[];
		sortKey: string;
		sortDir: "asc" | "desc";
		meta: AspectMeta[];
		onSort: (key: string) => void;
		emptyMessage: string;
	} = $props();

	const labels = $derived(new Map(meta.map((aspect) => [aspect.key, aspect.label])));

	function scoreTip(row: Row): string {
		const aspects = row.modelData?.aspects ?? {};
		const parts = Object.keys(SCORE_WEIGHTS).map(
			(key) => `${labels.get(key) || key} ${aspects[key] ?? "—"} (${SCORE_WEIGHTS[key]}%)`,
		);
		return `Score ${Math.round(row.score as number)}/100 · ${parts.join(", ")}`;
	}

	function valueTip(row: Row): string {
		const request = row.request_score == null ? "—" : Math.round(row.request_score);
		return `Value ${row.value?.toFixed(1)} · score ${Math.round(row.score as number)} + request score ${request}`;
	}

	function moneyTip(row: Row): string {
		if (row.scorePerDollar === Infinity) return "Free model — no charge for tokens.";
		return `Score ${Math.round(row.score as number)} ÷ ${money(row.blended_price)}/1M (average in/out) = ${formatPerDollar(row.scorePerDollar)} · in ${money(row.price_input)} · out ${money(row.price_output)} · cached ${money(row.price_cache)}`;
	}

	function cellText(column: Column, row: Row): string {
		if (column.key === "scorePerDollar") return formatPerDollar(row.scorePerDollar);
		if (column.key === "value") return (row.value as number).toFixed(column.digits ?? 1);
		return formatNumber(row[column.key] as number);
	}

	function cellTitle(column: Column, row: Row): string {
		if (column.key === "score") return scoreTip(row);
		if (column.key === "value") return valueTip(row);
		if (column.key === "scorePerDollar") return moneyTip(row);
		return "";
	}
</script>

<div class="table-scroll">
	<table>
		<thead id="thead">
			<tr>
				{#each COLUMNS as column (column.key)}
					<th
						data-key={column.key}
						title={column.description || undefined}
						class:sorted={sortKey === column.key}
						style:text-align={column.align === "right" ? "right" : undefined}
						onclick={() => onSort(column.key)}
					>
						{column.label}<span class="arrow">{sortKey === column.key ? (sortDir === "desc" ? "↓" : "↑") : "↕"}</span>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody id="tbody">
			{#if rows.length === 0}
				<tr><td class="empty" colspan={COLUMNS.length}>{emptyMessage}</td></tr>
			{:else}
				{#each rows as row (row.slug)}
					<tr>
						{#each COLUMNS as column (column.key)}
							<td class={column.type === "text" ? "model" : "num"}>
								{#if column.type === "text"}
									{row.model}
									{#each row.badges as badge (badge)}<Badge {badge} />{/each}
								{:else if column.type === "bar-s"}
									{#if row.score == null}
										<span class="val none">—</span>
									{:else}
										<div class="score" role="button" tabindex="0" title={scoreTip(row)} aria-label={scoreTip(row)}>
											<span class="bar s"><span style:width={`${Math.max(0, Math.min(100, row.score))}%`}></span></span>
											<span class="val">{Math.round(row.score)}</span>
										</div>
									{/if}
								{:else if row[column.key] == null}
									<span class="val none">—</span>
								{:else if ["value", "scorePerDollar"].includes(column.key)}
									<button
										type="button"
										class="val"
										title={cellTitle(column, row)}
										aria-label={cellTitle(column, row) || undefined}
									>
										{cellText(column, row)}
									</button>
								{:else}
									<span class="val">{cellText(column, row)}</span>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
