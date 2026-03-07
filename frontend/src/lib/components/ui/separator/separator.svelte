<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		class: className,
		orientation = "horizontal",
		...restProps
	}: HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" } = $props();
</script>

<div
	role="none"
	class={cn(
		"bg-border shrink-0",
		orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
		className
	)}
	{...restProps}
></div>
