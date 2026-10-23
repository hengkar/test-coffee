const test = require('node:test');
const assert = require('node:assert/strict');

const { CoffeeBackup, CoffeeTracker, STORAGE_KEYS, SUPPORTED_BACKUP_VERSION } = require('./script.js');

function createStorage() {
    const store = new Map();
    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
        clear() {
            store.clear();
        }
    };
}

function makeEntry(id, overrides = {}) {
    return {
        id,
        type: 'Espresso',
        size: 'Small',
        time: '09:00',
        notes: 'Morning brew',
        date: 'Tue Jan 02 2024',
        ...overrides
    };
}

test('backup round trip preserves entries and daily goal', () => {
    const tracker = new CoffeeTracker();
    tracker.coffeeData = [makeEntry(1), makeEntry(2, { type: 'Latte', time: '15:30' })];
    tracker.dailyGoal = 3;

    const payload = CoffeeBackup.createPayload(tracker.coffeeData, tracker.dailyGoal);
    assert.equal(payload.version, SUPPORTED_BACKUP_VERSION);
    assert.equal(payload.dailyGoal, 3);
    assert.equal(payload.entries.length, 2);

    const validated = CoffeeBackup.validatePayload(payload);
    assert.deepEqual(validated.entries, payload.entries);
    assert.equal(validated.dailyGoal, 3);

    const serialized = JSON.stringify(payload);
    const restored = CoffeeBackup.parseJson(serialized);
    assert.equal(restored.entries.length, 2);
    assert.equal(restored.dailyGoal, 3);
});

test('empty backups are valid and accept zero goal', () => {
    const empty = CoffeeBackup.createPayload([], 0);
    assert.deepEqual(empty.entries, []);
    assert.equal(empty.dailyGoal, 0);
    assert.deepEqual(CoffeeBackup.validatePayload(empty), {
        version: SUPPORTED_BACKUP_VERSION,
        exportedAt: empty.exportedAt,
        entries: [],
        dailyGoal: 0
    });
});

test('malformed JSON is rejected with an actionable message', () => {
    assert.throws(() => CoffeeBackup.parseJson('{oops'), /not valid JSON/i);
    assert.throws(() => CoffeeBackup.validatePayload({ version: 1, entries: 'nope', dailyGoal: 0 }), /missing the "entries" array/i);
});

test('unsupported backup versions are rejected', () => {
    const payload = {
        version: 99,
        entries: [makeEntry(1)],
        dailyGoal: 0
    };

    assert.throws(() => CoffeeBackup.validatePayload(payload), /Unsupported backup version/i);
});

test('cancelled imports leave existing data unchanged', () => {
    global.localStorage = createStorage();
    const originalEntries = [makeEntry(1), makeEntry(2)];
    global.localStorage.setItem(STORAGE_KEYS.coffeeData, JSON.stringify(originalEntries));
    global.localStorage.setItem(STORAGE_KEYS.coffeeGoal, '5');
    global.confirm = () => false;
    global.alert = () => {};
    global.FileReader = class {
        constructor() {
            this.onload = null;
            this.onerror = null;
        }

        readAsText() {
            this.onload({ target: { result: JSON.stringify({ version: 1, exportedAt: '2024-01-01T00:00:00.000Z', entries: [makeEntry(99)], dailyGoal: 2 }) } });
        }
    };
    global.document = {
        getElementById() {
            return null;
        },
        createElement() {
            return { style: {}, textContent: '', parentNode: null };
        },
        head: { appendChild() {} },
        body: { appendChild() {} },
        querySelector() {
            return null;
        }
    };

    const tracker = new CoffeeTracker();
    assert.deepEqual(tracker.coffeeData, originalEntries);
    assert.equal(tracker.dailyGoal, 5);

    tracker.importDataFromFile({ name: 'backup.json' });

    assert.deepEqual(tracker.coffeeData, originalEntries);
    assert.equal(tracker.dailyGoal, 5);
    assert.deepEqual(JSON.parse(global.localStorage.getItem(STORAGE_KEYS.coffeeData)), originalEntries);
    assert.equal(global.localStorage.getItem(STORAGE_KEYS.coffeeGoal), '5');
});
