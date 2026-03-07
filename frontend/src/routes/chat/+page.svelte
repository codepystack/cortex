<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { listModels, streamChatCompletion } from '$lib/api';
	import type { Message, Model } from '$lib/types';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import * as Select from '$lib/components/ui/select';

	let models: Model[] = $state([]);
	let selectedModel = $state('');
	let messages: Message[] = $state([]);
	let input = $state('');
	let streaming = $state(false);
	let error: string | null = $state(null);
	let bottomEl: HTMLDivElement | undefined = $state();
	let token: string | null = $state(null);

	auth.token.subscribe((v) => (token = v));

	onMount(async () => {
		try {
			models = await listModels(token);
			if (models.length > 0) selectedModel = models[0].id;
		} catch {
			error = 'Failed to load models';
		}
	});

	async function scrollToBottom() {
		await tick();
		bottomEl?.scrollIntoView({ behavior: 'smooth' });
	}

	async function sendMessage() {
		if (!input.trim() || streaming) return;
		error = null;
		const userMsg: Message = { role: 'user', content: input.trim() };
		messages = [...messages, userMsg];
		input = '';
		streaming = true;
		await scrollToBottom();

		const assistantMsg: Message = { role: 'assistant', content: '' };
		messages = [...messages, assistantMsg];

		try {
			const stream = streamChatCompletion(
				{ model: selectedModel, messages: messages.slice(0, -1) },
				token
			);
			for await (const chunk of stream) {
				messages[messages.length - 1] = {
					...messages[messages.length - 1],
					content: messages[messages.length - 1].content + chunk
				};
				await scrollToBottom();
			}
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Chat request failed';
			messages = messages.slice(0, -1);
		} finally {
			streaming = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	function clearConversation() {
		messages = [];
		error = null;
	}

	function handleModelChange(value: string | undefined) {
		if (value) selectedModel = value;
	}
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<div class="flex items-center justify-between border-b px-6 py-3">
		<div class="flex items-center gap-3">
			<h2 class="text-lg font-semibold">Chat</h2>
			{#if models.length > 0}
				<Select.Root type="single" value={selectedModel} onValueChange={handleModelChange}>
					<Select.Trigger class="w-56">
						<span>{models.find((m) => m.id === selectedModel)?.display_name ?? selectedModel}</span>
					</Select.Trigger>
					<Select.Content>
						{#each models as model}
							<Select.Item value={model.id}>{model.display_name || model.id}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			{/if}
		</div>
		<Button variant="outline" size="sm" onclick={clearConversation}>Clear</Button>
	</div>

	<!-- Messages -->
	<ScrollArea class="flex-1 p-6">
		{#if messages.length === 0}
			<div class="flex h-full items-center justify-center text-muted-foreground">
				<p>Send a message to start a conversation</p>
			</div>
		{:else}
			<div class="mx-auto max-w-3xl space-y-4">
				{#each messages as message}
					<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
						<div
							class="max-w-[80%] rounded-lg px-4 py-2 {message.role === 'user'
								? 'bg-primary text-primary-foreground'
								: 'bg-muted'}"
						>
							{#if message.role === 'assistant'}
								<div class="prose prose-sm max-w-none">
									{@html message.content.replace(/\n/g, '<br>')}
								</div>
							{:else}
								<p class="text-sm whitespace-pre-wrap">{message.content}</p>
							{/if}
						</div>
					</div>
				{/each}
				{#if streaming}
					<div class="flex justify-start">
						<div class="flex gap-1 rounded-lg bg-muted px-4 py-3">
							<span class="h-2 w-2 animate-bounce rounded-full bg-foreground/40"></span>
							<span
								class="h-2 w-2 animate-bounce rounded-full bg-foreground/40"
								style="animation-delay: 0.15s"
							></span>
							<span
								class="h-2 w-2 animate-bounce rounded-full bg-foreground/40"
								style="animation-delay: 0.3s"
							></span>
						</div>
					</div>
				{/if}
				<div bind:this={bottomEl}></div>
			</div>
		{/if}
	</ScrollArea>

	<!-- Error -->
	{#if error}
		<div class="mx-6 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
	{/if}

	<!-- Input -->
	<div class="border-t p-4">
		<div class="mx-auto flex max-w-3xl gap-2">
			<Textarea
				placeholder="Type a message…"
				rows={2}
				bind:value={input}
				onkeydown={handleKeydown}
				disabled={streaming}
				class="resize-none"
			/>
			<Button onclick={sendMessage} disabled={!input.trim() || streaming} class="self-end">
				Send
			</Button>
		</div>
		<p class="mt-2 text-center text-xs text-muted-foreground">
			AI can make mistakes. Verify important information.
		</p>
	</div>
</div>
