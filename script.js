class TaskFlowApp {
    constructor() {
        this.tasks = JSON.parse(localStorage.getItem('taskflow-tasks')) || [];
        this.categories = JSON.parse(localStorage.getItem('taskflow-categories')) || [
            { id: 'work', name: 'Work', color: '#3B82F6' },
            { id: 'personal', name: 'Personal', color: '#14B8A6' },
            { id: 'shopping', name: 'Shopping', color: '#F97316' }
        ];
        this.currentView = 'list';
        this.currentTask = null;
        this.pomodoroTimer = null;
        this.pomodoroTime = 25 * 60; // 25 minutes
        this.pomodoroRunning = false;
        this.currentFilter = 'all';
        this.currentSort = 'created';
        this.searchQuery = '';
        
        this.init();
    }

    init() {
        this.initParticles();
        this.bindEvents();
        this.updateStats();
        this.renderTasks();
        this.renderKanban();
        this.renderCalendar();
        this.renderAnalytics();
        this.loadTheme();
        this.updateTaskCounts();
    }

    initParticles() {
        const particlesContainer = document.getElementById('particles');
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.width = Math.random() * 4 + 2 + 'px';
            particle.style.height = particle.style.width;
            particle.style.animationDelay = Math.random() * 6 + 's';
            particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
            particlesContainer.appendChild(particle);
        }
    }

    bindEvents() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => this.switchView(e.target.closest('.nav-item').dataset.view));
        });

        // Add task
        document.getElementById('addTaskBtn').addEventListener('click', () => this.openTaskModal());
        document.getElementById('fabBtn').addEventListener('click', () => this.openTaskModal());

        // Modal
        document.getElementById('modalClose').addEventListener('click', () => this.closeTaskModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeTaskModal());
        document.getElementById('taskForm').addEventListener('submit', (e) => this.handleTaskSubmit(e));

        // Search and filters
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderTasks();
        });

        document.getElementById('filterSelect').addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            this.renderTasks();
        });

        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.renderTasks();
        });

        // Pomodoro
        document.getElementById('pomodoroPlay').addEventListener('click', () => this.togglePomodoro());
        document.getElementById('pomodoroReset').addEventListener('click', () => this.resetPomodoro());

        // Calendar navigation
        document.getElementById('prevMonth').addEventListener('click', () => this.navigateMonth(-1));
        document.getElementById('nextMonth').addEventListener('click', () => this.navigateMonth(1));

        // Close modal on overlay click
        document.getElementById('taskModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeTaskModal();
        });
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    saveTasks() {
        localStorage.setItem('taskflow-tasks', JSON.stringify(this.tasks));
        this.updateStats();
        this.updateTaskCounts();
    }

    updateStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(task => task.completed).length;
        const pending = total - completed;

        document.getElementById('totalTasks').textContent = total;
        document.getElementById('completedTasks').textContent = completed;
        document.getElementById('pendingTasks').textContent = pending;
        document.getElementById('taskCount').textContent = total;
    }

    updateTaskCounts() {
        // Update kanban column counts
        const pendingCount = this.tasks.filter(task => !task.completed && task.status !== 'in-progress').length;
        const inProgressCount = this.tasks.filter(task => task.status === 'in-progress').length;
        const completedCount = this.tasks.filter(task => task.completed).length;

        const kanbanColumns = document.querySelectorAll('.kanban-column');
        kanbanColumns[0].querySelector('.task-count').textContent = pendingCount;
        kanbanColumns[1].querySelector('.task-count').textContent = inProgressCount;
        kanbanColumns[2].querySelector('.task-count').textContent = completedCount;
    }

    getFilteredTasks() {
        let filtered = [...this.tasks];

        // Apply search filter
        if (this.searchQuery) {
            filtered = filtered.filter(task => 
                task.title.toLowerCase().includes(this.searchQuery) ||
                task.description.toLowerCase().includes(this.searchQuery) ||
                task.tags.some(tag => tag.toLowerCase().includes(this.searchQuery))
            );
        }

        // Apply status filter
        switch (this.currentFilter) {
            case 'pending':
                filtered = filtered.filter(task => !task.completed);
                break;
            case 'completed':
                filtered = filtered.filter(task => task.completed);
                break;
            case 'overdue':
                const now = new Date();
                filtered = filtered.filter(task => {
                    if (!task.dueDate || task.completed) return false;
                    return new Date(task.dueDate) < now;
                });
                break;
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (this.currentSort) {
                case 'priority':
                    const priorities = { urgent: 4, high: 3, medium: 2, low: 1 };
                    return priorities[b.priority] - priorities[a.priority];
                case 'dueDate':
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate) - new Date(b.dueDate);
                case 'alphabetical':
                    return a.title.localeCompare(b.title);
                default: // created
                    return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });

        return filtered;
    }

    renderTasks() {
        const container = document.getElementById('tasksContainer');
        const tasks = this.getFilteredTasks();

        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <path d="M12 8V16M8 12H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <h3>No tasks found</h3>
                    <p>Get started by creating your first task!</p>
                    <button class="btn btn-primary" onclick="app.openTaskModal()">Add Task</button>
                </div>
            `;
            return;
        }

        container.innerHTML = tasks.map(task => this.createTaskHTML(task)).join('');
        this.bindTaskEvents();
    }

    createTaskHTML(task) {
        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;
        const dueDateFormatted = task.dueDate ? this.formatDate(new Date(task.dueDate)) : '';
        
        return `
            <div class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
                <div class="task-header">
                    <div class="task-checkbox ${task.completed ? 'checked' : ''}" data-task-id="${task.id}">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <polyline points="20,6 9,17 4,12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <div class="task-content">
                        <h3 class="task-title">${task.title}</h3>
                        ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
                        <div class="task-meta">
                            <span class="task-priority ${task.priority}">${task.priority}</span>
                            <span class="task-category">${task.category}</span>
                            ${dueDateFormatted ? `<span class="task-due-date ${isOverdue ? 'overdue' : ''}">
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
                                    <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2"/>
                                    <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2"/>
                                    <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"/>
                                </svg>
                                ${dueDateFormatted}
                            </span>` : ''}
                            ${task.tags.length > 0 ? `
                                <div class="task-tags">
                                    ${task.tags.map(tag => `<span class="task-tag">${tag}</span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="task-action" onclick="app.editTask('${task.id}')">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2"/>
                            <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                    <button class="task-action" onclick="app.deleteTask('${task.id}')">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="2"/>
                            <path d="M19,6V20a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6M8,6V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    bindTaskEvents() {
        document.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleTaskComplete(checkbox.dataset.taskId);
            });
        });
    }

    toggleTaskComplete(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            this.saveTasks();
            this.renderTasks();
            this.renderKanban();
            this.renderAnalytics();
            
            this.showToast(
                task.completed ? 'Task completed! 🎉' : 'Task marked as pending',
                task.completed ? 'success' : 'info'
            );
        }
    }

    openTaskModal(taskId = null) {
        this.currentTask = taskId;
        const modal = document.getElementById('taskModal');
        const form = document.getElementById('taskForm');
        const title = document.getElementById('modalTitle');
        
        if (taskId) {
            const task = this.tasks.find(t => t.id === taskId);
            title.textContent = 'Edit Task';
            this.populateForm(task);
        } else {
            title.textContent = 'Add New Task';
            form.reset();
        }
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeTaskModal() {
        const modal = document.getElementById('taskModal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
        this.currentTask = null;
    }

    populateForm(task) {
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskCategory').value = task.category;
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskDueDate').value = task.dueDate?.split('T')[0] || '';
        document.getElementById('taskDueTime').value = task.dueTime || '';
        document.getElementById('taskTags').value = task.tags.join(', ');
    }

    handleTaskSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const taskData = {
            title: document.getElementById('taskTitle').value.trim(),
            description: document.getElementById('taskDescription').value.trim(),
            category: document.getElementById('taskCategory').value,
            priority: document.getElementById('taskPriority').value,
            dueDate: document.getElementById('taskDueDate').value || null,
            dueTime: document.getElementById('taskDueTime').value || null,
            tags: document.getElementById('taskTags').value
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0)
        };

        if (!taskData.title) {
            this.showToast('Task title is required', 'error');
            return;
        }

        if (this.currentTask) {
            // Edit existing task
            const task = this.tasks.find(t => t.id === this.currentTask);
            Object.assign(task, taskData, { updatedAt: new Date().toISOString() });
            this.showToast('Task updated successfully!', 'success');
        } else {
            // Create new task
            const newTask = {
                id: this.generateId(),
                ...taskData,
                completed: false,
                status: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                completedAt: null
            };
            this.tasks.push(newTask);
            this.showToast('Task created successfully!', 'success');
        }

        this.saveTasks();
        this.renderTasks();
        this.renderKanban();
        this.renderCalendar();
        this.renderAnalytics();
        this.closeTaskModal();
    }

    editTask(taskId) {
        this.openTaskModal(taskId);
    }

    deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.saveTasks();
            this.renderTasks();
            this.renderKanban();
            this.renderCalendar();
            this.renderAnalytics();
            this.showToast('Task deleted successfully!', 'success');
        }
    }

    switchView(view) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-view="${view}"]`).classList.add('active');

        // Update view
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${view}View`).classList.add('active');
        
        this.currentView = view;
        
        // Update title
        const titles = {
            list: 'My Tasks',
            kanban: 'Task Board',
            calendar: 'Calendar View',
            analytics: 'Analytics Dashboard'
        };
        document.getElementById('viewTitle').textContent = titles[view];

        // Refresh view data
        switch (view) {
            case 'kanban':
                this.renderKanban();
                break;
            case 'calendar':
                this.renderCalendar();
                break;
            case 'analytics':
                this.renderAnalytics();
                break;
        }
    }

    renderKanban() {
        const pendingContainer = document.getElementById('pendingTasks');
        const inProgressContainer = document.getElementById('inProgressTasks');
        const completedContainer = document.getElementById('completedTasksKanban');

        const pendingTasks = this.tasks.filter(task => !task.completed && task.status !== 'in-progress');
        const inProgressTasks = this.tasks.filter(task => task.status === 'in-progress');
        const completedTasks = this.tasks.filter(task => task.completed);

        pendingContainer.innerHTML = pendingTasks.map(task => this.createKanbanTaskHTML(task)).join('');
        inProgressContainer.innerHTML = inProgressTasks.map(task => this.createKanbanTaskHTML(task)).join('');
        completedContainer.innerHTML = completedTasks.map(task => this.createKanbanTaskHTML(task)).join('');

        this.bindKanbanEvents();
    }

    createKanbanTaskHTML(task) {
        return `
            <div class="kanban-task" data-task-id="${task.id}" draggable="true">
                <h4 class="task-title">${task.title}</h4>
                ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
                <div class="task-meta">
                    <span class="task-priority ${task.priority}">${task.priority}</span>
                    <span class="task-category">${task.category}</span>
                    ${task.dueDate ? `<span class="task-due-date">${this.formatDate(new Date(task.dueDate))}</span>` : ''}
                </div>
                ${task.tags.length > 0 ? `
                    <div class="task-tags">
                        ${task.tags.map(tag => `<span class="task-tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    bindKanbanEvents() {
        const tasks = document.querySelectorAll('.kanban-task');
        const columns = document.querySelectorAll('.column-tasks');

        tasks.forEach(task => {
            task.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', task.dataset.taskId);
                task.classList.add('dragging');
            });

            task.addEventListener('dragend', () => {
                task.classList.remove('dragging');
            });
        });

        columns.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                column.classList.add('drag-over');
            });

            column.addEventListener('dragleave', () => {
                column.classList.remove('drag-over');
            });

            column.addEventListener('drop', (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');
                
                const taskId = e.dataTransfer.getData('text/plain');
                const newStatus = column.parentElement.dataset.status;
                
                this.updateTaskStatus(taskId, newStatus);
            });
        });
    }

    updateTaskStatus(taskId, newStatus) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = newStatus;
            if (newStatus === 'completed') {
                task.completed = true;
                task.completedAt = new Date().toISOString();
            } else {
                task.completed = false;
                task.completedAt = null;
            }
            task.updatedAt = new Date().toISOString();
            
            this.saveTasks();
            this.renderTasks();
            this.renderKanban();
            this.showToast('Task status updated!', 'success');
        }
    }

    renderCalendar() {
        const grid = document.getElementById('calendarGrid');
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        
        document.getElementById('currentMonth').textContent = 
            new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        const days = [];
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            days.push(date);
        }

        grid.innerHTML = days.map(date => {
            const isToday = this.isSameDay(date, now);
            const isOtherMonth = date.getMonth() !== month;
            const tasksForDay = this.tasks.filter(task => 
                task.dueDate && this.isSameDay(new Date(task.dueDate), date)
            );

            return `
                <div class="calendar-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}">
                    <div class="calendar-day-number">${date.getDate()}</div>
                    <div class="calendar-tasks">
                        ${tasksForDay.slice(0, 3).map(task => `
                            <div class="calendar-task" style="background: ${this.getPriorityColor(task.priority)}20; color: ${this.getPriorityColor(task.priority)}">
                                ${task.title}
                            </div>
                        `).join('')}
                        ${tasksForDay.length > 3 ? `<div class="calendar-task">+${tasksForDay.length - 3} more</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    navigateMonth(direction) {
        // This is a simplified implementation - in a real app you'd track the current month
        this.renderCalendar();
    }

    renderAnalytics() {
        this.renderCategoryStats();
        this.renderWeeklyChart();
        this.updateProgressRing();
    }

    renderCategoryStats() {
        const container = document.getElementById('categoryStats');
        const categoryStats = this.categories.map(category => {
            const tasksInCategory = this.tasks.filter(task => task.category === category.id);
            const completedInCategory = tasksInCategory.filter(task => task.completed);
            
            return {
                ...category,
                total: tasksInCategory.length,
                completed: completedInCategory.length,
                percentage: tasksInCategory.length > 0 ? Math.round((completedInCategory.length / tasksInCategory.length) * 100) : 0
            };
        });

        container.innerHTML = categoryStats.map(stat => `
            <div class="category-stat">
                <div class="category-stat-info">
                    <div class="category-stat-color" style="background: ${stat.color}"></div>
                    <span>${stat.name}</span>
                </div>
                <div class="category-stat-value">${stat.completed}/${stat.total} (${stat.percentage}%)</div>
            </div>
        `).join('');
    }

    renderWeeklyChart() {
        const canvas = document.getElementById('weeklyChart');
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Generate sample weekly data
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const data = days.map(() => Math.floor(Math.random() * 10) + 1);
        
        const maxValue = Math.max(...data);
        const barWidth = canvas.width / days.length;
        const barMaxHeight = canvas.height - 40;
        
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-primary');
        
        data.forEach((value, index) => {
            const barHeight = (value / maxValue) * barMaxHeight;
            const x = index * barWidth + barWidth * 0.2;
            const y = canvas.height - barHeight - 20;
            const width = barWidth * 0.6;
            
            ctx.fillRect(x, y, width, barHeight);
            
            // Draw day labels
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted');
            ctx.font = '12px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(days[index], x + width / 2, canvas.height - 5);
            
            // Draw values
            ctx.fillText(value.toString(), x + width / 2, y - 5);
            
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-primary');
        });
    }

    updateProgressRing() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(task => task.completed).length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        const circle = document.querySelector('.progress-ring circle:last-child');
        const circumference = 2 * Math.PI * 54;
        const offset = circumference - (percentage / 100) * circumference;
        
        circle.style.strokeDashoffset = offset;
        document.querySelector('.progress-value').textContent = percentage + '%';
    }

    togglePomodoro() {
        if (this.pomodoroRunning) {
            this.pausePomodoro();
        } else {
            this.startPomodoro();
        }
    }

    startPomodoro() {
        this.pomodoroRunning = true;
        const playButton = document.getElementById('pomodoroPlay');
        playButton.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="4" width="4" height="16" fill="currentColor"/>
                <rect x="14" y="4" width="4" height="16" fill="currentColor"/>
            </svg>
        `;

        this.pomodoroTimer = setInterval(() => {
            this.pomodoroTime--;
            this.updatePomodoroDisplay();
            
            if (this.pomodoroTime <= 0) {
                this.completePomodoroSession();
            }
        }, 1000);
    }

    pausePomodoro() {
        this.pomodoroRunning = false;
        clearInterval(this.pomodoroTimer);
        const playButton = document.getElementById('pomodoroPlay');
        playButton.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polygon points="5,3 19,12 5,21" fill="currentColor"/>
            </svg>
        `;
    }

    resetPomodoro() {
        this.pausePomodoro();
        this.pomodoroTime = 25 * 60;
        this.updatePomodoroDisplay();
    }

    updatePomodoroDisplay() {
        const minutes = Math.floor(this.pomodoroTime / 60);
        const seconds = this.pomodoroTime % 60;
        const timeDisplay = document.querySelector('.pomodoro-time');
        const progressCircle = document.querySelector('.pomodoro-progress circle:last-child');
        
        timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const totalTime = 25 * 60;
        const percentage = ((totalTime - this.pomodoroTime) / totalTime) * 100;
        const circumference = 2 * Math.PI * 16;
        const offset = circumference - (percentage / 100) * circumference;
        
        progressCircle.style.strokeDashoffset = offset;
    }

    completePomodoroSession() {
        this.resetPomodoro();
        this.showToast('Pomodoro session completed! Take a break! 🍅', 'success');
        
        // Play a notification sound (if supported)
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('TaskFlow', {
                body: 'Pomodoro session completed! Time for a break.',
                icon: '/favicon.ico'
            });
        }
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" stroke-width="2"/><polyline points="22,4 12,14.01 9,11.01" stroke="currentColor" stroke-width="2"/></svg>`,
            error: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/></svg>`,
            warning: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2"/></svg>`,
            info: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 16V12" stroke="currentColor" stroke-width="2"/><path d="M12 8H12.01" stroke="currentColor" stroke-width="2"/></svg>`
        };
        
        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-message">${message}</div>
        `;
        
        container.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => container.removeChild(toast), 300);
        }, 3000);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('taskflow-theme', newTheme);
        
        // Recreate particles with new colors
        this.initParticles();
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('taskflow-theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    formatDate(date) {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
    }

    isSameDay(date1, date2) {
        return date1.getDate() === date2.getDate() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getFullYear() === date2.getFullYear();
    }

    getPriorityColor(priority) {
        const colors = {
            low: '#10B981',
            medium: '#F59E0B',
            high: '#F97316',
            urgent: '#EF4444'
        };
        return colors[priority] || colors.medium;
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// Initialize the app
const app = new TaskFlowApp();

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// Add some sample tasks for demonstration
if (app.tasks.length === 0) {
    const sampleTasks = [
        {
            id: 'sample-1',
            title: 'Welcome to TaskFlow!',
            description: 'This is a sample task to get you started. Try creating your own tasks and exploring different views.',
            category: 'personal',
            priority: 'medium',
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
            dueTime: '09:00',
            tags: ['welcome', 'getting-started'],
            completed: false,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: null
        },
        {
            id: 'sample-2',
            title: 'Explore the Kanban Board',
            description: 'Click on the Board view to see your tasks organized in columns. You can drag and drop tasks between columns!',
            category: 'work',
            priority: 'high',
            dueDate: new Date().toISOString().split('T')[0], // Today
            dueTime: '14:00',
            tags: ['tutorial', 'kanban'],
            completed: false,
            status: 'in-progress',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: null
        },
        {
            id: 'sample-3',
            title: 'Try the Pomodoro Timer',
            description: 'Use the Pomodoro timer in the sidebar to boost your productivity with focused work sessions.',
            category: 'personal',
            priority: 'low',
            dueDate: null,
            dueTime: null,
            tags: ['productivity', 'timer'],
            completed: true,
            status: 'completed',
            createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
            updatedAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
        }
    ];
    
    app.tasks = sampleTasks;
    app.saveTasks();
    app.renderTasks();
    app.renderKanban();
    app.renderCalendar();
    app.renderAnalytics();
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 'n':
                e.preventDefault();
                app.openTaskModal();
                break;
            case 'k':
                e.preventDefault();
                document.getElementById('searchInput').focus();
                break;
        }
    }
    
    if (e.key === 'Escape') {
        app.closeTaskModal();
    }
});

// Service Worker registration (for PWA capabilities)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .catch(err => console.log('ServiceWorker registration failed'));
    });
}