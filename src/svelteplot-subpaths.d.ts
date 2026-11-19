// SveltePlot's package exports expose these subpaths for smaller bundles, but
// they ship no separate .d.ts files. These declarations keep TypeScript happy.
declare module "svelteplot/Plot.svelte" {
	import type { Component } from "svelte";
	const Plot: Component<Record<string, unknown>>;
	export default Plot;
}

declare module "svelteplot/core/Plot.svelte" {
	import type { Component } from "svelte";
	const Plot: Component<Record<string, unknown>>;
	export default Plot;
}

declare module "svelteplot/marks/Dot.svelte" {
	import type { Component } from "svelte";
	const Dot: Component<Record<string, unknown>>;
	export default Dot;
}

declare module "svelteplot/marks/RuleX.svelte" {
	import type { Component } from "svelte";
	const RuleX: Component<Record<string, unknown>>;
	export default RuleX;
}

declare module "svelteplot/marks/RuleY.svelte" {
	import type { Component } from "svelte";
	const RuleY: Component<Record<string, unknown>>;
	export default RuleY;
}

declare module "svelteplot/marks/Text.svelte" {
	import type { Component } from "svelte";
	const Text: Component<Record<string, unknown>>;
	export default Text;
}

declare module "svelteplot/marks/HTMLTooltip.svelte" {
	import type { Component } from "svelte";
	const HTMLTooltip: Component<Record<string, unknown>>;
	export default HTMLTooltip;
}

declare module "svelteplot/marks/Cell.svelte" {
	import type { Component } from "svelte";
	const Cell: Component<Record<string, unknown>>;
	export default Cell;
}

declare module "svelteplot/marks/AxisX.svelte" {
	import type { Component } from "svelte";
	const AxisX: Component<Record<string, unknown>>;
	export default AxisX;
}

declare module "svelteplot/marks/AxisY.svelte" {
	import type { Component } from "svelte";
	const AxisY: Component<Record<string, unknown>>;
	export default AxisY;
}
