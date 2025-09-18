import { ClipboardItem, ClipboardFolder } from '../../types/clipboard';

class ClipboardStorage {
    private readonly STORAGE_KEYS = {
        ITEMS: 'clipboard_items_v3',  // Upgraded to v3 for better reliability
        FOLDERS: 'clipboard_folders_v3'
    };

    async getClipboardItems(): Promise<ClipboardItem[]> {
        try {
            // Always check local storage first (more persistent)
            const localResult = await chrome.storage.local.get(this.STORAGE_KEYS.ITEMS);
            if (localResult[this.STORAGE_KEYS.ITEMS]) {
                console.log('Found clipboard items in local storage');
                return localResult[this.STORAGE_KEYS.ITEMS];
            }

            // Fallback to sync storage
            const syncResult = await chrome.storage.sync.get(this.STORAGE_KEYS.ITEMS);
            if (syncResult[this.STORAGE_KEYS.ITEMS]) {
                console.log('Found clipboard items in sync storage, migrating to local');
                // Migrate to local storage for better persistence
                await this.saveClipboardItems(syncResult[this.STORAGE_KEYS.ITEMS]);
                return syncResult[this.STORAGE_KEYS.ITEMS];
            }

            console.log('No clipboard items found');
            return [];
        } catch (error) {
            console.error('Failed to get clipboard items:', error);
            return [];
        }
    }

    async saveClipboardItems(items: ClipboardItem[]): Promise<void> {
        try {
            // Always save to local storage first (most reliable)
            await chrome.storage.local.set({ [this.STORAGE_KEYS.ITEMS]: items });
            console.log(`Saved ${items.length} clipboard items to local storage`);

            // Also try to sync to sync storage if data is small enough
            const itemsSize = new Blob([JSON.stringify(items)]).size;
            if (itemsSize <= 80000) { // Reduced to 80KB for safety margin
                try {
                    await chrome.storage.sync.set({ [this.STORAGE_KEYS.ITEMS]: items });
                    console.log('Also synced to sync storage');
                } catch (syncError) {
                    console.warn('Sync storage failed, but local storage succeeded:', syncError);
                }
            } else {
                console.log('Data too large for sync storage, using local only');
                // Clear from sync storage if it exists there
                try {
                    await chrome.storage.sync.remove(this.STORAGE_KEYS.ITEMS);
                } catch (e) {
                    // Ignore errors when cleaning up sync storage
                }
            }
        } catch (error) {
            console.error('Failed to save clipboard items:', error);
            throw error;
        }
    }

    async addClipboardItem(itemData: Omit<ClipboardItem, 'id' | 'timestamp'>): Promise<ClipboardItem> {
        const newItem: ClipboardItem = {
            ...itemData,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            isFavorite: itemData.isFavorite || false
        };

        const items = await this.getClipboardItems();
        const updatedItems = [newItem, ...items.slice(0, 999)]; // Keep max 1000 items

        await this.saveClipboardItems(updatedItems);
        return newItem;
    }

    async deleteClipboardItem(id: string): Promise<boolean> {
        try {
            const items = await this.getClipboardItems();
            const updatedItems = items.filter(item => item.id !== id);
            await this.saveClipboardItems(updatedItems);
            return true;
        } catch (error) {
            console.error('Failed to delete clipboard item:', error);
            return false;
        }
    }

    async getClipboardFolders(): Promise<ClipboardFolder[]> {
        try {
            // Always check local storage first
            const localResult = await chrome.storage.local.get(this.STORAGE_KEYS.FOLDERS);
            if (localResult[this.STORAGE_KEYS.FOLDERS]) {
                return localResult[this.STORAGE_KEYS.FOLDERS];
            }

            // Fallback to sync storage
            const syncResult = await chrome.storage.sync.get(this.STORAGE_KEYS.FOLDERS);
            if (syncResult[this.STORAGE_KEYS.FOLDERS]) {
                // Migrate to local storage
                await this.saveClipboardFolders(syncResult[this.STORAGE_KEYS.FOLDERS]);
                return syncResult[this.STORAGE_KEYS.FOLDERS];
            }

            return [];
        } catch (error) {
            console.error('Failed to get clipboard folders:', error);
            return [];
        }
    }

    async saveClipboardFolders(folders: ClipboardFolder[]): Promise<void> {
        try {
            // Always save to local storage first
            await chrome.storage.local.set({ [this.STORAGE_KEYS.FOLDERS]: folders });
            console.log(`Saved ${folders.length} clipboard folders to local storage`);

            // Also try to sync if data is small enough
            const foldersSize = new Blob([JSON.stringify(folders)]).size;
            if (foldersSize <= 80000) {
                try {
                    await chrome.storage.sync.set({ [this.STORAGE_KEYS.FOLDERS]: folders });
                } catch (syncError) {
                    console.warn('Folder sync storage failed, but local storage succeeded:', syncError);
                }
            } else {
                // Clear from sync storage if too large
                try {
                    await chrome.storage.sync.remove(this.STORAGE_KEYS.FOLDERS);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        } catch (error) {
            console.error('Failed to save clipboard folders:', error);
            throw error;
        }
    }

    async createFolder(name: string, parentId?: string): Promise<ClipboardFolder> {
        const newFolder: ClipboardFolder = {
            id: crypto.randomUUID(),
            name,
            parentId,
            children: [],
            expanded: true,
            createdAt: Date.now(),
            items: []
        };

        const folders = await this.getClipboardFolders();

        if (parentId) {
            // Add as child to parent folder
            const addToParent = (folderList: ClipboardFolder[]): ClipboardFolder[] => {
                return folderList.map(folder => {
                    if (folder.id === parentId) {
                        return { ...folder, children: [...folder.children, newFolder] };
                    }
                    if (folder.children.length > 0) {
                        return { ...folder, children: addToParent(folder.children) };
                    }
                    return folder;
                });
            };

            const updatedFolders = addToParent(folders);
            await this.saveClipboardFolders(updatedFolders);
        } else {
            // Add as root folder
            const updatedFolders = [...folders, newFolder];
            await this.saveClipboardFolders(updatedFolders);
        }

        return newFolder;
    }

    async deleteFolder(id: string): Promise<boolean> {
        try {
            const removeFolder = (folderList: ClipboardFolder[]): ClipboardFolder[] => {
                return folderList
                    .filter(folder => folder.id !== id)
                    .map(folder => ({
                        ...folder,
                        children: removeFolder(folder.children)
                    }));
            };

            const folders = await this.getClipboardFolders();
            const updatedFolders = removeFolder(folders);
            await this.saveClipboardFolders(updatedFolders);

            // Also remove items in this folder
            const items = await this.getClipboardItems();
            const updatedItems = items.filter(item => item.folderId !== id);
            await this.saveClipboardItems(updatedItems);

            return true;
        } catch (error) {
            console.error('Failed to delete folder:', error);
            return false;
        }
    }

    // Enhanced migration to handle multiple versions
    async migrateOldData(): Promise<void> {
        try {
            const oldVersions = [
                { ITEMS: 'clipboard_items', FOLDERS: 'clipboard_folders' },
                { ITEMS: 'clipboard_items_v2', FOLDERS: 'clipboard_folders_v2' }
            ];

            for (const oldKeys of oldVersions) {
                // Check for old data in both storages
                const [oldSyncData, oldLocalData] = await Promise.all([
                    chrome.storage.sync.get([oldKeys.ITEMS, oldKeys.FOLDERS]),
                    chrome.storage.local.get([oldKeys.ITEMS, oldKeys.FOLDERS])
                ]);

                let migratedItems: ClipboardItem[] = [];
                let migratedFolders: ClipboardFolder[] = [];

                // Prefer local data over sync data for migration
                if (oldLocalData[oldKeys.ITEMS]) {
                    migratedItems = oldLocalData[oldKeys.ITEMS];
                } else if (oldSyncData[oldKeys.ITEMS]) {
                    migratedItems = oldSyncData[oldKeys.ITEMS];
                }

                if (oldLocalData[oldKeys.FOLDERS]) {
                    migratedFolders = oldLocalData[oldKeys.FOLDERS];
                } else if (oldSyncData[oldKeys.FOLDERS]) {
                    migratedFolders = oldSyncData[oldKeys.FOLDERS];
                }

                // Only migrate if we have data and current storage is empty
                const currentItems = await this.getClipboardItems();
                const currentFolders = await this.getClipboardFolders();

                if (migratedItems.length > 0 && currentItems.length === 0) {
                    await this.saveClipboardItems(migratedItems);
                    console.log(`Migrated ${migratedItems.length} clipboard items from ${oldKeys.ITEMS}`);
                }

                if (migratedFolders.length > 0 && currentFolders.length === 0) {
                    await this.saveClipboardFolders(migratedFolders);
                    console.log(`Migrated ${migratedFolders.length} clipboard folders from ${oldKeys.FOLDERS}`);
                }

                // Clean up old data after successful migration
                if (migratedItems.length > 0 || migratedFolders.length > 0) {
                    await Promise.all([
                        chrome.storage.sync.remove([oldKeys.ITEMS, oldKeys.FOLDERS]),
                        chrome.storage.local.remove([oldKeys.ITEMS, oldKeys.FOLDERS])
                    ]);
                    console.log('Cleaned up old storage keys:', oldKeys);
                }
            }

        } catch (error) {
            console.error('Failed to migrate old data:', error);
        }
    }

    // Initialize storage and perform migration if needed
    async initialize(): Promise<void> {
        console.log('Initializing clipboard storage...');
        await this.migrateOldData();

        // Log current storage state
        const items = await this.getClipboardItems();
        const folders = await this.getClipboardFolders();
        console.log(`Storage initialized: ${items.length} items, ${folders.length} folders`);
    }

    // Manual backup/restore functionality
    async exportData(): Promise<string> {
        const items = await this.getClipboardItems();
        const folders = await this.getClipboardFolders();

        return JSON.stringify({
            version: 3,
            timestamp: Date.now(),
            items,
            folders
        }, null, 2);
    }

    async importData(jsonData: string): Promise<boolean> {
        try {
            const data = JSON.parse(jsonData);

            if (data.items && Array.isArray(data.items)) {
                await this.saveClipboardItems(data.items);
            }

            if (data.folders && Array.isArray(data.folders)) {
                await this.saveClipboardFolders(data.folders);
            }

            console.log('Data imported successfully');
            return true;
        } catch (error) {
            console.error('Failed to import data:', error);
            return false;
        }
    }
}

export const clipboardStorage = new ClipboardStorage();

// Auto-initialize when module is loaded
clipboardStorage.initialize().catch(console.error);