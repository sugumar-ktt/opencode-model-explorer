<script lang="ts">
	import { BADGES } from "../lib/config";
	import type { BadgeKey } from "../lib/types";

	let { badge }: { badge: BadgeKey } = $props();
</script>

<span class="badge badge-{badge}">{BADGES[badge]}</span>
