<script lang="ts">
	import Plot from "svelteplot/Plot.svelte";
	import Dot from "svelteplot/marks/Dot.svelte";
	import RuleX from "svelteplot/marks/RuleX.svelte";
	import RuleY from "svelteplot/marks/RuleY.svelte";
	import Text from "svelteplot/marks/Text.svelte";
	import HTMLTooltip from "svelteplot/marks/HTMLTooltip.svelte";
	import { COPY } from "../lib/copy";
	import { formatCompact as compact } from "../lib/format";
	import type { Row } from "../lib/types";

	type Kind = "capacity" | "adoption" | "retention";
	type Point = {
		x: number;
		score: number;
		model: string;
		tip: string;
		quadrant: "leaders" | "premium" | "bulk" | "niche";
	};
	type Label = { x: number; y: number; text: string; anchor: "start" | "end" };

	let {
		id,
		title,
		subtitle,
		kind,
		rows,
		width = 760,
		height = 220,
		quadrants = {
			topLeft: "Constrained",
			topRight: "Leaders",
			bottomLeft: "Niche",
			bottomRight: "Workhorses",
		},
		loading = false,
	}: {
		id: string;
		title: string;
		subtitle: string;
		kind: Kind;
		rows: Row[];
		width?: number;
		height?: number;
		quadrants?: { topLeft: string; topRight: string; bottomLeft: string; bottomRight: string };
		loading?: boolean;
	} = $props();

	const xOf = (row: Row): number | null => {
		if (kind === "capacity") return row.go_requests_5h;
		if (kind === "adoption") return row.modelData?.usage?.tokens ?? null;
		return row.modelData?.usage?.weeklyRetentionPercent ?? null;
	};

	const tipOf = (row: Row, x: number): string => {
		if (kind === "capacity") {
			return `Score ${Math.round(row.score as number)} · ${row.go_requests_5h === Infinity ? "∞" : compact(x)} req`;
		}
		if (kind === "adoption") {
			return `Score ${Math.round(row.score as number)} · ${compact(x)} tokens`;
		}
		return `Ret ${x}% · Score ${Math.round(row.score as number)}`;
	};

	const model = $derived.by(() => {
		const valid = rows
			.map((row) => ({ row, raw: xOf(row) }))
			.filter((item) => item.row.score != null && item.raw != null && (kind === "retention" || item.raw > 0));

		const finite = valid
			.filter((item): item is { row: Row; raw: number } => Number.isFinite(item.raw as number))
			.map((item) => item.raw as number);
		if (!finite.length) return null;

		const min = Math.min(...finite);
		const max = Math.max(...finite);
		const sentinel = max * 1.5;
		const medianX = median(finite);
		const domain: [number, number] =
			kind === "retention" ? [40, 100] : [min * 0.8, kind === "capacity" ? sentinel * 1.05 : max * 1.2];

		const points: Point[] = valid.map(({ row, raw }) => {
			const x = raw === Infinity ? sentinel : (raw as number);
			const highX = x >= medianX;
			const quadrant =
				(row.score as number) >= 50 ? (highX ? "leaders" : "premium") : highX ? "bulk" : "niche";
			return {
				x,
				score: row.score as number,
				model: row.model,
				tip: tipOf(row, x),
				quadrant,
			};
		});

		const lowX = kind === "retention" ? domain[0] + 3 : domain[0] * 1.05;
		const highLabelX = kind === "retention" ? domain[1] - 3 : domain[1] * 0.95;
		const labels: Label[] = [
			{ x: lowX, y: 95, text: quadrants.topLeft, anchor: "start" },
			{ x: highLabelX, y: 95, text: quadrants.topRight, anchor: "end" },
			{ x: lowX, y: 8, text: quadrants.bottomLeft, anchor: "start" },
			{ x: highLabelX, y: 8, text: quadrants.bottomRight, anchor: "end" },
		];

		return { points, domain, labels, sentinel, median: medianX, min };
	});

	function median(values: number[]): number {
		const sorted = [...values].sort((a, b) => a - b);
		const middle = Math.floor(sorted.length / 2);
		return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
	}

	// Keep the tooltip inside the viewport: SveltePlot anchors it at the
	// dot with no width or flipping, so near an edge it would squeeze or
	// overflow the page. Center it above the point, then clamp horizontally
	// and flip below when the sticky header would cover it.
	function containTip(node: HTMLElement, _datum: unknown) {
		const place = () => {
			const tip = node.closest(".svelteplot-tooltip") as HTMLElement | null;
			if (!tip || tip.classList.contains("hide")) return;
			tip.style.transform = "";
			const gutter = 8;
			const vw = document.documentElement.clientWidth;
			const rect = tip.getBoundingClientRect();
			if (rect.width === 0) return;
			const left = parseFloat(tip.style.left);
			if (Number.isFinite(left)) {
				if (rect.right > vw - gutter) tip.style.left = `${left - (rect.right - (vw - gutter))}px`;
				else if (rect.left < gutter) tip.style.left = `${left + (gutter - rect.left)}px`;
			}
			if (tip.getBoundingClientRect().top < 116) tip.style.transform = "translate(-50%, 14px)";
		};
		requestAnimationFrame(place);
		return {
			update() {
				requestAnimationFrame(place);
			},
		};
	}

	const groups = $derived(
		model
			? (["leaders", "premium", "bulk", "niche"] as const).map((name) => ({
					name,
					data: model.points.filter((point) => point.quadrant === name),
				}))
			: [],
	);

	const colors: Record<string, string> = {
		leaders: "var(--np-color-primary)",
		premium: "var(--np-color-primary)",
		bulk: "var(--np-color-secondary)",
		niche: "var(--np-color-outline-variant)",
	};
</script>

<section class="charts" {id} aria-label={title}>
	<div class="chart-section-head">
		<h2>{title}</h2>
		<p class="chart-sub">{subtitle}</p>
	</div>
	<div class="chart">
		{#if model && !loading}
			<Plot
				{height}
				maxWidth="100%"
				margin={{ top: 24, right: 18, bottom: 44, left: 44 }}
					x={{
						type: kind === "retention" ? "linear" : "log",
						domain: model.domain,
						label: false,
						grid: false,
						tickFormat: (value: unknown) => {
							const number = Number(value);
							if (kind === "retention") return `${number}%`;
							if (kind === "capacity" && number >= model.sentinel * 0.95) return "∞";
							return compact(number);
						},
					}}
					y={{ domain: [0, 100], label: false, grid: false }}
				>
					<RuleX data={[model.median]} stroke="var(--np-color-outline-variant)" strokeDasharray="4 4" />
					<RuleY data={[50]} stroke="var(--np-color-outline-variant)" strokeDasharray="4 4" />
					<RuleY data={[0]} stroke="var(--np-color-outline-variant)" strokeWidth={1} />
					<RuleX data={[model.domain[0]]} stroke="var(--np-color-outline-variant)" strokeWidth={1} />
					<Text
						data={model.labels}
						x="x"
						y="y"
						text="text"
						textAnchor="anchor"
						fontSize={11}
						fill="var(--np-color-on-surface-variant)"
					/>
					{#each groups as group (group.name)}
						<Dot
							data={group.data}
							x="x"
							y="score"
							r={5}
							fill={colors[group.name]}
							stroke="var(--np-color-surface-container-lowest)"
							strokeWidth={1.5}
						/>
					{/each}
					{#snippet overlay()}
						<HTMLTooltip data={model.points} x="x" y="score" r={5}>
							{#snippet children({ datum }: { datum: Point })}
								<div class="chart-tip-content" use:containTip={datum}>
									<strong>{datum.model}</strong>
									<span class="tip-metric">{datum.tip}</span>
								</div>
							{/snippet}
						</HTMLTooltip>
					{/snippet}
				</Plot>
			{:else if !loading}
				<div class="empty">{COPY.chartEmpty}</div>
			{/if}
	</div>
</section>
