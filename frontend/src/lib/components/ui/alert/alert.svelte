<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";
	export const alertVariants = tv({
		base: "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
		variants: {
			variant: {
				default: "bg-background text-foreground",
				destructive: "border-destructive/50 text-destructive [&>svg]:text-destructive",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	});
	export type AlertVariant = VariantProps<typeof alertVariants>["variant"];
</script>

<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		class: className,
		variant = "default",
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & { variant?: AlertVariant; children?: import("svelte").Snippet } = $props();
</script>

<div
	class={cn(alertVariants({ variant }), className)}
	role="alert"
	{...restProps}
>
	{@render children?.()}
</div>
