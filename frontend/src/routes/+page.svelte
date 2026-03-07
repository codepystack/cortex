<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth';
	import { onMount } from 'svelte';

	onMount(() => {
		auth.token.subscribe((t) => {
			if (t) {
				goto('/chat');
			} else {
				goto('/login');
			}
		});
	});
</script>
