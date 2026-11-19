<script lang="ts">
	import { onMount } from "svelte";
	import Header from "./components/Header.svelte";
	import SectionNav from "./components/SectionNav.svelte";
	import SearchField from "./components/SearchField.svelte";
	import ModelScatter from "./components/ModelScatter.svelte";
	import TopPicks from "./components/TopPicks.svelte";
	import AspectHeatmap from "./components/AspectHeatmap.svelte";
	import ModelTable from "./components/ModelTable.svelte";
	import Methodology from "./components/Methodology.svelte";
	import { fetchModels, fetchOpenCodeScores } from "./lib/api";
	import { COPY } from "./lib/copy";
	import { COLUMNS, SCORE_WEIGHTS } from "./lib/config";
	import { buildRows } from "./lib/models";
	import { applyScorePerDollar, applyScores, applyValue } from "./lib/scores";
	import type { AspectMeta, CatalogModel, Row, Snapshot } from "./lib/types";

	let models = $state<CatalogModel[]>([]);
	let snapshot = $state<Snapshot | null>(null);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let snapshotError = $state<string | null>(null);
	let search = $state("");
	let sortKey = $state("value");
	let sortDir = $state<"asc" | "desc">("desc");

	const rows = $derived(applyScorePerDollar(applyValue(applyScores(buildRows(models), snapshot))));
	const query = $derived(search.trim().toLowerCase());
	const filtered = $derived(query ? rows.filter((row) => row.model.toLowerCase().includes(query)) : rows);
	const meta = $derived<AspectMeta[]>(
		snapshot?.aspects ?? Object.keys(SCORE_WEIGHTS).map((key) => ({ key, label: key })),
	);
	const status = $derived(
		loading
			? COPY.loading
			: loadError
				? `${COPY.error} ${loadError} · ${COPY.stale}`
				: snapshotError
					? `${COPY.error} ${snapshotError} · ${COPY.stale}`
					: `${filtered.length} of ${rows.length} models · sorted by ${sortKey}`,
	);
	const statusErr = $derived(!loading && (!!loadError || !!snapshotError));
	function compare(a: Row, b: Row, key: string, direction: "asc" | "desc"): number {
		const av = a[key] as number | string | null;
		const bv = b[key] as number | string | null;
		if (av == null && bv == null) return 0;
		if (av == null) return 1;
		if (bv == null) return -1;
		if (typeof av === "string" || typeof bv === "string") {
			const result = String(av).localeCompare(String(bv));
			return direction === "asc" ? result : -result;
		}
		if (av !== bv) return direction === "asc" ? av - bv : bv - av;
		return 0;
	}

	const sorted = $derived([...filtered].sort((a, b) => compare(a, b, sortKey, sortDir)));
	const emptyMessage = $derived(
		query && sorted.length === 0 ? COPY.searchEmpty : status || COPY.searchEmpty,
	);
	let firstLoaded = $state(false);

	function onSort(key: string) {
		if (sortKey === key) sortDir = sortDir === "desc" ? "asc" : "desc";
		else {
			sortKey = key;
			sortDir = key === "model" ? "asc" : "desc";
		}
	}

	async function load() {
		loading = true;
		loadError = null;
		snapshotError = null;
		const [modelsResult, snapshotResult] = await Promise.allSettled([fetchModels(), fetchOpenCodeScores()]);
		if (modelsResult.status === "fulfilled") models = modelsResult.value;
		else {
			console.error(modelsResult.reason);
			loadError = modelsResult.reason instanceof Error ? modelsResult.reason.message : String(modelsResult.reason);
		}
		if (snapshotResult.status === "fulfilled") snapshot = snapshotResult.value;
		else snapshotError = snapshotResult.reason instanceof Error ? snapshotResult.reason.message : String(snapshotResult.reason);
		loading = false;
	}

	$effect(() => {
		document.body.classList.toggle("indicators", loading);
		document.body.classList.toggle("ready", !loading);
		document.querySelector("main")?.setAttribute("aria-busy", String(loading));
		if (!loading && !firstLoaded) {
			firstLoaded = true;
			document.body.classList.add("intro");
			setTimeout(() => document.body.classList.remove("intro"), 900);
		}
	});

	onMount(load);

</script>

<Header {loading} onRefresh={load} />
<SectionNav />

<div class="controls">
	<div class="shell inner">
		<SearchField value={search} onInput={(value) => (search = value)} />
		<p class="status" class:err={statusErr} role="status">{status}</p>
	</div>
</div>

<main class="shell" class:is-loading={loading}>
	<ModelScatter
		id="capacity"
		title="Capacity"
		subtitle={COPY.capacity}
		kind="capacity"
		height={280}
		rows={filtered}
		{loading}
	/>

	<TopPicks {rows} {loading} />

	<div class="chart-pair">
		<ModelScatter
			id="adoption"
			title="Adoption"
			subtitle={COPY.adoption}
			kind="adoption"
			width={560}
			height={240}
			quadrants={{ topLeft: "Hidden gems", topRight: "Leaders", bottomLeft: "Niche", bottomRight: "Overused" }}
			rows={filtered}
			{loading}
		/>
		<ModelScatter
			id="retention"
			title="Retention"
			subtitle={COPY.retention}
			kind="retention"
			width={560}
			height={240}
			quadrants={{ topLeft: "Hype", topRight: "Trusted leaders", bottomLeft: "Niche", bottomRight: "Sticky workhorses" }}
			rows={filtered}
			{loading}
		/>
	</div>

	<AspectHeatmap {rows} {meta} />


	<section id="models" aria-label="Models">
		<div class="section-head">
			<h2 class="section-title">{COPY.roster}</h2>
			<p class="section-sub">{COPY.rosterSubtitle}</p>
		</div>
		{#if loading && rows.length === 0}
		<div class="table-scroll">
			<table>
				<thead id="thead">
					<tr>
						{#each COLUMNS as column (column.key)}
							<th style:text-align={column.align === "right" ? "right" : undefined}>{column.label}</th>
						{/each}
					</tr>
				</thead>
				<tbody id="tbody">
					{#each Array(31) as _}
						<tr class="skel-row">
							{#each COLUMNS as column (column.key)}
								<td><span class="skel" style:width={column.type === "text" ? "70%" : "34%"}></span></td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<ModelTable
			rows={sorted}
			{sortKey}
			{sortDir}
			{meta}
			{onSort}
			{emptyMessage}
		/>
	{/if}
	</section>

	<Methodology />
</main>
