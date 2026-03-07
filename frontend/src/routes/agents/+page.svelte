<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { listAgents, listModels, listTools, registerAgent, runAgent } from '$lib/api';
	import type { Agent, Model, Tool } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Select from '$lib/components/ui/select';

	let token: string | null = $state(null);
	auth.token.subscribe((v) => (token = v));

	let agents: Agent[] = $state([]);
	let models: Model[] = $state([]);
	let tools: Tool[] = $state([]);

	// Register form
	let agentName = $state('');
	let agentModel = $state('');
	let agentDesc = $state('');
	let systemPrompt = $state('');
	let selectedTools: string[] = $state([]);
	let regError = $state('');
	let regSuccess = $state('');
	let regLoading = $state(false);

	// Run form
	let runAgentName = $state('');
	let runInput = $state('');
	let runOutput = $state('');
	let runSessionId = $state('');
	let runError = $state('');
	let runLoading = $state(false);

	onMount(async () => {
		try {
			[agents, models, tools] = await Promise.all([
				listAgents(token),
				listModels(token),
				listTools(token)
			]);
			if (models.length > 0) agentModel = models[0].id;
		} catch {
			// ignore
		}
	});

	function toggleTool(toolName: string) {
		if (selectedTools.includes(toolName)) {
			selectedTools = selectedTools.filter((t) => t !== toolName);
		} else {
			selectedTools = [...selectedTools, toolName];
		}
	}

	function handleModelChange(value: string | undefined) {
		if (value) agentModel = value;
	}

	function handleRunAgentChange(value: string | undefined) {
		if (value) runAgentName = value;
	}

	async function handleRegister(e: Event) {
		e.preventDefault();
		regError = '';
		regSuccess = '';
		regLoading = true;
		try {
			await registerAgent(
				{
					name: agentName,
					model: agentModel,
					description: agentDesc,
					tools: selectedTools,
					system_prompt: systemPrompt || null
				},
				token
			);
			regSuccess = `Agent "${agentName}" registered`;
			agentName = '';
			agentDesc = '';
			systemPrompt = '';
			selectedTools = [];
			agents = await listAgents(token);
		} catch (err: unknown) {
			regError = err instanceof Error ? err.message : 'Failed to register agent';
		} finally {
			regLoading = false;
		}
	}

	async function handleRun(e: Event) {
		e.preventDefault();
		runError = '';
		runOutput = '';
		runSessionId = '';
		runLoading = true;
		try {
			const res = await runAgent({ agent: runAgentName, input: runInput }, token);
			runOutput = res.output;
			runSessionId = res.session_id;
		} catch (err: unknown) {
			runError = err instanceof Error ? err.message : 'Failed to run agent';
		} finally {
			runLoading = false;
		}
	}
</script>

<div class="p-6">
	<h2 class="mb-6 text-2xl font-bold">Agents</h2>

	<Tabs.Root value="list">
		<Tabs.List>
			<Tabs.Trigger value="list">List</Tabs.Trigger>
			<Tabs.Trigger value="register">Register</Tabs.Trigger>
			<Tabs.Trigger value="run">Run</Tabs.Trigger>
		</Tabs.List>

		<!-- List -->
		<Tabs.Content value="list">
			{#if agents.length === 0}
				<p class="mt-4 text-sm text-muted-foreground">No agents registered</p>
			{:else}
				<div class="mt-4 grid gap-3 sm:grid-cols-2">
					{#each agents as agent}
						<Card.Root>
							<Card.Header>
								<Card.Title class="text-base">{agent.name}</Card.Title>
								<Card.Description>{agent.description}</Card.Description>
							</Card.Header>
							<Card.Content>
								<p class="mb-2 text-xs text-muted-foreground">Model: {agent.model}</p>
								<div class="flex flex-wrap gap-1">
									{#each agent.tools as tool}
										<Badge variant="secondary" class="text-xs">{tool}</Badge>
									{/each}
								</div>
							</Card.Content>
						</Card.Root>
					{/each}
				</div>
			{/if}
		</Tabs.Content>

		<!-- Register -->
		<Tabs.Content value="register">
			<Card.Root class="mt-4 max-w-lg">
				<Card.Content class="pt-6">
					<form onsubmit={handleRegister} class="space-y-4">
						{#if regError}
							<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
								{regError}
							</div>
						{/if}
						{#if regSuccess}
							<div class="rounded-md bg-green-50 p-3 text-sm text-green-700">{regSuccess}</div>
						{/if}
						<div class="space-y-2">
							<Label for="agentName">Agent Name</Label>
							<Input id="agentName" required bind:value={agentName} />
						</div>
						<div class="space-y-2">
							<Label>Model</Label>
							<Select.Root type="single" value={agentModel} onValueChange={handleModelChange}>
								<Select.Trigger>
									<span>{agentModel || 'Select model'}</span>
								</Select.Trigger>
								<Select.Content>
									{#each models as model}
										<Select.Item value={model.id}>{model.display_name || model.id}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="space-y-2">
							<Label for="agentDesc">Description</Label>
							<Input id="agentDesc" required bind:value={agentDesc} />
						</div>
						<div class="space-y-2">
							<Label for="sysPrompt">System Prompt</Label>
							<Textarea id="sysPrompt" rows={3} bind:value={systemPrompt} placeholder="Optional" />
						</div>
						<div class="space-y-2">
							<Label>Tools</Label>
							<div class="flex flex-wrap gap-2">
								{#each tools as tool}
									<Button
										type="button"
										variant={selectedTools.includes(tool.name) ? 'default' : 'outline'}
										size="sm"
										onclick={() => toggleTool(tool.name)}
									>
										{tool.name}
									</Button>
								{/each}
							</div>
						</div>
						<Button type="submit" class="w-full" disabled={regLoading}>
							{regLoading ? 'Registering…' : 'Register Agent'}
						</Button>
					</form>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<!-- Run -->
		<Tabs.Content value="run">
			<Card.Root class="mt-4 max-w-lg">
				<Card.Content class="pt-6">
					<form onsubmit={handleRun} class="space-y-4">
						{#if runError}
							<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
								{runError}
							</div>
						{/if}
						<div class="space-y-2">
							<Label>Agent</Label>
							<Select.Root type="single" value={runAgentName} onValueChange={handleRunAgentChange}>
								<Select.Trigger>
									<span>{runAgentName || 'Select agent'}</span>
								</Select.Trigger>
								<Select.Content>
									{#each agents as agent}
										<Select.Item value={agent.name}>{agent.name}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="space-y-2">
							<Label for="runInput">Input</Label>
							<Textarea id="runInput" rows={4} required bind:value={runInput} />
						</div>
						<Button type="submit" class="w-full" disabled={runLoading || !runAgentName}>
							{runLoading ? 'Running…' : 'Run Agent'}
						</Button>
					</form>
					{#if runSessionId}
						<div class="mt-4 space-y-2">
							<p class="text-xs text-muted-foreground">Session: {runSessionId}</p>
							<pre class="max-h-64 overflow-auto rounded-md bg-muted p-4 font-mono text-sm">{runOutput}</pre>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>
