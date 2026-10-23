const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = path.join(__dirname, '..', 'script.js');
const source = fs.readFileSync(scriptPath, 'utf8');

function createElement() {
  return {
    style: {},
    dataset: {},
    value: '',
    innerHTML: '',
    textContent: '',
    classList: {
      toggle() {},
      add() {},
      remove() {}
    },
    addEventListener() {},
    setAttribute() {},
    reset() {},
    scrollIntoView() {},
    appendChild() {},
    removeChild() {},
    querySelector() { return null; }
  };
}

function makeDocument() {
  const elements = {};
  const trendButtons = [7, 30].map((range) => {
    const button = createElement();
    button.dataset = { range: String(range) };
    return button;
  });

  return {
    elements,
    trendButtons,
    getElementById(id) {
      if (!elements[id]) {
        elements[id] = createElement();
      }
      return elements[id];
    },
    querySelectorAll(selector) {
      if (selector === '.trend-btn') {
        return this.trendButtons;
      }
      return [];
    },
    querySelector() { return null; },
    createElement() { return createElement(); },
    addEventListener() {},
    head: { appendChild() {} },
    body: { appendChild() {}, removeChild() {} }
  };
}

function loadApp() {
  const storage = {};
  const document = makeDocument();
  const context = {
    console,
    document,
    localStorage: {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
      },
      setItem(key, value) {
        storage[key] = String(value);
      },
      removeItem(key) {
        delete storage[key];
      }
    },
    alert() {},
    confirm() { return true; },
    setTimeout(fn) { return fn(); },
    clearTimeout() {},
    Date,
    Blob,
    URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    FileReader: function FileReader() {
      this.readAsText = () => {};
      this.onload = null;
    }
  };

  vm.createContext(context);
  vm.runInContext(source, context);

  return { context, document, storage };
}

test('buildTrendData counts zero days and ignores records outside the selected range', () => {
  const { context } = loadApp();
  const endDate = new Date(2025, 0, 7);
  const trend = context.buildTrendData([
    { id: 1, type: 'Latte', date: '2025-01-01' },
    { id: 2, type: 'Latte', date: '2025-01-02' },
    { id: 3, type: 'Espresso', date: '2025-01-05' },
    { id: 4, type: 'Americano', date: '2025-01-09' }
  ], 7, endDate);

  assert.equal(trend.trendDays.length, 7);
  assert.equal(JSON.stringify(trend.trendDays.map((day) => day.total)), JSON.stringify([1, 1, 0, 0, 1, 0, 0]));
  assert.equal(trend.totalCups, 3);
  assert.equal(trend.averageDisplay, '0.4');
  assert.equal(trend.favoriteType, 'Latte');
});

test('buildTrendData handles empty periods and zero days', () => {
  const { context } = loadApp();
  const emptyTrend = context.buildTrendData([], 7, new Date(2025, 0, 7));

  assert.equal(emptyTrend.totalCups, 0);
  assert.equal(emptyTrend.averageDisplay, '0.0');
  assert.equal(emptyTrend.favoriteType, '-');
  assert.equal(JSON.stringify(emptyTrend.trendDays.map((day) => day.total)), JSON.stringify([0, 0, 0, 0, 0, 0, 0]));
});

test('buildTrendData handles month and year boundaries without shifting local dates', () => {
  const { context } = loadApp();
  const endDate = new Date(2026, 0, 2);
  const trend = context.buildTrendData([
    { id: 1, type: 'Espresso', date: '2025-12-31' },
    { id: 2, type: 'Latte', date: '2026-01-01' },
    { id: 3, type: 'Americano', date: '2026-01-02' }
  ], 3, endDate);

  assert.equal(JSON.stringify(trend.trendDays.map((day) => day.dateKey)), JSON.stringify(['2025-12-31', '2026-01-01', '2026-01-02']));
  assert.equal(JSON.stringify(trend.trendDays.map((day) => day.total)), JSON.stringify([1, 1, 1]));
  assert.equal(trend.totalCups, 3);
});

test('CoffeeTracker normalizes stored dates and refreshes the trend view after reset', () => {
  const { context, document, storage } = loadApp();
  const todayKey = context.toLocalDateKey(new Date());
  storage.coffeeData = JSON.stringify([
    { id: 1, type: 'Latte', size: 'Medium', time: '08:30', notes: 'test', date: todayKey },
    { id: 2, type: 'Espresso', size: 'Small', time: '09:00', notes: '', date: '2025-01-01' }
  ]);

  const tracker = new context.CoffeeTracker();
  assert.equal(tracker.coffeeData[0].date, todayKey);

  tracker.resetToday();
  assert.equal(Number(document.getElementById('todayCount').textContent), 0);
  assert.equal(document.getElementById('trendStatus').textContent.includes('0 total cups'), true);
});
