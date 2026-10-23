const CoffeeUtils = {
    CAFFEINE_SOURCE: 'Estimated using typical USDA / National Coffee Association values for standard coffee serving sizes; actual caffeine varies by bean, roast, and brew method.',
    CAFFEINE_MAP: {
        'Espresso': { base: 63, multiplier: 1 },
        'Americano': { base: 150, multiplier: 1 },
        'Latte': { base: 150, multiplier: 1 },
        'Cappuccino': { base: 150, multiplier: 1 },
        'Macchiato': { base: 75, multiplier: 1 },
        'Mocha': { base: 95, multiplier: 1 },
        'French Press': { base: 107, multiplier: 1 },
        'Cold Brew': { base: 200, multiplier: 1 },
        'Drip Coffee': { base: 95, multiplier: 1 },
        'Other': { base: 95, multiplier: 1 }
    },
    SIZE_MULTIPLIER: {
        'Small': 0.75,
        'Medium': 1,
        'Large': 1.25,
        'Extra Large': 1.5
    },

    estimateCaffeine(type, size, decaf = false) {
        if (decaf) return 0;

        const coffee = this.CAFFEINE_MAP[type] || { base: 95, multiplier: 1 };
        const sizeMultiplier = this.SIZE_MULTIPLIER[size] || 1;

        return Math.round(coffee.base * coffee.multiplier * sizeMultiplier);
    },

    parseCaffeineAmount(value, options = {}) {
        const { type = 'Other', size = 'Medium', decaf = false } = options;

        if (decaf) return 0;

        const rawValue = value === undefined || value === null || value === ''
            ? this.estimateCaffeine(type, size)
            : Number(value);

        if (!Number.isFinite(rawValue) || rawValue < 0) {
            throw new Error('Caffeine amount must be a finite, non-negative number.');
        }

        return Number(rawValue);
    },

    normalizeCoffeeEntry(entry = {}) {
        const normalized = { ...entry };

        normalized.type = normalized.type || 'Other';
        normalized.size = normalized.size || 'Medium';
        normalized.time = normalized.time || '00:00';
        normalized.notes = normalized.notes || '';
        normalized.date = normalized.date || new Date().toDateString();
        normalized.decaf = Boolean(normalized.decaf);

        if (normalized.decaf) {
            normalized.caffeineMg = 0;
            return normalized;
        }

        if (normalized.caffeineMg === undefined || normalized.caffeineMg === null || normalized.caffeineMg === '') {
            normalized.caffeineMg = undefined;
            return normalized;
        }

        const parsedValue = Number(normalized.caffeineMg);
        if (!Number.isFinite(parsedValue) || parsedValue < 0) {
            normalized.caffeineMg = undefined;
            return normalized;
        }

        normalized.caffeineMg = parsedValue;
        return normalized;
    },

    isKnownCaffeineValue(value) {
        return typeof value === 'number' && Number.isFinite(value) && value >= 0;
    },

    getDailyCaffeineTotal(entries) {
        const coffeeEntries = Array.isArray(entries) ? entries : [];

        if (coffeeEntries.length === 0) {
            return 0;
        }

        if (coffeeEntries.some(entry => !this.isKnownCaffeineValue(entry.caffeineMg))) {
            return null;
        }

        return coffeeEntries.reduce((total, entry) => total + Number(entry.caffeineMg), 0);
    },

    formatCaffeineLabel(entry) {
        if (entry.decaf) {
            return 'Decaf • 0 mg';
        }

        if (this.isKnownCaffeineValue(entry.caffeineMg)) {
            return `${entry.caffeineMg} mg`;
        }

        return 'Unknown';
    }
};

class CoffeeTracker {
    constructor() {
        this.coffeeData = [];

        try {
            const savedData = JSON.parse(localStorage.getItem('coffeeData')) || [];
            this.coffeeData = this.normalizeCoffeeData(savedData);
        } catch (error) {
            this.coffeeData = [];
        }

        this.init();
    }

    normalizeCoffeeData(entries) {
        if (!Array.isArray(entries)) {
            return [];
        }

        return entries.map(entry => CoffeeUtils.normalizeCoffeeEntry(entry));
    }

    init() {
        this.setupEventListeners();
        this.updateDisplay();
        this.setCurrentTime();
        this.syncSuggestedCaffeine();
    }

    setupEventListeners() {
        document.getElementById('addCoffeeBtn').addEventListener('click', () => {
            this.showAddForm();
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetToday();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hideAddForm();
        });

        document.getElementById('coffeeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addCoffee();
        });

        const typeSelect = document.getElementById('coffeeType');
        const sizeSelect = document.getElementById('coffeeSize');
        const decafCheckbox = document.getElementById('coffeeDecaf');

        typeSelect.addEventListener('change', () => this.syncSuggestedCaffeine());
        sizeSelect.addEventListener('change', () => this.syncSuggestedCaffeine());
        decafCheckbox.addEventListener('change', () => this.syncSuggestedCaffeine());
    }

    showAddForm() {
        const addCoffeeForm = document.getElementById('addCoffeeForm');
        addCoffeeForm.style.display = 'block';
        addCoffeeForm.scrollIntoView({ behavior: 'smooth' });
        this.setCurrentTime();
        this.syncSuggestedCaffeine();
    }

    hideAddForm() {
        document.getElementById('addCoffeeForm').style.display = 'none';
        this.clearForm();
    }

    setCurrentTime() {
        const now = new Date();
        const timeString = now.toTimeString().slice(0, 5);
        document.getElementById('coffeeTime').value = timeString;
    }

    syncSuggestedCaffeine() {
        const type = document.getElementById('coffeeType').value;
        const size = document.getElementById('coffeeSize').value;
        const decaf = document.getElementById('coffeeDecaf').checked;
        const caffeineInput = document.getElementById('coffeeCaffeine');

        if (!type || !size) {
            caffeineInput.value = '';
            caffeineInput.disabled = false;
            return;
        }

        if (decaf) {
            caffeineInput.disabled = true;
            caffeineInput.value = '0';
            return;
        }

        caffeineInput.disabled = false;
        caffeineInput.value = CoffeeUtils.estimateCaffeine(type, size);
    }

    addCoffee() {
        const type = document.getElementById('coffeeType').value;
        const size = document.getElementById('coffeeSize').value;
        const time = document.getElementById('coffeeTime').value;
        const notes = document.getElementById('coffeeNotes').value.trim();
        const decaf = document.getElementById('coffeeDecaf').checked;
        const caffeineInput = document.getElementById('coffeeCaffeine');

        if (!type || !size || !time) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            const caffeineMg = CoffeeUtils.parseCaffeineAmount(caffeineInput.value, { type, size, decaf });
            const coffee = CoffeeUtils.normalizeCoffeeEntry({
                id: Date.now(),
                type,
                size,
                time,
                notes,
                date: new Date().toDateString(),
                decaf,
                caffeineMg
            });

            this.coffeeData.push(coffee);
            this.saveData();
            this.updateDisplay();
            this.hideAddForm();
            this.showNotification('Coffee added successfully! ☕');
        } catch (error) {
            alert(error.message);
        }
    }

    deleteCoffee(id) {
        if (confirm('Are you sure you want to delete this coffee entry?')) {
            this.coffeeData = this.coffeeData.filter(coffee => coffee.id !== id);
            this.saveData();
            this.updateDisplay();
            this.showNotification('Coffee entry deleted');
        }
    }

    resetToday() {
        if (confirm('Are you sure you want to reset today\'s coffee count?')) {
            const today = new Date().toDateString();
            this.coffeeData = this.coffeeData.filter(coffee => coffee.date !== today);
            this.saveData();
            this.updateDisplay();
            this.showNotification('Today\'s coffee count has been reset');
        }
    }

    getTodaysCoffee() {
        const today = new Date().toDateString();
        return this.coffeeData.filter(coffee => coffee.date === today);
    }

    getTodayCaffeineTotal() {
        return CoffeeUtils.getDailyCaffeineTotal(this.getTodaysCoffee());
    }

    updateDisplay() {
        this.updateTodayCount();
        this.updateCoffeeList();
        this.updateStatistics();
    }

    updateTodayCount() {
        const todaysCoffee = this.getTodaysCoffee();
        const todayCaffeineElement = document.getElementById('todayCaffeine');
        const totalCaffeine = this.getTodayCaffeineTotal();

        document.getElementById('todayCount').textContent = todaysCoffee.length;

        if (todaysCoffee.length === 0) {
            todayCaffeineElement.textContent = '0 mg';
            return;
        }

        if (totalCaffeine === null) {
            todayCaffeineElement.textContent = 'Unknown';
            todayCaffeineElement.title = 'Some entries are missing caffeine data';
            return;
        }

        todayCaffeineElement.textContent = `${totalCaffeine} mg`;
        todayCaffeineElement.title = 'Estimated caffeine for today';
    }

    updateCoffeeList() {
        const coffeeList = document.getElementById('coffeeList');
        const todaysCoffee = this.getTodaysCoffee();

        if (todaysCoffee.length === 0) {
            coffeeList.innerHTML = '<p class="empty-message">No coffee recorded today. Add your first cup!</p>';
            return;
        }

        todaysCoffee.sort((a, b) => {
            const timeA = new Date(`2000/01/01 ${a.time}`);
            const timeB = new Date(`2000/01/01 ${b.time}`);
            return timeB - timeA;
        });

        coffeeList.innerHTML = todaysCoffee.map(coffee => `
            <div class="coffee-item">
                <div class="coffee-meta">
                    <div class="coffee-details">
                        <div class="coffee-type">${coffee.type}</div>
                        <div class="coffee-size">${coffee.size}</div>
                        <div class="coffee-caffeine">${CoffeeUtils.formatCaffeineLabel(coffee)}</div>
                        ${coffee.notes ? `<div class="coffee-notes">"${coffee.notes}"</div>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="coffee-time">${this.formatTime(coffee.time)}</div>
                        <button class="delete-btn" onclick="tracker.deleteCoffee(${coffee.id})" title="Delete this entry">×</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateStatistics() {
        const totalCups = this.coffeeData.length;
        document.getElementById('totalCups').textContent = totalCups;

        if (totalCups === 0) {
            document.getElementById('avgPerDay').textContent = '0';
            document.getElementById('favoriteType').textContent = '-';
            return;
        }

        const dates = [...new Set(this.coffeeData.map(coffee => coffee.date))];
        const avgPerDay = (totalCups / dates.length).toFixed(1);
        document.getElementById('avgPerDay').textContent = avgPerDay;

        const typeCount = {};
        this.coffeeData.forEach(coffee => {
            typeCount[coffee.type] = (typeCount[coffee.type] || 0) + 1;
        });

        const favoriteType = Object.keys(typeCount).reduce((a, b) =>
            typeCount[a] > typeCount[b] ? a : b
        );
        document.getElementById('favoriteType').textContent = favoriteType;
    }

    formatTime(time24) {
        const [hours, minutes] = time24.split(':');
        const hour12 = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        return `${hour12}:${minutes} ${ampm}`;
    }

    clearForm() {
        document.getElementById('coffeeForm').reset();
        const caffeineInput = document.getElementById('coffeeCaffeine');
        caffeineInput.value = '';
        caffeineInput.disabled = false;
        document.getElementById('coffeeDecaf').checked = false;
    }

    saveData() {
        localStorage.setItem('coffeeData', JSON.stringify(this.coffeeData.map(entry => CoffeeUtils.normalizeCoffeeEntry(entry))));
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1000;
            font-family: 'Poppins', sans-serif;
            font-weight: 500;
            animation: slideInRight 0.3s ease;
        `;

        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    exportData() {
        const dataStr = JSON.stringify(this.coffeeData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'coffee-data.json';
        link.click();
        URL.revokeObjectURL(url);
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (Array.isArray(importedData)) {
                    this.coffeeData = this.normalizeCoffeeData(importedData);
                    this.saveData();
                    this.updateDisplay();
                    this.showNotification('Data imported successfully!');
                } else {
                    throw new Error('Invalid data format');
                }
            } catch (error) {
                alert('Error importing data. Please make sure the file is valid.');
            }
        };
        reader.readAsText(file);
    }
}

if (typeof document !== 'undefined') {
    let tracker;

    document.addEventListener('DOMContentLoaded', () => {
        tracker = new CoffeeTracker();

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                tracker.showAddForm();
            }

            if (e.key === 'Escape') {
                const form = document.getElementById('addCoffeeForm');
                if (form.style.display !== 'none') {
                    tracker.hideAddForm();
                }
            }
        });
    });
}

if (typeof module !== 'undefined') {
    module.exports = { CoffeeUtils, CoffeeTracker };
}
