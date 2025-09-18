import { Snippet, SnippetCategory, PasteEvent } from '@/types';

const STORAGE_KEYS = {
    SNIPPETS: 'shortcutpaste_snippets',
    CATEGORIES: 'shortcutpaste_categories',
    SETTINGS: 'shortcutpaste_settings',
    HISTORY: 'shortcutpaste_history'
} as const;

export const storage = {
    // Snippets
    async getSnippets(): Promise<Snippet[]> {
        if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
            return new Promise((resolve) => {
                chrome.storage.sync.get(STORAGE_KEYS.SNIPPETS, (result) => {
                    resolve(result[STORAGE_KEYS.SNIPPETS] || []);
                });
            });
        }
        const stored = localStorage.getItem(STORAGE_KEYS.SNIPPETS) || '[]';
        return JSON.parse(stored);
    },

    async saveSnippets(snippets: Snippet[]): Promise<void> {
        if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
            return new Promise((resolve) => {
                chrome.storage.sync.set({ [STORAGE_KEYS.SNIPPETS]: snippets }, resolve);
            });
        }
        localStorage.setItem(STORAGE_KEYS.SNIPPETS, JSON.stringify(snippets));
    },

    // Categories
    async getCategories(): Promise<SnippetCategory[]> {
        if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
            return new Promise((resolve) => {
                chrome.storage.sync.get(STORAGE_KEYS.CATEGEGORIES, (result) => {
                    resolve(result[STORAGE_KEYS.CATEGEGORIES] || []);
                });
            });
        }
        const stored = localStorage.getItem(STORAGE_KEYS.CATEGEGORIES) || '[]';
        return JSON.parse(stored);
    },

    async saveCategories(categories: SnippetCategory[]): Promise<void> {
        if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
            return new Promise((resolve) => {
                chrome.storage.sync.set({ [STORAGE_KEYS.CATEGEGORIES]: categories }, resolve);
            });
        }
        localStorage.setItem(STORAGE_KEYS.CATEGEGORIES, JSON.stringify(categories));
    },

    // Settings
    async getSettings(): Promise<any> {
        if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
            return new Promise((resolve) => {
                chrome.storage.sync.get(STORAGE_KEYS.SETTINGS, (result) => {
                    resolve(result[STORAGE_KEYS.SETTINGS] || {});
                });
            });
        }
        const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}';
        return JSON.parse(stored);
    },

    async saveSettings(settings: any): Promise<void> {
        if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
            return new Promise((resolve) => {
                chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: settings }, resolve);
            });
        }
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    },

    // History
    async getHistory(): Promise<PasteEvent[]> {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            return new Promise((resolve) => {
                chrome.storage.local.get(STORAGE_KEYS.HISTORY, (result) => {
                    resolve(result[STORAGE_KEYS.HISTORY] || []);
                });
            });
        }
        const stored = localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]';
        return JSON.parse(stored);
    },

    async saveHistory(history: PasteEvent[]): Promise<void> {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            return new Promise((resolve) => {
                chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: history }, resolve);
            });
        }
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    },

    async addToHistory(event: PasteEvent): Promise<void> {
        const history = await this.getHistory();
        history.unshift(event);
        // Keep only last 100 events
        await this.saveHistory(history.slice(0, 100));
    }
};