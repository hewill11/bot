const fs = require('fs');
const path = require('path');

const DATA_DIRECTORY = path.join(__dirname, '..', 'data');
const DATA_FILE_PATH = path.join(DATA_DIRECTORY, 'applications.json');
function createEmptyStore() {
    return {
        applications: {},
    };
}

function ensureStoreFile() {
    fs.mkdirSync(DATA_DIRECTORY, { recursive: true });

    if (!fs.existsSync(DATA_FILE_PATH)) {
        writeStore(createEmptyStore());
    }
}

function getApplication(userId) {
    const store = readStore();
    return store.applications[userId] || null;
}

function saveApplication(application) {
    const store = readStore();
    store.applications[application.userId] = application;
    writeStore(store);
    return application;
}

function patchApplication(userId, updates) {
    const store = readStore();
    const existingApplication = store.applications[userId];

    if (!existingApplication) {
        return null;
    }

    const updatedApplication = {
        ...existingApplication,
        ...updates,
    };

    store.applications[userId] = updatedApplication;
    writeStore(store);
    return updatedApplication;
}

function readStore() {
    ensureStoreFile();

    try {
        const rawContent = fs.readFileSync(DATA_FILE_PATH, 'utf8').trim();

        if (!rawContent) {
            return createEmptyStore();
        }

        const parsed = JSON.parse(rawContent);

        if (!parsed || typeof parsed !== 'object' || typeof parsed.applications !== 'object') {
            throw new Error('Invalid applications store format.');
        }

        return parsed;
    } catch (error) {
        console.error('Не удалось прочитать applications.json, хранилище будет пересоздано:', error);
        writeStore(createEmptyStore());
        return createEmptyStore();
    }
}

function writeStore(store) {
    fs.mkdirSync(DATA_DIRECTORY, { recursive: true });
    fs.writeFileSync(DATA_FILE_PATH, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

module.exports = {
    ensureStoreFile,
    getApplication,
    saveApplication,
    patchApplication,
};
