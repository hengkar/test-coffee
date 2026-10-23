const test = require('node:test');
const assert = require('node:assert/strict');
const { CoffeeUtils } = require('../script.js');

test('estimateCaffeine applies size multipliers to standard drinks', () => {
    assert.equal(CoffeeUtils.estimateCaffeine('Espresso', 'Small'), 47);
    assert.equal(CoffeeUtils.estimateCaffeine('Americano', 'Medium'), 150);
    assert.equal(CoffeeUtils.estimateCaffeine('Cold Brew', 'Large'), 250);
});

test('parseCaffeineAmount accepts overrides and decaf entries', () => {
    assert.equal(CoffeeUtils.parseCaffeineAmount('180', { type: 'Latte', size: 'Medium' }), 180);
    assert.equal(CoffeeUtils.parseCaffeineAmount('', { type: 'Espresso', size: 'Large', decaf: true }), 0);
    assert.equal(CoffeeUtils.parseCaffeineAmount('120', { type: 'Mocha', size: 'Medium', decaf: true }), 0);
});

test('invalid caffeine values are rejected', () => {
    assert.throws(() => CoffeeUtils.parseCaffeineAmount('-10', { type: 'Espresso', size: 'Medium' }), /finite, non-negative/);
    assert.throws(() => CoffeeUtils.parseCaffeineAmount('NaN', { type: 'Americano', size: 'Large' }), /finite, non-negative/);
    assert.throws(() => CoffeeUtils.parseCaffeineAmount('Infinity', { type: 'Cold Brew', size: 'Medium' }), /finite, non-negative/);
});

test('legacy entries remain unknown in daily totals', () => {
    const entries = [
        { date: new Date().toDateString(), type: 'Espresso', size: 'Small', time: '08:00', caffeineMg: undefined },
        { date: new Date().toDateString(), type: 'Americano', size: 'Medium', time: '09:00', caffeineMg: 150 }
    ];

    const normalized = entries.map(entry => CoffeeUtils.normalizeCoffeeEntry(entry));
    assert.equal(normalized[0].caffeineMg, undefined);
    assert.equal(CoffeeUtils.getDailyCaffeineTotal(normalized), null);
    assert.equal(CoffeeUtils.formatCaffeineLabel(normalized[0]), 'Unknown');
});
