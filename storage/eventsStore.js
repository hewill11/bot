const fs = require('fs');
const path = require('path');

const DATA_DIRECTORY = path.join(__dirname, '..', 'data');
const DATA_FILE_PATH = path.join(DATA_DIRECTORY, 'events.json');

function createEmptyStore() {
    return {
        events: {},
        registrations: {},
    };
}

function ensureEventStoreFile() {
    fs.mkdirSync(DATA_DIRECTORY, { recursive: true });

    if (!fs.existsSync(DATA_FILE_PATH)) {
        writeStore(createEmptyStore());
    }
}

function getEvent(eventId) {
    const store = readStore();
    return store.events[eventId] || null;
}

function saveEvent(event) {
    const store = readStore();
    store.events[event.eventId] = event;
    writeStore(store);
    return event;
}

function getEventRegistration(eventId, userId) {
    const store = readStore();
    return store.registrations[getRegistrationKey(eventId, userId)] || null;
}

function saveEventRegistration(registration) {
    const store = readStore();
    store.registrations[getRegistrationKey(registration.eventId, registration.userId)] = registration;
    writeStore(store);
    return registration;
}

function getRegistrationKey(eventId, userId) {
    return `${eventId}:${userId}`;
}

function readStore() {
    ensureEventStoreFile();

    try {
        const rawContent = fs.readFileSync(DATA_FILE_PATH, 'utf8').trim();

        if (!rawContent) {
            return createEmptyStore();
        }

        const parsed = JSON.parse(rawContent);

        if (!parsed ||
            typeof parsed !== 'object' ||
            typeof parsed.events !== 'object' ||
            typeof parsed.registrations !== 'object') {
            throw new Error('Invalid events store format.');
        }

        return parsed;
    } catch (error) {
        console.error('Не удалось прочитать events.json, хранилище будет пересоздано:', error);
        writeStore(createEmptyStore());
        return createEmptyStore();
    }
}

function writeStore(store) {
    fs.mkdirSync(DATA_DIRECTORY, { recursive: true });
    fs.writeFileSync(DATA_FILE_PATH, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

module.exports = {
    ensureEventStoreFile,
    getEvent,
    saveEvent,
    getEventRegistration,
    saveEventRegistration,
};
