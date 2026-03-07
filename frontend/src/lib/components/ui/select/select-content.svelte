<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: SelectPrimitive.ContentProps & { children?: import("svelte").Snippet } = $props();
</script>

<SelectPrimitive.Content
	bind:ref
	class={cn(
		"bg-popover text-popover-foreground relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border shadow-md",
		className
	)}
	{...restProps}
>
	<div class="p-1">
		{@render children?.()}
	</div>
</SelectPrimitive.Content>
