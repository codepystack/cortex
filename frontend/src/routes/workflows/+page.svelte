<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { listWorkflows, registerWorkflow, runWorkflow } from '$lib/api';
	import type { Workflow } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Select from '$lib/components/ui/select';

	let token: string | null = $state(null);
	auth.token.subscribe((v) => (token = v));

	let workflows: Workflow[] = $state([]);

	// Register
	let workflowJson = $state(
		JSON.stringify(
			{
				name: 'my-workflow',
				description: 'A sample workflow',
				nodes: [
					{ id: 'start', kind: 'input', config: {} },
					{ id: 'process', kind: 'llm', config: { model: 'cortex-echo' } },
					{ id: 'end', kind: 'output', config: {} }
				]
			},
			null,
			2
		)
	);
	let regError = $state('');
	let regSuccess = $state('');
	let regLoading = $state(false);

	// Run
	let runWorkflowName = $state('');
	let runInput = $state('');
	let runOutput = $state('');
	let runError = $state('');
	let runLoading = $state(false);

	onMount(async () => {
		try {
			workflows = await listWorkflows(token);
		} catch {
			// ignore
		}
	});

	function handleWorkflowChange(value: string | undefined) {
		if (value) runWorkflowName = value;
	}

	async function handleRegister(e: Event) {
		e.preventDefault();
		regError = '';
		regSuccess = '';
		regLoading = true;
		try {
			const payload = JSON.parse(workflowJson);
			await registerWorkflow(payload, token);
			regSuccess = `Workflow "${payload.name}" registered`;
			workflows = await listWorkflows(token);
		} catch (err: unknown) {
			regError = err instanceof Error ? err.message : 'Failed to register workflow';
		} finally {
			regLoading = false;
		}
	}

	async function handleRun(e: Event) {
		e.preventDefault();
		runError = '';
		runOutput = '';
		runLoading = true;
		try {
			const res = await runWorkflow(runWorkflowName, runInput, token);
			runOutput = res.output;
		} catch (err: unknown) {
			runError = err instanceof Error ? err.message : 'Failed to run workflow';
		} finally {
			runLoading = false;
		}
	}
</script>

<div class="p-6">
	<h2 class="mb-6 text-2xl font-bold">Workflows</h2>

	<Tabs.Root value="list">
		<Tabs.List>
			<Tabs.Trigger value="list">List</Tabs.Trigger>
			<Tabs.Trigger value="register">Register</Tabs.Trigger>
			<Tabs.Trigger value="run">Run</Tabs.Trigger>
		</Tabs.List>

		<!-- List -->
		<Tabs.Content value="list">
			{#if workflows.length === 0}
				<p class="mt-4 text-sm text-muted-foreground">No workflows registered</p>
			{:else}
				<div class="mt-4 grid gap-3 sm:grid-cols-2">
					{#each workflows as wf}
						<Card.Root>
							<Card.Header>
								<Card.Title class="text-base">{wf.name}</Card.Title>
								<Card.Description>{wf.description}</Card.Description>
							</Card.Header>
							<Card.Content>
								<div class="flex flex-wrap gap-1">
									{#each wf.nodes as node}
										<Badge variant="secondary" class="text-xs">{node.kind}</Badge>
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
			<Card.Root class="mt-4 max-w-2xl">
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
							<Label for="wfJson">Workflow Definition (JSON)</Label>
							<Textarea
								id="wfJson"
								rows={16}
								bind:value={workflowJson}
								class="font-mono text-sm"
							/>
						</div>
						<p class="text-xs text-muted-foreground">
							Node kinds: input, llm, tool, transform, output
						</p>
						<Button type="submit" class="w-full" disabled={regLoading}>
							{regLoading ? 'Registering…' : 'Register Workflow'}
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
							<Label>Workflow</Label>
							<Select.Root
								type="single"
								value={runWorkflowName}
								onValueChange={handleWorkflowChange}
							>
								<Select.Trigger>
									<span>{runWorkflowName || 'Select workflow'}</span>
								</Select.Trigger>
								<Select.Content>
									{#each workflows as wf}
										<Select.Item value={wf.name}>{wf.name}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="space-y-2">
							<Label for="wfInput">Input</Label>
							<Textarea id="wfInput" rows={4} required bind:value={runInput} />
						</div>
						<Button type="submit" class="w-full" disabled={runLoading || !runWorkflowName}>
							{runLoading ? 'Running…' : 'Run Workflow'}
						</Button>
					</form>
					{#if runOutput}
						<div class="mt-4 space-y-2">
							<Label>Output</Label>
							<pre
								class="max-h-64 overflow-auto rounded-md bg-muted p-4 font-mono text-sm">{runOutput}</pre>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>
