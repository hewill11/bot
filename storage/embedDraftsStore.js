const fs = require('fs');
const path = require('path');

const DATA_DIRECTORY = path.join(__dirname, '..', 'data');
const DATA_FILE_PATH = path.join(DATA_DIRECTORY, 'embed-drafts.json');

function createEmptyStore() {
    return {
        drafts: {},
    };
}

function ensureEmbedDraftStoreFile() {
    fs.mkdirSync(DATA_DIRECTORY, { recursive: true });

    if (!fs.existsSync(DATA_FILE_PATH)) {
        writeStore(createEmptyStore());
    }
}

function getEmbedDraft(userId) {
    const store = readStore();
    return store.drafts[userId] || null;
}

function saveEmbedDraft(draft) {
    const store = readStore();
    store.drafts[draft.userId] = draft;
    writeStore(store);
    return draft;
}

function patchEmbedDraft(userId, updates) {
    const store = readStore();
    const existingDraft = store.drafts[userId];

    if (!existingDraft) {
        return null;
    }

    const updatedDraft = {
        ...existingDraft,
        ...updates,
        updatedAt: new Date().toISOString(),
    };

    store.drafts[userId] = updatedDraft;
    writeStore(store);
    return updatedDraft;
}

function deleteEmbedDraft(userId) {
    const store = readStore();

    if (!store.drafts[userId]) {
        return false;
    }

    delete store.drafts[userId];
    writeStore(store);
    return true;
}

function readStore() {
    ensureEmbedDraftStoreFile();

    try {
        const rawContent = fs.readFileSync(DATA_FILE_PATH, 'utf8').trim();

        if (!rawContent) {
            return createEmptyStore();
        }

        const parsed = JSON.parse(rawContent);

        if (!parsed || typeof parsed !== 'object' || typeof parsed.drafts !== 'object') {
            throw new Error('Invalid embed drafts store format.');
        }

        return parsed;
    } catch (error) {
        console.error('Не удалось прочитать embed-drafts.json, хранилище будет пересоздано:', error);
        writeStore(createEmptyStore());
        return createEmptyStore();
    }
}

function writeStore(store) {
    fs.mkdirSync(DATA_DIRECTORY, { recursive: true });
    fs.writeFileSync(DATA_FILE_PATH, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

module.exports = {
    ensureEmbedDraftStoreFile,
    getEmbedDraft,
    saveEmbedDraft,
    patchEmbedDraft,
    deleteEmbedDraft,
};
