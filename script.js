const STORAGE_KEYS = {
    coffeeData: 'coffeeData',
    coffeeGoal: 'coffeeGoal'
};

const SUPPORTED_BACKUP_VERSION = 1;

function normalizeCoffeeEntry(entry, index = 0) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error(`Entry at index ${index} must be an object.`);
    }

    const type = typeof entry.type === 'string' ? entry.type.trim() : '';
    const size = typeof entry.size === 'string' ? entry.size.trim() : '';
    const time = typeof entry.time === 'string' ? entry.time.trim() : '';
    const date = typeof entry.date === 'string' ? entry.date.trim() : '';
    const notes = typeof entry.notes === 'string' ? entry.notes : '';
    const id = Number(entry.id);

    if (!Number.isInteger(id) || id <= 0) {
        throw new Error(`Entry at index ${index} has an invalid "id".`);
    }

    if (!type) {
        throw new Error(`Entry at index ${index} is missing a valid "type".`);
    }

    if (!size) {
        throw new Error(`Entry at index ${index} is missing a valid "size".`);
    }

    if (!/^\d{2}:\d{2}$/.test(time)) {
        throw new Error(`Entry at index ${index} has an invalid "time" value. Use HH:MM.`);
    }

    if (!date) {
        throw new Error(`Entry at index ${index} is missing a valid "date".`);
    }

    return {
        id,
        type,
        size,
        time,
        notes,
        date
    };
}

const CoffeeBackup = {
    createPayload(entries = [], dailyGoal = 0) {
        const normalizedEntries = Array.isArray(entries) ? entries.map((entry, index) => normalizeCoffeeEntry(entry, index)) : [];
        const normalizedGoal = Number.isFinite(Number(dailyGoal)) && Number(dailyGoal) >= 0 ? Math.floor(Number(dailyGoal)) : 0;

        return {
            version: SUPPORTED_BACKUP_VERSION,
            exportedAt: new Date().toISOString(),
            entries: normalizedEntries,
            dailyGoal: normalizedGoal
        };
    },

    validatePayload(payload) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            throw new Error('Backup file must be a JSON object.');
        }

        if (!Object.prototype.hasOwnProperty.call(payload, 'version')) {
            throw new Error('Backup file is missing the "version" field.');
        }

        if (!Number.isInteger(payload.version) || payload.version !== SUPPORTED_BACKUP_VERSION) {
            throw new Error(`Unsupported backup version: ${payload.version}. Supported version: ${SUPPORTED_BACKUP_VERSION}.`);
        }

        if (!Object.prototype.hasOwnProperty.call(payload, 'entries') || !Array.isArray(payload.entries)) {
            throw new Error('Backup file is missing the "entries" array.');
        }

        if (!Object.prototype.hasOwnProperty.call(payload, 'dailyGoal') || !Number.isInteger(payload.dailyGoal) || payload.dailyGoal < 0) {
            throw new Error('Backup file has an invalid "dailyGoal" value.');
        }

        const entries = payload.entries.map((entry, index) => normalizeCoffeeEntry(entry, index));

        return {
            version: payload.version,
            exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : undefined,
            entries,
            dailyGoal: payload.dailyGoal
        };
    },

    parseJson(rawText) {
        try {
            const parsed = JSON.parse(rawText);
            return this.validatePayload(parsed);
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error('The file is not valid JSON.');
            }
            throw error;
        }
    }
};

class CoffeeTracker {
    constructor() {
        this.storageKeys = STORAGE_KEYS;
        this.supportedBackupVersion = SUPPORTED_BACKUP_VERSION;
        this.coffeeData = this.readStoredData();
        this.dailyGoal = this.readStoredGoal();

        if (typeof document !== 'undefined') {
            this.init();
        }
    }

    readStoredData() {
        if (typeof localStorage === 'undefined') {
            return [];
        }

        try {
            const storedValue = localStorage.getItem(this.storageKeys.coffeeData);
            if (!storedValue) {
                return [];
            }

            const parsed = JSON.parse(storedValue);
            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed.map((entry, index) => normalizeCoffeeEntry(entry, index));
        } catch (error) {
            return [];
        }
    }

    readStoredGoal() {
        if (typeof localStorage === 'undefined') {
            return 0;
        }

        const storedGoal = Number.parseInt(localStorage.getItem(this.storageKeys.coffeeGoal), 10);
        return Number.isInteger(storedGoal) && storedGoal >= 0 ? storedGoal : 0;
    }

    init() {
        this.setupEventListeners();
        this.updateDisplay();
        this.setCurrentTime();
    }

    setupEventListeners() {
        const addCoffeeBtn = document.getElementById('addCoffeeBtn');
        if (addCoffeeBtn) {
            addCoffeeBtn.addEventListener('click', () => {
                this.showAddForm();
            });
        }

        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetToday();
            });
        }

        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hideAddForm();
            });
        }

        const setGoalBtn = document.getElementById('setGoalBtn');
        if (setGoalBtn) {
            setGoalBtn.addEventListener('click', () => {
                this.setDailyGoalFromInput();
            });
        }

        const goalInput = document.getElementById('dailyGoalInput');
        if (goalInput) {
            goalInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    this.setDailyGoalFromInput();
                }
            });
        }

        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        const importBtn = document.getElementById('importBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                const importFileInput = document.getElementById('importFileInput');
                if (importFileInput) {
                    importFileInput.click();
                }
            });
        }

        const importFileInput = document.getElementById('importFileInput');
        if (importFileInput) {
            importFileInput.addEventListener('change', (event) => {
                const file = event.target.files && event.target.files[0];
                if (file) {
                    this.importDataFromFile(file);
                }
                event.target.value = '';
            });
        }

        const coffeeForm = document.getElementById('coffeeForm');
        if (coffeeForm) {
            coffeeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addCoffee();
            });
        }
    }

    showAddForm() {
        document.getElementById('addCoffeeForm').style.display = 'block';
        document.getElementById('addCoffeeForm').scrollIntoView({ behavior: 'smooth' });
        this.setCurrentTime();
    }

    hideAddForm() {
        document.getElementById('addCoffeeForm').style.display = 'none';
        this.clearForm();
    }

    setCurrentTime() {
        const coffeeTimeInput = document.getElementById('coffeeTime');
        if (!coffeeTimeInput) {
            return;
        }

        const now = new Date();
        const timeString = now.toTimeString().slice(0, 5);
        coffeeTimeInput.value = timeString;
    }

    setDailyGoalFromInput() {
        const rawValue = document.getElementById('dailyGoalInput').value;
        const parsedValue = Number.parseInt(rawValue, 10);

        if (!Number.isInteger(parsedValue) || parsedValue < 0) {
            alert('Please enter a non-negative whole number for your daily goal.');
            return;
        }

        this.dailyGoal = parsedValue;
        this.saveData();
        this.updateDisplay();
        this.showNotification('Daily goal updated');
    }

    addCoffee() {
        const type = document.getElementById('coffeeType').value;
        const size = document.getElementById('coffeeSize').value;
        const time = document.getElementById('coffeeTime').value;
        const notes = document.getElementById('coffeeNotes').value;

        if (!type || !size || !time) {
            alert('Please fill in all required fields');
            return;
        }

        const coffee = {
            id: Date.now(),
            type,
            size,
            time,
            notes,
            date: new Date().toDateString()
        };

        this.coffeeData.push(coffee);
        this.saveData();
        this.updateDisplay();
        this.hideAddForm();
        this.showNotification('Coffee added successfully! ☕');
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

    updateDisplay() {
        this.updateGoalDisplay();
        this.updateTodayCount();
        this.updateCoffeeList();
        this.updateStatistics();
    }

    updateGoalDisplay() {
        if (typeof document === 'undefined') {
            return;
        }

        const goalInput = document.getElementById('dailyGoalInput');
        if (goalInput) {
            goalInput.value = this.dailyGoal;
        }
    }

    updateTodayCount() {
        const todaysCoffee = this.getTodaysCoffee();
        const todayCount = document.getElementById('todayCount');
        if (todayCount) {
            todayCount.textContent = todaysCoffee.length;
        }
    }

    updateCoffeeList() {
        const coffeeList = document.getElementById('coffeeList');
        if (!coffeeList) {
            return;
        }

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
        const totalCupsElement = document.getElementById('totalCups');
        const avgPerDayElement = document.getElementById('avgPerDay');
        const favoriteTypeElement = document.getElementById('favoriteType');
        const goalStatElement = document.getElementById('goalStat');

        if (totalCupsElement) {
            totalCupsElement.textContent = totalCups;
        }

        if (goalStatElement) {
            goalStatElement.textContent = this.dailyGoal;
        }

        if (totalCups === 0) {
            if (avgPerDayElement) {
                avgPerDayElement.textContent = '0';
            }
            if (favoriteTypeElement) {
                favoriteTypeElement.textContent = '-';
            }
            return;
        }

        const dates = [...new Set(this.coffeeData.map(coffee => coffee.date))];
        const avgPerDay = (totalCups / dates.length).toFixed(1);
        if (avgPerDayElement) {
            avgPerDayElement.textContent = avgPerDay;
        }

        const typeCount = {};
        this.coffeeData.forEach(coffee => {
            typeCount[coffee.type] = (typeCount[coffee.type] || 0) + 1;
        });

        const favoriteType = Object.keys(typeCount).reduce((a, b) =>
            typeCount[a] > typeCount[b] ? a : b
        );

        if (favoriteTypeElement) {
            favoriteTypeElement.textContent = favoriteType;
        }
    }

    formatTime(time24) {
        const [hours, minutes] = time24.split(':');
        const hour12 = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        return `${hour12}:${minutes} ${ampm}`;
    }

    clearForm() {
        if (typeof document !== 'undefined') {
            document.getElementById('coffeeForm').reset();
        }
    }

    saveData() {
        if (typeof localStorage === 'undefined') {
            return;
        }

        localStorage.setItem(this.storageKeys.coffeeData, JSON.stringify(this.coffeeData));
        localStorage.setItem(this.storageKeys.coffeeGoal, String(this.dailyGoal));
    }

    exportData() {
        const payload = CoffeeBackup.createPayload(this.coffeeData, this.dailyGoal);
        const dataStr = JSON.stringify(payload, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `coffee-backup-v${payload.version}-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        this.showNotification('Backup downloaded successfully');
    }

    importDataFromFile(file) {
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsedData = CoffeeBackup.parseJson(event.target.result);
                const hasExistingHistory = this.coffeeData.length > 0 || this.dailyGoal > 0;

                if (hasExistingHistory) {
                    const message = `This backup contains ${parsedData.entries.length} entries and a daily goal of ${parsedData.dailyGoal}. Your current history will be replaced. Continue?`;
                    if (!confirm(message)) {
                        this.showNotification('Import cancelled');
                        return;
                    }
                }

                this.coffeeData = parsedData.entries.map((entry, index) => normalizeCoffeeEntry(entry, index));
                this.dailyGoal = parsedData.dailyGoal;
                this.saveData();
                this.updateDisplay();
                this.showNotification('Backup imported successfully!');
            } catch (error) {
                alert(`Import failed: ${error.message}`);
            }
        };

        reader.onerror = () => {
            alert('Import failed: the file could not be read.');
        };

        reader.readAsText(file);
    }

    showNotification(message) {
        if (typeof document === 'undefined') {
            return;
        }

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
}

let tracker;

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        tracker = new CoffeeTracker();

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                tracker.showAddForm();
            }

            if (e.key === 'Escape') {
                const form = document.getElementById('addCoffeeForm');
                if (form && form.style.display !== 'none') {
                    tracker.hideAddForm();
                }
            }
        });
    });
}

const CoffeeUtils = {
    estimateCaffeine(type, size) {
        const caffeineMap = {
            'Espresso': { base: 63, multiplier: 1 },
            'Americano': { base: 150, multiplier: 1 },
            'Latte': { base: 150, multiplier: 1 },
            'Cappuccino': { base: 150, multiplier: 1 },
            'Macchiato': { base: 75, multiplier: 1 },
            'Mocha': { base: 95, multiplier: 1 },
            'French Press': { base: 107, multiplier: 1 },
            'Cold Brew': { base: 200, multiplier: 1 },
            'Drip Coffee': { base: 95, multiplier: 1 }
        };

        const sizeMultiplier = {
            'Small': 0.75,
            'Medium': 1,
            'Large': 1.25,
            'Extra Large': 1.5
        };

        const coffee = caffeineMap[type] || { base: 95, multiplier: 1 };
        const sizeM = sizeMultiplier[size] || 1;

        return Math.round(coffee.base * coffee.multiplier * sizeM);
    },

    getCoffeeEmoji(type) {
        const emojiMap = {
            'Espresso': '☕',
            'Americano': '☕',
            'Latte': '🥛',
            'Cappuccino': '☕',
            'Macchiato': '☕',
            'Mocha': '🍫',
            'French Press': '☕',
            'Cold Brew': '🧊',
            'Drip Coffee': '☕'
        };
        return emojiMap[type] || '☕';
    }
};

if (typeof module !== 'undefined') {
    module.exports = {
        CoffeeBackup,
        CoffeeTracker,
        CoffeeUtils,
        STORAGE_KEYS,
        SUPPORTED_BACKUP_VERSION
    };
}
