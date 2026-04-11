const fs = require('fs');
const path = require('path');

const DATA_DIRECTORY = path.join(__dirname, '..', 'data');
const DATA_FILE_PATH = path.join(DATA_DIRECTORY, 'courts.json');

function createEmptyStore() {
    return {
        courts: {},
    };
}

function ensureCourtStoreFile() {
    fs.mkdirSync(DATA_DIRECTORY, { recursive: true });

    if (!fs.existsSync(DATA_FILE_PATH)) {
        writeStore(createEmptyStore());
    }
}

function getCourt(caseId) {
    const store = readStore();
    return store.courts[caseId] || null;
}

function saveCourt(court) {
    const store = readStore();
    store.courts[court.caseId] = court;
    writeStore(store);
    return court;
}

function patchCourt(caseId, updates) {
    const store = readStore();
    const existingCourt = store.courts[caseId];

    if (!existingCourt) {
        return null;
    }

    const updatedCourt = {
        ...existingCourt,
        ...updates,
    };

    store.courts[caseId] = updatedCourt;
    writeStore(store);
    return updatedCourt;
}

function readStore() {
    ensureCourtStoreFile();

    try {
        const rawContent = fs.readFileSync(DATA_FILE_PATH, 'utf8').trim();

        if (!rawContent) {
            return createEmptyStore();
        }

        const parsed = JSON.parse(rawContent);

        if (!parsed || typeof parsed !== 'object' || typeof parsed.courts !== 'object') {
            throw new Error('Invalid courts store format.');
        }

        return parsed;
    } catch (error) {
        console.error('Не удалось прочитать courts.json, хранилище будет пересоздано:', error);
        writeStore(createEmptyStore());
        return createEmptyStore();
    }
}

function writeStore(store) {
    fs.mkdirSync(DATA_DIRECTORY, { recursive: true });
    fs.writeFileSync(DATA_FILE_PATH, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

module.exports = {
    ensureCourtStoreFile,
    getCourt,
    saveCourt,
    patchCourt,
};
