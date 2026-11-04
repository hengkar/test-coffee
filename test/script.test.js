const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const scriptPath = '/home/runner/work/test-coffee/test-coffee/script.js';
const scriptSource = fs.readFileSync(scriptPath, 'utf8') + '\nthis.__CoffeeTracker = CoffeeTracker;';

function createElementStub() {
    return {
        value: '',
        textContent: '',
        innerHTML: '',
        style: { display: 'none' },
        addEventListener: () => {},
        scrollIntoView: () => {},
        reset: () => {}
    };
}

function createTestContext({ coffeeData = [], DateImpl = Date } = {}) {
    const elements = new Map();
    const requiredIds = [
        'historyDate', 'dailyGoal', 'addCoffeeBtn', 'resetBtn', 'cancelBtn', 'coffeeForm',
        'addCoffeeForm', 'coffeeTime', 'todayCount', 'coffeeList', 'totalCups', 'avgPerDay',
        'favoriteType', 'coffeeType', 'coffeeSize', 'coffeeNotes'
    ];

    requiredIds.forEach(id => elements.set(id, createElementStub()));

    const localStorage = {
        store: {
            coffeeData: JSON.stringify(coffeeData),
            coffeeDailyGoal: '3'
        },
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
        },
        setItem(key, value) {
            this.store[key] = String(value);
        }
    };

    const document = {
        getElementById(id) {
            if (!elements.has(id)) {
                elements.set(id, createElementStub());
            }
            return elements.get(id);
        },
        addEventListener: () => {},
        querySelector: () => null,
        createElement: () => createElementStub(),
        head: { appendChild: () => {} },
        body: { appendChild: () => {} }
    };

    const context = {
        document,
        localStorage,
        alert: () => {},
        confirm: () => true,
        setTimeout: (fn) => {
            fn();
            return 0;
        },
        clearTimeout: () => {},
        Date: DateImpl,
        Blob: class {},
        URL: {
            createObjectURL: () => 'blob:url',
            revokeObjectURL: () => {}
        }
    };

    vm.createContext(context);
    vm.runInContext(scriptSource, context, { filename: 'script.js' });

    return { context, elements };
}

test('constructor initializes without missing getLocalDate and updates date input', () => {
    const fakeDate = {
        getFullYear: () => 2026,
        getMonth: () => 10,
        getDate: () => 4,
        toDateString: () => 'Tue Nov 04 2026',
        toTimeString: () => '09:15:00 GMT+0000'
    };
    class FakeDate {
        constructor() {
            return fakeDate;
        }
        static now() {
            return 0;
        }
    }

    const { context, elements } = createTestContext({ DateImpl: FakeDate });
    const CoffeeTracker = context.__CoffeeTracker;

    assert.doesNotThrow(() => new CoffeeTracker());
    assert.equal(elements.get('historyDate').value, '2026-11-04');
});

test('getLocalDate uses local calendar fields instead of UTC ISO conversion', () => {
    const { context } = createTestContext();
    const CoffeeTracker = context.__CoffeeTracker;
    const tracker = new CoffeeTracker();

    const nearMidnightPositiveOffset = {
        getFullYear: () => 2026,
        getMonth: () => 0,
        getDate: () => 1,
        toISOString: () => '2025-12-31T10:30:00.000Z'
    };

    const nearMidnightNegativeOffset = {
        getFullYear: () => 2026,
        getMonth: () => 11,
        getDate: () => 31,
        toISOString: () => '2027-01-01T07:30:00.000Z'
    };

    assert.equal(tracker.getLocalDate(nearMidnightPositiveOffset), '2026-01-01');
    assert.equal(tracker.getLocalDate(nearMidnightNegativeOffset), '2026-12-31');
});

test('existing toDateString entries remain visible on startup', () => {
    const today = new Date().toDateString();
    const { context, elements } = createTestContext({
        coffeeData: [{ id: 1, type: 'Latte', size: 'Medium', time: '08:30', notes: '', date: today }]
    });
    const CoffeeTracker = context.__CoffeeTracker;

    new CoffeeTracker();

    assert.equal(elements.get('todayCount').textContent, 1);
    assert.match(elements.get('coffeeList').innerHTML, /Latte/);
});
