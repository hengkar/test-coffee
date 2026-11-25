class CoffeeTracker {
    constructor() {
        this.coffeeData = JSON.parse(localStorage.getItem('coffeeData')) || [];
        const savedGoal = Number(localStorage.getItem('coffeeDailyGoal'));
        this.dailyGoal = Number.isInteger(savedGoal) && savedGoal >= 1 && savedGoal <= 100 ? savedGoal : 3;
        this.editingId = null;
        this.selectedDate = this.getLocalDate();
        this.init();
    }

    init() {
        document.getElementById('historyDate').value = this.selectedDate;
        document.getElementById('dailyGoal').value = this.dailyGoal;
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

        document.getElementById('goalForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const goal = Number(document.getElementById('dailyGoal').value);
            if (!Number.isInteger(goal) || goal < 1 || goal > 100) return;
            this.dailyGoal = goal;
            localStorage.setItem('coffeeDailyGoal', goal);
            this.updateTodayCount();
            this.showNotification('Daily goal saved');
        });
    }

    getLocalDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    showAddForm() {
        const form = document.getElementById('addCoffeeForm');
        form.inert = false;
        form.classList.add('is-open');
        document.getElementById('addCoffeeBtn').setAttribute('aria-expanded', 'true');
        form.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        this.setCurrentTime();
        document.getElementById('coffeeType').focus({ preventScroll: true });
    }

    hideAddForm() {
        const form = document.getElementById('addCoffeeForm');
        if (form.contains(document.activeElement)) {
            document.getElementById('addCoffeeBtn').focus();
        }
        form.inert = true;
        form.classList.remove('is-open');
        document.getElementById('addCoffeeBtn').setAttribute('aria-expanded', 'false');
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
            date: new Date().toDateString()
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
        this.updateTodayCount();
        this.updateCoffeeList();
        this.updateStatistics();
    }

    updateTodayCount() {
        const todaysCoffee = this.getTodaysCoffee();
        document.getElementById('todayCount').textContent = todaysCoffee.length;
        const progress = document.getElementById('goalProgress');
        progress.max = this.dailyGoal;
        progress.value = Math.min(todaysCoffee.length, this.dailyGoal);
        document.getElementById('goalStatus').textContent = `${todaysCoffee.length} of ${this.dailyGoal} cups today`;
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
                        <button class="delete-btn" onclick="tracker.deleteCoffee(${coffee.id})" title="Delete this entry" aria-label="Delete this entry">×</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateStatistics() {
        const totalCups = this.coffeeData.length;
        document.getElementById('totalCups').textContent = totalCups;

        // Calculate average per day
        if (totalCups === 0) {
            document.getElementById('avgPerDay').textContent = '0';
            document.getElementById('favoriteType').textContent = '-';
            return;
        }

        const dates = [...new Set(this.coffeeData.map(coffee => coffee.date))];
        const avgPerDay = (totalCups / dates.length).toFixed(1);
        document.getElementById('avgPerDay').textContent = avgPerDay;

        // Find favorite coffee type
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
    }

    saveData() {
        localStorage.setItem('coffeeData', JSON.stringify(this.coffeeData));
    }

    showNotification(message) {
        document.querySelectorAll('.notification').forEach(item => item.remove());
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.setAttribute('role', 'status');
        notification.textContent = message;
        document.body.appendChild(notification);

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.classList.add('is-leaving');
            setTimeout(() => {
                notification.remove();
            }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300);
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
            if (form.classList.contains('is-open')) {
                tracker.hideAddForm();
            }
        }
    });
});

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