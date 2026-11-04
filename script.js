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

        // History date change
        document.getElementById('historyDate').addEventListener('change', (e) => {
            this.selectedDate = e.target.value || this.getLocalDate();
            this.updateCoffeeList();
        });

        // Today history shortcut
        document.getElementById('todayHistoryBtn').addEventListener('click', () => {
            this.selectedDate = this.getLocalDate();
            document.getElementById('historyDate').value = this.selectedDate;
            this.updateCoffeeList();
        });

        // Daily goal form
        document.getElementById('goalForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveDailyGoal();
        });

        // Coffee form submission
        document.getElementById('coffeeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addCoffee();
        });
    }

    showAddForm() {
        document.getElementById('addCoffeeForm').style.display = 'block';
        document.getElementById('addCoffeeForm').scrollIntoView({ behavior: 'smooth' });
        if (this.editingId === null) {
            this.setCurrentTime();
        }
    }

    hideAddForm() {
        document.getElementById('addCoffeeForm').style.display = 'none';
        this.clearForm();
        this.editingId = null;
        this.setFormModeAdding();
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

        const isEditing = this.editingId !== null;
        if (isEditing) {
            const coffeeIndex = this.coffeeData.findIndex(coffee => coffee.id === this.editingId);
            if (coffeeIndex === -1) {
                this.editingId = null;
                this.showNotification('Entry no longer exists');
                return;
            }

            const currentCoffee = this.coffeeData[coffeeIndex];
            this.coffeeData[coffeeIndex] = {
                ...currentCoffee,
                type,
                size,
                time,
                notes
            };
        } else {
            const coffee = {
                id: Date.now(),
                type,
                size,
                time,
                notes,
                date: new Date().toDateString()
            };

            this.coffeeData.push(coffee);
        }

        this.saveData();
        this.updateDisplay();
        this.hideAddForm();
        
        // Show success message
        this.showNotification(isEditing ? 'Coffee updated successfully! ☕' : 'Coffee added successfully! ☕');
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

    getCoffeeForSelectedDate() {
        return this.coffeeData.filter(coffee => this.normalizeStoredDate(coffee.date) === this.selectedDate);
    }

    updateDisplay() {
        this.updateTodayCount();
        this.updateGoalStatus();
        this.updateCoffeeList();
        this.updateStatistics();
    }

    updateTodayCount() {
        const todaysCoffee = this.getTodaysCoffee();
        document.getElementById('todayCount').textContent = todaysCoffee.length;
    }

    updateCoffeeList() {
        const coffeeList = document.getElementById('coffeeList');
        const historyHeading = document.getElementById('historyHeading');
        const selectedDateCoffee = this.getCoffeeForSelectedDate();
        const isTodaySelected = this.selectedDate === this.getLocalDate();
        historyHeading.textContent = isTodaySelected
            ? 'Today\'s Coffee History'
            : `Coffee History for ${this.formatDateHeading(this.selectedDate)}`;

        if (selectedDateCoffee.length === 0) {
            coffeeList.innerHTML = isTodaySelected
                ? '<p class="empty-message">No coffee recorded today. Add your first cup!</p>'
                : '<p class="empty-message">No coffee recorded for this date.</p>';
            return;
        }

        // Sort by time (latest first)
        selectedDateCoffee.sort((a, b) => {
            const timeA = new Date(`2000/01/01 ${a.time}`);
            const timeB = new Date(`2000/01/01 ${b.time}`);
            return timeB - timeA;
        });

        coffeeList.innerHTML = selectedDateCoffee.map(coffee => `
            <div class="coffee-item">
                <div class="coffee-meta">
                    <div class="coffee-details">
                        <div class="coffee-type">${coffee.type}</div>
                        <div class="coffee-size">${coffee.size}</div>
                        ${coffee.notes ? `<div class="coffee-notes">"${coffee.notes}"</div>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="coffee-time">${this.formatTime(coffee.time)}</div>
                        <button class="edit-btn" onclick="tracker.editCoffee(${coffee.id})" aria-label="Edit ${coffee.type} at ${this.formatTime(coffee.time)}">Edit</button>
                        <button class="delete-btn" onclick="tracker.deleteCoffee(${coffee.id})" title="Delete this entry">×</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    editCoffee(id) {
        const coffee = this.coffeeData.find(entry => entry.id === id);
        if (!coffee) {
            return;
        }

        this.editingId = id;
        document.getElementById('coffeeType').value = coffee.type;
        document.getElementById('coffeeSize').value = coffee.size;
        document.getElementById('coffeeTime').value = coffee.time;
        document.getElementById('coffeeNotes').value = coffee.notes || '';
        this.setFormModeEditing(coffee.date);
        this.showAddForm();
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

    setFormModeAdding() {
        document.getElementById('coffeeFormHeading').textContent = 'Add a Coffee';
        document.getElementById('saveCoffeeBtn').textContent = 'Add Coffee';
        const editingDate = document.getElementById('editingDate');
        editingDate.hidden = true;
        editingDate.textContent = '';
    }

    setFormModeEditing(dateString) {
        document.getElementById('coffeeFormHeading').textContent = 'Edit Coffee';
        document.getElementById('saveCoffeeBtn').textContent = 'Save Changes';
        const editingDate = document.getElementById('editingDate');
        editingDate.hidden = false;
        editingDate.textContent = `Editing entry from ${this.formatDateHeading(this.normalizeStoredDate(dateString))}`;
    }

    saveDailyGoal() {
        const goalInput = document.getElementById('dailyGoal');
        const nextGoal = Number(goalInput.value);
        if (!Number.isInteger(nextGoal) || nextGoal < 1 || nextGoal > 100) {
            alert('Please enter a goal between 1 and 100.');
            goalInput.value = this.dailyGoal;
            return;
        }

        this.dailyGoal = nextGoal;
        localStorage.setItem('coffeeDailyGoal', String(nextGoal));
        this.updateGoalStatus();
        this.showNotification('Daily goal updated');
    }

    updateGoalStatus() {
        const todaysCoffee = this.getTodaysCoffee().length;
        const goalProgress = document.getElementById('goalProgress');
        const goalStatus = document.getElementById('goalStatus');
        goalProgress.max = this.dailyGoal;
        goalProgress.value = todaysCoffee;

        if (todaysCoffee >= this.dailyGoal) {
            goalStatus.textContent = `Goal reached! ${todaysCoffee}/${this.dailyGoal} cups today.`;
        } else {
            goalStatus.textContent = `${todaysCoffee}/${this.dailyGoal} cups today`;
        }
    }

    normalizeStoredDate(dateValue) {
        if (!dateValue) {
            return '';
        }

        if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            return dateValue;
        }

        const parsedDate = new Date(dateValue);
        if (Number.isNaN(parsedDate.getTime())) {
            return '';
        }

        return this.getLocalDate(parsedDate);
    }

    getLocalDate(date = new Date()) {
        const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        return offsetDate.toISOString().slice(0, 10);
    }

    formatDateHeading(dateString) {
        if (!dateString) {
            return 'Unknown date';
        }

        const parsedDate = new Date(`${dateString}T00:00:00`);
        return Number.isNaN(parsedDate.getTime())
            ? dateString
            : parsedDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CoffeeTracker };
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