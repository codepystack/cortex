<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth';
	import { onMount, onDestroy } from 'svelte';

	let unsubscribe: (() => void) | undefined;

	onMount(() => {
		unsubscribe = auth.token.subscribe((t) => {
			if (t) {
				goto('/chat');
			} else {
				goto('/login');
			}
		});
	});

	onDestroy(() => {
		unsubscribe?.();
	});
</script>
