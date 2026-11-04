const test = require('node:test');
const assert = require('node:assert/strict');

function createElement(initial = {}) {
    const attrs = new Map();
    return {
        value: initial.value || '',
        textContent: initial.textContent || '',
        innerHTML: initial.innerHTML || '',
        style: initial.style || { display: 'none' },
        listeners: {},
        addEventListener(event, handler) {
            this.listeners[event] = handler;
        },
        dispatch(event, payload) {
            this.listeners[event]?.(payload);
        },
        setAttribute(name, value) {
            attrs.set(name, String(value));
        },
        removeAttribute(name) {
            attrs.delete(name);
        },
        getAttribute(name) {
            return attrs.get(name);
        },
        scrollIntoView() {},
        reset() {
            this.value = '';
        }
    };
}

function setupEnvironment(localStorageValues = {}) {
    const storage = new Map(Object.entries(localStorageValues));
    const elements = {
        historyDate: createElement(),
        dailyGoal: createElement(),
        goalForm: createElement(),
        addCoffeeBtn: createElement(),
        resetBtn: createElement(),
        cancelBtn: createElement(),
        coffeeForm: createElement(),
        coffeeType: createElement(),
        coffeeSize: createElement(),
        coffeeTime: createElement(),
        coffeeNotes: createElement(),
        addCoffeeForm: createElement({ style: { display: 'none' } }),
        todayCount: createElement({ textContent: '0' }),
        goalProgress: createElement({ value: 0, max: 3 }),
        goalStatus: createElement(),
        coffeeList: createElement(),
        totalCups: createElement(),
        avgPerDay: createElement(),
        favoriteType: createElement()
    };

    global.localStorage = {
        getItem(key) {
            return storage.has(key) ? storage.get(key) : null;
        },
        setItem(key, value) {
            storage.set(key, String(value));
        }
    };

    global.document = {
        getElementById(id) {
            return elements[id];
        },
        addEventListener() {},
        querySelector() {
            return null;
        },
        createElement() {
            return createElement();
        },
        head: { appendChild() {} },
        body: { appendChild() {} }
    };

    global.alert = () => {};
    global.confirm = () => true;
    global.setTimeout = (fn) => fn();

    return { elements, storage };
}

test('restores saved goal and updates progress from todays count', () => {
    const today = new Date().toDateString();
    const { storage } = setupEnvironment({
        coffeeDailyGoal: '4',
        coffeeData: JSON.stringify([{ id: 1, type: 'Latte', size: 'Medium', time: '09:00', date: today }])
    });
    const { CoffeeTracker } = require('./script.js');

    const tracker = new CoffeeTracker();

    assert.equal(tracker.dailyGoal, 4);
    assert.equal(document.getElementById('dailyGoal').value, 4);
    assert.equal(document.getElementById('goalProgress').max, 4);
    assert.equal(document.getElementById('goalProgress').value, 1);
    assert.match(document.getElementById('goalStatus').textContent, /logged 1 cup today/i);
    assert.equal(storage.get('coffeeDailyGoal'), '4');
});

test('rejects invalid and fractional goal values with accessible feedback', () => {
    setupEnvironment();
    const { CoffeeTracker } = require('./script.js');
    const tracker = new CoffeeTracker();
    const goalInput = document.getElementById('dailyGoal');

    goalInput.value = '2.5';
    tracker.saveDailyGoal();
    assert.equal(goalInput.getAttribute('aria-invalid'), 'true');
    assert.match(document.getElementById('goalStatus').textContent, /whole number from 1 to 100/i);

    goalInput.value = '101';
    tracker.saveDailyGoal();
    assert.equal(goalInput.getAttribute('aria-invalid'), 'true');
});

test('saves valid goals and keeps progress valid when count exceeds goal', () => {
    const today = new Date().toDateString();
    setupEnvironment({
        coffeeData: JSON.stringify([
            { id: 1, type: 'Latte', size: 'Small', time: '08:00', date: today },
            { id: 2, type: 'Latte', size: 'Small', time: '09:00', date: today },
            { id: 3, type: 'Latte', size: 'Small', time: '10:00', date: today },
            { id: 4, type: 'Latte', size: 'Small', time: '11:00', date: today },
            { id: 5, type: 'Latte', size: 'Small', time: '12:00', date: today }
        ])
    });
    const { CoffeeTracker } = require('./script.js');
    const tracker = new CoffeeTracker();
    const goalInput = document.getElementById('dailyGoal');

    goalInput.value = '3';
    tracker.saveDailyGoal();

    assert.equal(localStorage.getItem('coffeeDailyGoal'), '3');
    assert.equal(document.getElementById('goalProgress').max, 3);
    assert.equal(document.getElementById('goalProgress').value, 3);
    assert.match(document.getElementById('goalStatus').textContent, /logged 5 cups today/i);
});

test('updates goal progress after add, delete, and reset actions', () => {
    setupEnvironment({ coffeeDailyGoal: '2' });
    const { CoffeeTracker } = require('./script.js');
    const tracker = new CoffeeTracker();
    const originalDateNow = Date.now;
    let nextId = 1000;
    Date.now = () => nextId++;

    document.getElementById('coffeeType').value = 'Latte';
    document.getElementById('coffeeSize').value = 'Medium';
    document.getElementById('coffeeTime').value = '08:00';

    tracker.addCoffee();
    assert.match(document.getElementById('goalStatus').textContent, /logged 1 cup today/i);
    assert.equal(document.getElementById('goalProgress').value, 1);

    document.getElementById('coffeeType').value = 'Latte';
    document.getElementById('coffeeSize').value = 'Medium';
    document.getElementById('coffeeTime').value = '09:00';
    tracker.addCoffee();
    assert.match(document.getElementById('goalStatus').textContent, /logged 2 cups today/i);
    assert.equal(document.getElementById('goalProgress').value, 2);

    const [firstCup] = tracker.getTodaysCoffee();
    tracker.deleteCoffee(firstCup.id);
    assert.match(document.getElementById('goalStatus').textContent, /logged 1 cup today/i);
    assert.equal(document.getElementById('goalProgress').value, 1);

    tracker.resetToday();
    assert.match(document.getElementById('goalStatus').textContent, /logged 0 cups today/i);
    assert.equal(document.getElementById('goalProgress').value, 0);

    Date.now = originalDateNow;
});
