const fs = require('fs');
const path = require('path');

const DATA_DIRECTORY = path.join(__dirname, '..', 'data');
const DATA_FILE_PATH = path.join(DATA_DIRECTORY, 'componentsv2-drafts.json');

function createEmptyStore() {
    return {
        drafts: {},
    };
}

function ensureComponentsV2DraftStoreFile() {
    fs.mkdirSync(DATA_DIRECTORY, { recursive: true });

    if (!fs.existsSync(DATA_FILE_PATH)) {
        writeStore(createEmptyStore());
    }
}

function getComponentsV2Draft(userId) {
    const store = readStore();
    return store.drafts[userId] || null;
}

function saveComponentsV2Draft(draft) {
    const store = readStore();
    store.drafts[draft.userId] = draft;
    writeStore(store);
    return draft;
}

function patchComponentsV2Draft(userId, updates) {
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

function deleteComponentsV2Draft(userId) {
    const store = readStore();

    if (!store.drafts[userId]) {
        return false;
    }

    delete store.drafts[userId];
    writeStore(store);
    return true;
}

function readStore() {
    ensureComponentsV2DraftStoreFile();

    try {
        const rawContent = fs.readFileSync(DATA_FILE_PATH, 'utf8').trim();

        if (!rawContent) {
            return createEmptyStore();
        }

        const parsed = JSON.parse(rawContent);

        if (!parsed || typeof parsed !== 'object' || typeof parsed.drafts !== 'object') {
            throw new Error('Invalid components v2 drafts store format.');
        }

        return parsed;
    } catch (error) {
        console.error('Не удалось прочитать componentsv2-drafts.json, хранилище будет пересоздано:', error);
        writeStore(createEmptyStore());
        return createEmptyStore();
    }
}

function writeStore(store) {
    fs.mkdirSync(DATA_DIRECTORY, { recursive: true });
    fs.writeFileSync(DATA_FILE_PATH, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

module.exports = {
    ensureComponentsV2DraftStoreFile,
    getComponentsV2Draft,
    saveComponentsV2Draft,
    patchComponentsV2Draft,
    deleteComponentsV2Draft,
};
