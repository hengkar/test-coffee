function toLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseLocalDateKey(dateValue) {
    if (!dateValue) {
        return null;
    }

    if (typeof dateValue === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            return dateValue;
        }

        const parsed = new Date(dateValue);
        if (!Number.isNaN(parsed.getTime())) {
            return toLocalDateKey(parsed);
        }
    }

    if (dateValue instanceof Date) {
        return toLocalDateKey(dateValue);
    }

    return null;
}

function formatTrendDate(dateKey) {
    if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return '';
    }

    const [year, month, day] = dateKey.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    return localDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function buildTrendData(records, days, endDate = new Date()) {
    const safeDays = Number.isInteger(days) && days > 0 ? days : 0;
    const anchorDate = endDate instanceof Date && !Number.isNaN(endDate.getTime()) ? endDate : new Date();
    const normalizedEndDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());

    const trendDays = [];
    for (let offset = safeDays - 1; offset >= 0; offset--) {
        const day = new Date(normalizedEndDate);
        day.setDate(normalizedEndDate.getDate() - offset);
        trendDays.push({
            dateKey: toLocalDateKey(day),
            label: formatTrendDate(toLocalDateKey(day)),
            total: 0
        });
    }

    const totalsByDate = Object.create(null);
    trendDays.forEach(day => {
        totalsByDate[day.dateKey] = 0;
    });

    const validRecords = Array.isArray(records) ? records : [];
    const typeCounts = {};

    validRecords.forEach(record => {
        const recordDate = parseLocalDateKey(record && record.date);
        if (!recordDate || !Object.prototype.hasOwnProperty.call(totalsByDate, recordDate)) {
            return;
        }

        totalsByDate[recordDate] += 1;

        if (record && record.type) {
            typeCounts[record.type] = (typeCounts[record.type] || 0) + 1;
        }
    });

    trendDays.forEach(day => {
        day.total = totalsByDate[day.dateKey] || 0;
    });

    const totalCups = trendDays.reduce((sum, day) => sum + day.total, 0);
    const averageCups = safeDays === 0 ? 0 : totalCups / safeDays;
    const favoriteType = Object.keys(typeCounts).length === 0
        ? '-'
        : Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];

    return {
        days: safeDays,
        trendDays,
        totalCups,
        averageCups,
        averageDisplay: averageCups.toFixed(1),
        favoriteType,
        hasData: totalCups > 0
    };
}

class CoffeeTracker {
    constructor() {
        const storedData = JSON.parse(localStorage.getItem('coffeeData')) || [];
        this.coffeeData = Array.isArray(storedData) ? storedData.map(record => {
            const normalizedDate = parseLocalDateKey(record && record.date);
            return {
                ...record,
                date: normalizedDate || (record && record.date) || toLocalDateKey(new Date())
            };
        }) : [];
        this.trendWindow = 7;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateDisplay();
        this.setCurrentTime();
    }

    setupEventListeners() {
        // Add coffee button
        document.getElementById('addCoffeeBtn').addEventListener('click', () => {
            this.showAddForm();
        });

        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetToday();
        });

        // Cancel button
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hideAddForm();
        });

        // Coffee form submission
        document.getElementById('coffeeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addCoffee();
        });

        document.querySelectorAll('.trend-btn').forEach(button => {
            button.addEventListener('click', () => {
                this.trendWindow = Number(button.dataset.range);
                this.updateDisplay();
            });
        });
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
        const now = new Date();
        const timeString = now.toTimeString().slice(0, 5);
        document.getElementById('coffeeTime').value = timeString;
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
            date: toLocalDateKey(new Date())
        };

        this.coffeeData.push(coffee);
        this.saveData();
        this.updateDisplay();
        this.hideAddForm();

        // Show success message
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
            const today = toLocalDateKey(new Date());
            this.coffeeData = this.coffeeData.filter(coffee => parseLocalDateKey(coffee.date) !== today);
            this.saveData();
            this.updateDisplay();
            this.showNotification('Today\'s coffee count has been reset');
        }
    }

    getTodaysCoffee() {
        const today = toLocalDateKey(new Date());
        return this.coffeeData.filter(coffee => parseLocalDateKey(coffee.date) === today);
    }

    updateDisplay() {
        this.updateTodayCount();
        this.updateCoffeeList();
        this.updateStatistics();
        this.updateTrendView();
    }

    updateTodayCount() {
        const todaysCoffee = this.getTodaysCoffee();
        document.getElementById('todayCount').textContent = todaysCoffee.length;
    }

    updateCoffeeList() {
        const coffeeList = document.getElementById('coffeeList');
        const todaysCoffee = this.getTodaysCoffee();

        if (todaysCoffee.length === 0) {
            coffeeList.innerHTML = '<p class="empty-message">No coffee recorded today. Add your first cup!</p>';
            return;
        }

        // Sort by time (latest first)
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
        document.getElementById('totalCups').textContent = totalCups;

        if (totalCups === 0) {
            document.getElementById('avgPerDay').textContent = '0';
            document.getElementById('favoriteType').textContent = '-';
            return;
        }

        const dates = [...new Set(this.coffeeData.map(coffee => parseLocalDateKey(coffee.date)).filter(Boolean))];
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

    updateTrendView() {
        const range = this.trendWindow || 7;
        const trendData = buildTrendData(this.coffeeData, range, new Date());
        const trendTable = document.getElementById('trendTable');
        const trendStatus = document.getElementById('trendStatus');
        const trendSummary = document.getElementById('trendSummary');
        const trendChart = document.getElementById('trendChart');

        document.querySelectorAll('.trend-btn').forEach(button => {
            button.classList.toggle('active', Number(button.dataset.range) === range);
            button.setAttribute('aria-pressed', String(Number(button.dataset.range) === range));
        });

        const totalSummary = `${trendData.totalCups} cups`;
        const avgSummary = `${trendData.averageDisplay} avg/day`;
        const favoriteSummary = trendData.favoriteType === '-' ? 'No coffee yet' : trendData.favoriteType;
        trendSummary.innerHTML = `
            <div class="trend-metric"><strong>${totalSummary}</strong><span>Total</span></div>
            <div class="trend-metric"><strong>${avgSummary}</strong><span>Average</span></div>
            <div class="trend-metric"><strong>${favoriteSummary}</strong><span>Most common</span></div>
        `;

        if (trendData.trendDays.length === 0) {
            trendChart.innerHTML = '<p class="empty-message">No trend data available for this period.</p>';
            trendTable.innerHTML = '<tr><td colspan="3">No coffee recorded in this period.</td></tr>';
            trendStatus.textContent = 'No data for this period';
            return;
        }

        const dayHeight = Math.max(20, 100 / Math.max(...trendData.trendDays.map(day => day.total || 1), 1));
        const bars = trendData.trendDays.map((day) => {
            const height = day.total === 0 ? 8 : Math.max(18, day.total * dayHeight);
            return `
                <div class="trend-bar-wrap" title="${day.label}: ${day.total} cups">
                    <div class="trend-bar" style="height:${height}px;" aria-label="${day.label}: ${day.total} cups"></div>
                    <span class="trend-bar-value">${day.total}</span>
                    <span class="trend-bar-label">${day.label.split(' ')[0]}</span>
                </div>
            `;
        }).join('');

        trendChart.innerHTML = `<div class="trend-bars">${bars}</div>`;
        trendTable.innerHTML = trendData.trendDays.map(day => `
            <tr>
                <th scope="row">${day.label}</th>
                <td>${day.total}</td>
            </tr>
        `).join('');
        trendStatus.textContent = `${trendData.totalCups} total cups in the last ${range} days`;
    }

    formatTime(time24) {
        const [hours, minutes] = time24.split(':');
        const hour12 = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        return `${hour12}:${minutes} ${ampm}`;
    }

    clearForm() {
        document.getElementById('coffeeForm').reset();
    }

    saveData() {
        localStorage.setItem('coffeeData', JSON.stringify(this.coffeeData));
    }

    showNotification(message) {
        // Create a simple notification
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
        
        // Add CSS animation
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

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Export data function
    exportData() {
        const dataStr = JSON.stringify(this.coffeeData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'coffee-data.json';
        link.click();
        URL.revokeObjectURL(url);
    }

    // Import data function
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (Array.isArray(importedData)) {
                    this.coffeeData = importedData;
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

// Initialize the coffee tracker when the page loads
let tracker;

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        tracker = new CoffeeTracker();

        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter to add coffee quickly
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                tracker.showAddForm();
            }

            // Escape to close form
            if (e.key === 'Escape') {
                const form = document.getElementById('addCoffeeForm');
                if (form.style.display !== 'none') {
                    tracker.hideAddForm();
                }
            }
        });
    });
}

// Expose helpers for tests and future enhancements
if (typeof globalThis !== 'undefined') {
    globalThis.toLocalDateKey = toLocalDateKey;
    globalThis.parseLocalDateKey = parseLocalDateKey;
    globalThis.buildTrendData = buildTrendData;
    globalThis.CoffeeTracker = CoffeeTracker;
}

if (typeof globalThis !== 'undefined' && typeof document !== 'undefined' && globalThis !== document) {
    globalThis.CoffeeTracker = CoffeeTracker;
    globalThis.toLocalDateKey = toLocalDateKey;
    globalThis.parseLocalDateKey = parseLocalDateKey;
    globalThis.buildTrendData = buildTrendData;
}

// Add some utility functions for potential future enhancements
const CoffeeUtils = {
    // Calculate caffeine content based on coffee type and size
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

    // Get coffee emoji based on type
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