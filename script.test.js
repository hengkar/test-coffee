const test = require('node:test');
const assert = require('node:assert/strict');

function createElement(overrides = {}) {
    const listeners = {};
    const element = {
        value: '',
        textContent: '',
        innerHTML: '',
        hidden: false,
        style: { display: 'none' },
        addEventListener(type, handler) {
            listeners[type] = handler;
        },
        dispatch(type, payload = {}) {
            if (listeners[type]) {
                listeners[type]({ target: element, preventDefault() {}, ...payload });
            }
        },
        scrollIntoView() {},
        reset() {},
        ...overrides
    };
    return element;
}

function setupEnvironment(seedData = []) {
    const storage = {
        coffeeData: JSON.stringify(seedData),
        coffeeDailyGoal: '3'
    };

    const ids = {
        historyDate: createElement(),
        dailyGoal: createElement(),
        addCoffeeBtn: createElement(),
        resetBtn: createElement(),
        cancelBtn: createElement(),
        coffeeForm: createElement(),
        todayCount: createElement(),
        coffeeList: createElement(),
        totalCups: createElement(),
        avgPerDay: createElement(),
        favoriteType: createElement(),
        coffeeTime: createElement(),
        coffeeType: createElement(),
        coffeeSize: createElement(),
        coffeeNotes: createElement(),
        addCoffeeForm: createElement(),
        historyHeading: createElement(),
        todayHistoryBtn: createElement(),
        goalForm: createElement(),
        goalProgress: createElement(),
        goalStatus: createElement(),
        coffeeFormHeading: createElement(),
        saveCoffeeBtn: createElement(),
        editingDate: createElement(),
    };

    ids.coffeeForm.reset = () => {
        ids.coffeeType.value = '';
        ids.coffeeSize.value = '';
        ids.coffeeTime.value = '';
        ids.coffeeNotes.value = '';
    };

    global.localStorage = {
        getItem(key) {
            return key in storage ? storage[key] : null;
        },
        setItem(key, value) {
            storage[key] = String(value);
        }
    };

    global.document = {
        getElementById(id) {
            if (!ids[id]) {
                throw new Error(`Missing element id ${id}`);
            }
            return ids[id];
        },
        addEventListener() {},
        querySelector() {
            return null;
        },
        createElement() {
            return createElement();
        },
        body: { appendChild() {} },
        head: { appendChild() {} }
    };

    global.alert = () => {};
    global.confirm = () => true;

    delete require.cache[require.resolve('./script.js')];
    const { CoffeeTracker } = require('./script.js');
    const tracker = new CoffeeTracker();
    tracker.showNotification = () => {};
    return { tracker, ids };
}

function isoDateForOffset(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return offsetDate.toISOString().slice(0, 10);
}

test('filters history by selected date and supports legacy toDateString records', () => {
    const todayDate = new Date();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);

    const { tracker, ids } = setupEnvironment([
        { id: 1, type: 'Latte', size: 'Medium', time: '08:00', notes: '', date: todayDate.toDateString() },
        { id: 2, type: 'Espresso', size: 'Small', time: '07:30', notes: '', date: yesterdayDate.toDateString() }
    ]);

    ids.historyDate.value = isoDateForOffset(-1);
    ids.historyDate.dispatch('change');

    assert.match(ids.historyHeading.textContent, /Coffee History for/i);
    assert.match(ids.coffeeList.innerHTML, /Espresso/);
    assert.doesNotMatch(ids.coffeeList.innerHTML, /Latte/);
});

test('editing updates existing entry in place and preserves id/date', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 2);

    const { tracker, ids } = setupEnvironment([
        { id: 22, type: 'Latte', size: 'Medium', time: '09:10', notes: 'old', date: oldDate.toDateString() }
    ]);

    tracker.editCoffee(22);
    assert.equal(ids.saveCoffeeBtn.textContent, 'Save Changes');
    assert.equal(ids.coffeeType.value, 'Latte');

    ids.coffeeType.value = 'Mocha';
    ids.coffeeSize.value = 'Large';
    ids.coffeeTime.value = '10:15';
    ids.coffeeNotes.value = 'updated';
    tracker.addCoffee();

    assert.equal(tracker.coffeeData.length, 1);
    assert.equal(tracker.coffeeData[0].id, 22);
    assert.equal(tracker.coffeeData[0].date, oldDate.toDateString());
    assert.equal(tracker.coffeeData[0].type, 'Mocha');
});

test('canceling an edit clears state so next add creates a new today entry', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);

    const { tracker, ids } = setupEnvironment([
        { id: 31, type: 'Americano', size: 'Small', time: '07:20', notes: '', date: pastDate.toDateString() }
    ]);

    tracker.editCoffee(31);
    tracker.hideAddForm();

    assert.equal(tracker.editingId, null);
    assert.equal(ids.saveCoffeeBtn.textContent, 'Add Coffee');

    tracker.selectedDate = isoDateForOffset(-3);
    ids.coffeeType.value = 'Cold Brew';
    ids.coffeeSize.value = 'Large';
    ids.coffeeTime.value = '12:00';
    ids.coffeeNotes.value = 'new';
    tracker.addCoffee();

    assert.equal(tracker.coffeeData.length, 2);
    const newest = tracker.coffeeData[1];
    assert.equal(newest.type, 'Cold Brew');
    assert.equal(newest.date, new Date().toDateString());
});
