// The API key is user data, not application config: it is only ever kept in
// this browser. An in-memory copy keeps the page working when storage is
// unavailable (private mode, disabled storage).

import { STORAGE_KEYS } from "./config.js";

let cachedKey = null;

export function currentKey() {
	if (cachedKey !== null) return cachedKey;
	try {
		cachedKey = localStorage.getItem(STORAGE_KEYS.openRouterKey)?.trim() ?? "";
	} catch {
		cachedKey = "";
	}
	return cachedKey;
}

export function hasKey() {
	return currentKey().length > 0;
}

export function setKey(key) {
	cachedKey = key.trim();
	try {
		if (cachedKey) localStorage.setItem(STORAGE_KEYS.openRouterKey, cachedKey);
		else localStorage.removeItem(STORAGE_KEYS.openRouterKey);
	} catch {
		// Storage unavailable: the session copy still serves this page load.
	}
}
