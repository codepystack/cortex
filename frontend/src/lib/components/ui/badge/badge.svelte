<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";

	export const badgeVariants = tv({
		base: "focus:ring-ring inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground border-transparent shadow",
				secondary: "bg-secondary text-secondary-foreground border-transparent",
				destructive: "bg-destructive text-destructive-foreground border-transparent shadow",
				outline: "text-foreground",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	});

	export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];
</script>

<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		class: className,
		variant = "default",
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & { variant?: BadgeVariant; children?: import("svelte").Snippet } = $props();
</script>

<div class={cn(badgeVariants({ variant }), className)} {...restProps}>
	{@render children?.()}
</div>
