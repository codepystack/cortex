import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function createAuthStore() {
	const storedToken = browser ? localStorage.getItem('cortex_token') : null;
	const storedEmail = browser ? localStorage.getItem('cortex_email') : null;

	const token = writable<string | null>(storedToken);
	const userEmail = writable<string | null>(storedEmail);
	const hydrated = writable(browser);

	function setAuth(t: string, e: string) {
		if (browser) {
			localStorage.setItem('cortex_token', t);
			localStorage.setItem('cortex_email', e);
		}
		token.set(t);
		userEmail.set(e);
	}

	function clearAuth() {
		if (browser) {
			localStorage.removeItem('cortex_token');
			localStorage.removeItem('cortex_email');
		}
		token.set(null);
		userEmail.set(null);
	}

	return {
		token,
		userEmail,
		hydrated,
		setAuth,
		clearAuth
	};
}

export const auth = createAuthStore();
