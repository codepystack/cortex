<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { listModels, registerModel } from '$lib/api';
	import type { Model } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import * as Select from '$lib/components/ui/select';
	import { Separator } from '$lib/components/ui/separator';

	let models: Model[] = $state([]);
	let token: string | null = $state(null);
	let name = $state('');
	let provider = $state('openai');
	let endpoint = $state('');
	let apiKey = $state('');
	let description = $state('');
	let success = $state('');
	let error = $state('');
	let loading = $state(false);

	auth.token.subscribe((v) => (token = v));

	const providers = ['ollama', 'openai', 'anthropic', 'custom'];

	onMount(async () => {
		await loadModels();
	});

	async function loadModels() {
		try {
			models = await listModels(token);
		} catch {
			error = 'Failed to load models';
		}
	}

	function handleProviderChange(value: string | undefined) {
		if (value) provider = value;
	}

	async function handleRegister(e: Event) {
		e.preventDefault();
		error = '';
		success = '';
		loading = true;
		try {
			const payload: Record<string, string> = { name, provider };
			if (endpoint) payload.endpoint = endpoint;
			if (apiKey) payload.api_key = apiKey;
			if (description) payload.description = description;
			await registerModel(payload as Parameters<typeof registerModel>[0], token);
			success = `Model "${name}" registered successfully`;
			name = '';
			endpoint = '';
			apiKey = '';
			description = '';
			await loadModels();
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Failed to register model';
		} finally {
			loading = false;
		}
	}
</script>

<div class="p-6">
	<h2 class="mb-6 text-2xl font-bold">Models</h2>

	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Register form -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Register Model</Card.Title>
				<Card.Description>Add a new model provider to Cortex</Card.Description>
			</Card.Header>
			<Card.Content>
				<form onsubmit={handleRegister} class="space-y-4">
					{#if error}
						<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
					{/if}
					{#if success}
						<div class="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>
					{/if}
					<div class="space-y-2">
						<Label for="name">Model Name</Label>
						<Input id="name" required bind:value={name} placeholder="e.g. gpt-4o" />
					</div>
					<div class="space-y-2">
						<Label>Provider</Label>
						<Select.Root type="single" value={provider} onValueChange={handleProviderChange}>
							<Select.Trigger>
								<span>{provider}</span>
							</Select.Trigger>
							<Select.Content>
								{#each providers as p}
									<Select.Item value={p}>{p}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<div class="space-y-2">
						<Label for="endpoint">Endpoint URL</Label>
						<Input
							id="endpoint"
							bind:value={endpoint}
							placeholder="Optional"
						/>
					</div>
					<div class="space-y-2">
						<Label for="apiKey">API Key</Label>
						<Input id="apiKey" type="password" bind:value={apiKey} placeholder="Optional" />
					</div>
					<div class="space-y-2">
						<Label for="desc">Description</Label>
						<Input id="desc" bind:value={description} placeholder="Optional" />
					</div>
					<Button type="submit" class="w-full" disabled={loading}>
						{loading ? 'Registering…' : 'Register Model'}
					</Button>
				</form>
			</Card.Content>
		</Card.Root>

		<!-- Models list -->
		<div class="space-y-4">
			<h3 class="text-lg font-semibold">Available Models</h3>
			{#if models.length === 0}
				<p class="text-sm text-muted-foreground">No models available</p>
			{:else}
				<div class="grid gap-3">
					{#each models as model}
						<Card.Root>
							<Card.Content class="flex items-center justify-between p-4">
								<div>
									<p class="font-mono text-sm font-medium">{model.id}</p>
									{#if model.display_name && model.display_name !== model.id}
										<p class="text-xs text-muted-foreground">{model.display_name}</p>
									{/if}
								</div>
								<Badge variant="secondary">{model.owned_by}</Badge>
							</Card.Content>
						</Card.Root>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
