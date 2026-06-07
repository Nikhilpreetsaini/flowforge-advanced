/*
 * FlowForge Advanced - Task Manager
 *
 * This script implements a fully client‑side task management application with
 * multi‑user support, recurring tasks, dependencies, subtasks, manual progress
 * tracking, time tracking and a calendar view. All data is stored in
 * localStorage under the `ffa_users` and `ffa_current_user` keys so that each
 * user’s tasks and categories are isolated. The app works entirely offline and
 * registers a service worker for caching static assets.
 */

// Persisted users object and current user identifier
let users = JSON.parse(localStorage.getItem('ffa_users') || '{}');
let currentUser = localStorage.getItem('ffa_current_user') || null;

// In‑memory tasks and categories for the active user
let tasks = [];
let categories = [];

// Currently selected category filter for the task list
let currentFilterCategory = null;

// Timer interval references keyed by task id; used to update time spent in UI
const timerIntervals = {};

// Date used by the calendar view (month/year only)
let currentDate = new Date();

// Cache frequently accessed DOM elements
const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const logoutBtn = document.getElementById('logoutBtn');

const addTaskBtn = document.getElementById('addTaskBtn');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const categoryListEl = document.getElementById('categories');
const taskListEl = document.getElementById('taskList');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const themeToggleBtn = document.getElementById('themeToggle');
const calendarBtn = document.getElementById('calendarBtn');

const calendarSection = document.getElementById('calendarSection');
const taskSection = document.getElementById('taskSection');
const calendarTitle = document.getElementById('calendarTitle');
const calendarTable = document.getElementById('calendarTable');
const dateTaskList = document.getElementById('dateTaskList');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');

const taskModal = document.getElementById('taskModal');
const modalTitle = document.getElementById('modalTitle');
const taskForm = document.getElementById('taskForm');
const taskTitleInput = document.getElementById('taskTitle');
const taskDescriptionInput = document.getElementById('taskDescription');
const taskDueDateInput = document.getElementById('taskDueDate');
const taskPrioritySelect = document.getElementById('taskPriority');
const taskCategorySelect = document.getElementById('taskCategory');
const taskRecurrenceSelect = document.getElementById('taskRecurrence');
const taskDependenciesSelect = document.getElementById('taskDependencies');
const taskProgressInput = document.getElementById('taskProgress');
const progressValueSpan = document.getElementById('progressValue');
const taskNotesInput = document.getElementById('taskNotes');
const subtasksList = document.getElementById('subtasksList');
const addSubtaskBtn = document.getElementById('addSubtaskBtn');
const cancelTaskBtn = document.getElementById('cancelTaskBtn');

const categoryModal = document.getElementById('categoryModal');
const categoryForm = document.getElementById('categoryForm');
const categoryNameInput = document.getElementById('categoryName');
const cancelCategoryBtn = document.getElementById('cancelCategoryBtn');

// Index of the task currently being edited (null for new tasks)
let editIndex = null;

// Initialise application after DOM is ready. Because the script is loaded with
// `defer`, the DOM is guaranteed to be available at this point.
init();

/**
 * Initialise event listeners, theme and authentication state. Determines
 * whether the user is logged in and loads their data accordingly.
 */
function init() {
  // Authentication
  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);
  logoutBtn.addEventListener('click', handleLogout);

  // Task/category controls
  addTaskBtn.addEventListener('click', () => {
    editIndex = null;
    openTaskModal(null);
  });
  addCategoryBtn.addEventListener('click', openCategoryModal);
  taskForm.addEventListener('submit', handleTaskSubmit);
  cancelTaskBtn.addEventListener('click', () => closeModal(taskModal));
  categoryForm.addEventListener('submit', handleCategorySubmit);
  cancelCategoryBtn.addEventListener('click', () => closeModal(categoryModal));

  // Search and sort
  searchInput.addEventListener('input', renderTasks);
  sortSelect.addEventListener('change', renderTasks);

  // Theme toggle
  themeToggleBtn.addEventListener('click', toggleTheme);
  loadTheme();

  // Calendar controls
  calendarBtn.addEventListener('click', toggleCalendarView);
  prevMonthBtn.addEventListener('click', () => changeMonth(-1));
  nextMonthBtn.addEventListener('click', () => changeMonth(1));

  // Progress slider display
  taskProgressInput.addEventListener('input', () => {
    progressValueSpan.textContent = taskProgressInput.value + '%';
  });

  // Subtasks addition
  addSubtaskBtn.addEventListener('click', () => addSubtaskRow());

  // Register service worker for offline support
  registerServiceWorker();

  // Determine authentication state and load data
  if (currentUser && users[currentUser]) {
    loadUserData();
    showApp();
  } else {
    showAuth();
  }
}

/**
 * Handle login form submission. Validates user credentials and loads their
 * stored tasks and categories if successful.
 */
function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!users[username] || users[username].password !== password) {
    alert('Invalid username or password');
    return;
  }
  currentUser = username;
  localStorage.setItem('ffa_current_user', currentUser);
  loadUserData();
  showApp();
  loginForm.reset();
}

/**
 * Handle registration form submission. Creates a new user entry in the
 * localStorage with an empty tasks array and a default category if the
 * username does not already exist.
 */
function handleRegister(event) {
  event.preventDefault();
  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value;
  if (!username || !password) {
    alert('Please enter a username and password');
    return;
  }
  if (users[username]) {
    alert('Username already exists');
    return;
  }
  users[username] = { password: password, tasks: [], categories: ['General'] };
  localStorage.setItem('ffa_users', JSON.stringify(users));
  alert('Registration successful! You can now log in.');
  registerForm.reset();
}

/**
 * Logs out the current user and resets in‑memory task/category data.
 */
function handleLogout() {
  currentUser = null;
  localStorage.removeItem('ffa_current_user');
  tasks = [];
  categories = [];
  showAuth();
}

/**
 * Display the authentication section and hide the main application UI.
 */
function showAuth() {
  authSection.style.display = '';
  appSection.style.display = 'none';
}

/**
 * Display the main application UI and hide the authentication section. Also
 * populates categories, tasks and calendar for the current user.
 */
function showApp() {
  authSection.style.display = 'none';
  appSection.style.display = '';
  logoutBtn.style.display = 'inline-block';
  renderCategories();
  populateCategorySelect();
  renderTasks();
  renderCalendar();
}

/**
 * Load tasks and categories for the currently logged in user into memory.
 * Ensures there is always at least one category.
 */
function loadUserData() {
  const user = users[currentUser];
  tasks = user.tasks || [];
  categories = user.categories || ['General'];
  if (categories.length === 0) {
    categories.push('General');
  }
}

/**
 * Persist the current user's tasks and categories back to localStorage.
 */
function saveUserData() {
  users[currentUser].tasks = tasks;
  users[currentUser].categories = categories;
  localStorage.setItem('ffa_users', JSON.stringify(users));
}

/**
 * Render the list of categories in the sidebar and apply selection state.
 */
function renderCategories() {
  categoryListEl.innerHTML = '';
  categories.forEach(cat => {
    const li = document.createElement('li');
    li.textContent = cat;
    li.className = cat === currentFilterCategory ? 'selected' : '';
    li.addEventListener('click', () => {
      if (currentFilterCategory === cat) {
        currentFilterCategory = null;
      } else {
        currentFilterCategory = cat;
      }
      renderCategories();
      renderTasks();
    });
    categoryListEl.appendChild(li);
  });
}

/**
 * Populate the category and dependency dropdowns in the task modal.
 */
function populateCategorySelect() {
  taskCategorySelect.innerHTML = '';
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    taskCategorySelect.appendChild(option);
  });
}

/**
 * Render the list of tasks based on the active user, search query and
 * selected category filter. Includes progress bars, time spent, recurrence
 * indicators, dependency badges and action buttons for completion, timing,
 * editing and deletion.
 */
function renderTasks() {
  const query = searchInput.value.toLowerCase();
  let filtered = tasks.slice();
  if (currentFilterCategory) {
    filtered = filtered.filter(t => t.category === currentFilterCategory);
  }
  if (query) {
    filtered = filtered.filter(t => {
      return t.title.toLowerCase().includes(query) ||
             (t.description && t.description.toLowerCase().includes(query)) ||
             (t.notes && t.notes.toLowerCase().includes(query));
    });
  }
  // Sorting
  const sortBy = sortSelect.value;
  filtered.sort((a, b) => {
    if (sortBy === 'dueDate') {
      return (a.dueDate || '').localeCompare(b.dueDate || '');
    } else if (sortBy === 'priority') {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    } else if (sortBy === 'createdAt') {
      return a.createdAt - b.createdAt;
    }
    return 0;
  });
  // Clear list
  taskListEl.innerHTML = '';
  filtered.forEach((task, index) => {
    // Calculate progress
    let progress = task.progress || 0;
    if (task.subtasks && task.subtasks.length > 0) {
      const completed = task.subtasks.filter(s => s.completed).length;
      progress = task.subtasks.length > 0 ? Math.round((completed / task.subtasks.length) * 100) : 0;
    }
    // Calculate time spent (includes running timer)
    const base = task.timeSpent || 0;
    let running = 0;
    if (task.timerStart) {
      running = Date.now() - task.timerStart;
    }
    const totalMs = base + running;
    const timeStr = formatDuration(totalMs);
    // Determine if dependencies are incomplete
    let depsIncomplete = false;
    if (task.dependencies && task.dependencies.length > 0) {
      depsIncomplete = task.dependencies.some(depId => {
        const depTask = tasks.find(t => t.id === depId);
        return depTask && !depTask.completed;
      });
    }
    // Build task item
    const li = document.createElement('li');
    li.className = 'task-item';
    // Info column
    const info = document.createElement('div');
    info.className = 'info';
    const titleEl = document.createElement('h3');
    titleEl.textContent = task.title;
    if (task.completed) titleEl.style.textDecoration = 'line-through';
    info.appendChild(titleEl);
    if (task.description) {
      const p = document.createElement('p');
      p.textContent = task.description;
      info.appendChild(p);
    }
    const meta = document.createElement('div');
    meta.className = 'meta';
    const dueLabel = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due';
    meta.textContent = `${task.priority.toUpperCase()} • ${dueLabel} • ${task.category}`;
    if (task.recurrence) {
      const span = document.createElement('span');
      span.textContent = ` • 🔁 ${task.recurrence}`;
      meta.appendChild(span);
    }
    info.appendChild(meta);
    // Progress bar
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-bar-container';
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.style.width = progress + '%';
    progressContainer.appendChild(progressBar);
    info.appendChild(progressContainer);
    // Time spent label
    const timeDiv = document.createElement('div');
    timeDiv.style.fontSize = '0.7rem';
    timeDiv.textContent = `⏱ ${timeStr}`;
    info.appendChild(timeDiv);
    // Dependencies indicator
    if (task.dependencies && task.dependencies.length > 0) {
      const depDiv = document.createElement('div');
      depDiv.style.fontSize = '0.7rem';
      const incompleteCount = task.dependencies.filter(depId => {
        const d = tasks.find(t => t.id === depId);
        return d && !d.completed;
      }).length;
      depDiv.textContent = `Depends on: ${task.dependencies.length} (remaining: ${incompleteCount})`;
      info.appendChild(depDiv);
    }
    // Notes indicator
    if (task.notes) {
      const notesDiv = document.createElement('div');
      notesDiv.style.fontSize = '0.7rem';
      notesDiv.textContent = '📝';
      info.appendChild(notesDiv);
    }
    li.appendChild(info);
    // Actions column
    const actions = document.createElement('div');
    actions.className = 'actions';
    // Complete/Undo button
    const completeBtn = document.createElement('button');
    completeBtn.textContent = task.completed ? 'Undo' : 'Done';
    completeBtn.disabled = !task.completed && depsIncomplete;
    completeBtn.addEventListener('click', () => toggleComplete(index));
    actions.appendChild(completeBtn);
    // Timer start/stop button
    const timerBtn = document.createElement('button');
    timerBtn.textContent = task.timerStart ? 'Stop' : 'Start';
    timerBtn.addEventListener('click', () => {
      if (task.timerStart) stopTimer(index);
      else startTimer(index);
    });
    actions.appendChild(timerBtn);
    // Edit button
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openTaskModal(index));
    actions.appendChild(editBtn);
    // Delete button
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => deleteTask(index));
    actions.appendChild(delBtn);
    li.appendChild(actions);
    // Append item
    taskListEl.appendChild(li);
  });
}

/**
 * Convert a duration in milliseconds into a human‑readable string (e.g. 1h 2m 3s).
 */
function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  let result = '';
  if (hours) result += hours + 'h ';
  if (hours || minutes) result += minutes + 'm ';
  result += seconds + 's';
  return result;
}

/**
 * Populate the dependencies dropdown with all tasks except the one being
 * edited. Selected options are preserved if editing an existing task.
 */
function populateDependenciesSelect(editIdx) {
  taskDependenciesSelect.innerHTML = '';
  tasks.forEach((t, i) => {
    if (editIdx != null && i === editIdx) return;
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.title;
    taskDependenciesSelect.appendChild(opt);
  });
}

/**
 * Open the task modal for creating a new task or editing an existing one.
 * Populates fields accordingly and prepares the dependencies list and
 * subtask rows. When editing, progress is set to the stored value; for
 * tasks with subtasks progress will be overridden when rendering.
 */
function openTaskModal(index) {
  editIndex = index;
  if (index != null) {
    const task = tasks[index];
    modalTitle.textContent = 'Edit Task';
    taskTitleInput.value = task.title;
    taskDescriptionInput.value = task.description || '';
    taskDueDateInput.value = task.dueDate || '';
    taskPrioritySelect.value = task.priority;
    taskCategorySelect.value = task.category;
    taskRecurrenceSelect.value = task.recurrence || '';
    populateDependenciesSelect(index);
    // Select dependencies
    Array.from(taskDependenciesSelect.options).forEach(opt => {
      if (task.dependencies && task.dependencies.includes(opt.value)) {
        opt.selected = true;
      }
    });
    const prog = task.progress || 0;
    taskProgressInput.value = prog;
    progressValueSpan.textContent = prog + '%';
    taskNotesInput.value = task.notes || '';
    renderSubtasks(task.subtasks || []);
  } else {
    modalTitle.textContent = 'Add Task';
    taskTitleInput.value = '';
    taskDescriptionInput.value = '';
    taskDueDateInput.value = '';
    taskPrioritySelect.value = 'medium';
    taskCategorySelect.value = categories[0];
    taskRecurrenceSelect.value = '';
    populateDependenciesSelect(null);
    taskProgressInput.value = 0;
    progressValueSpan.textContent = '0%';
    taskNotesInput.value = '';
    renderSubtasks([]);
  }
  taskModal.classList.add('show');
  taskModal.setAttribute('aria-hidden', 'false');
}

/**
 * Create or update a task when the task modal form is submitted. Collects
 * values from all inputs including subtasks and dependencies. When editing,
 * preserves completion state, creation date, time spent and timer status.
 */
function handleTaskSubmit(event) {
  event.preventDefault();
  const title = taskTitleInput.value.trim();
  if (!title) {
    alert('Title is required');
    return;
  }
  const newTask = {
    id: editIndex != null ? tasks[editIndex].id : Date.now(),
    title: title,
    description: taskDescriptionInput.value.trim(),
    dueDate: taskDueDateInput.value || null,
    priority: taskPrioritySelect.value,
    category: taskCategorySelect.value,
    recurrence: taskRecurrenceSelect.value || '',
    dependencies: Array.from(taskDependenciesSelect.selectedOptions).map(opt => opt.value),
    progress: parseInt(taskProgressInput.value) || 0,
    notes: taskNotesInput.value.trim(),
    subtasks: [],
    completed: editIndex != null ? tasks[editIndex].completed : false,
    createdAt: editIndex != null ? tasks[editIndex].createdAt : Date.now(),
    timeSpent: editIndex != null ? (tasks[editIndex].timeSpent || 0) : 0,
    timerStart: editIndex != null ? (tasks[editIndex].timerStart || null) : null
  };
  // Gather subtasks
  const subRows = subtasksList.querySelectorAll('.subtask-row');
  subRows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs.length >= 2) {
      const cb = inputs[0];
      const text = inputs[1];
      const subTitle = text.value.trim();
      if (subTitle) {
        newTask.subtasks.push({ title: subTitle, completed: cb.checked });
      }
    }
  });
  if (editIndex != null) {
    // Cancel running timer if editing and changing timerStart not needed
    tasks[editIndex] = newTask;
  } else {
    tasks.push(newTask);
  }
  saveUserData();
  renderTasks();
  renderCalendar();
  closeModal(taskModal);
}

/**
 * Handle new category creation. Adds the category to the list if it doesn’t
 * already exist and then updates the select inputs and sidebar.
 */
function handleCategorySubmit(event) {
  event.preventDefault();
  const name = categoryNameInput.value.trim();
  if (name && !categories.includes(name)) {
    categories.push(name);
    saveUserData();
    renderCategories();
    populateCategorySelect();
  }
  closeModal(categoryModal);
}

/**
 * Toggle the completion state of a task. When marking a task complete, this
 * function checks for incomplete dependencies and prevents completion if
 * necessary. It also handles generation of the next instance of a recurring
 * task when applicable.
 */
function toggleComplete(index) {
  const task = tasks[index];
  if (!task.completed) {
    // Ensure all dependencies are complete
    if (task.dependencies && task.dependencies.some(depId => {
      const depTask = tasks.find(t => t.id === depId);
      return depTask && !depTask.completed;
    })) {
      alert('Please complete dependent tasks first');
      return;
    }
  }
  task.completed = !task.completed;
  // Generate next recurring instance when completing
  if (task.completed && task.recurrence) {
    createRecurringTask(task);
  }
  saveUserData();
  renderTasks();
  renderCalendar();
}

/**
 * Delete a task after confirming with the user. Also clears any running
 * timer associated with the task.
 */
function deleteTask(index) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  const task = tasks[index];
  // Clear running timer interval
  if (task.timerStart && timerIntervals[task.id]) {
    clearInterval(timerIntervals[task.id]);
    delete timerIntervals[task.id];
  }
  tasks.splice(index, 1);
  saveUserData();
  renderTasks();
  renderCalendar();
}

/**
 * Start a timer for a task. Stores the start timestamp and sets up a
 * recurring interval to re‑render the tasks list every second so the
 * displayed time updates. Only one timer runs per task.
 */
function startTimer(index) {
  const task = tasks[index];
  if (task.timerStart) return;
  task.timerStart = Date.now();
  timerIntervals[task.id] = setInterval(() => {
    renderTasks();
  }, 1000);
  saveUserData();
  renderTasks();
}

/**
 * Stop a running timer for a task and accumulate the elapsed time into
 * the task’s total timeSpent. Clears the interval used for UI updates.
 */
function stopTimer(index) {
  const task = tasks[index];
  if (!task.timerStart) return;
  const elapsed = Date.now() - task.timerStart;
  task.timeSpent = (task.timeSpent || 0) + elapsed;
  task.timerStart = null;
  if (timerIntervals[task.id]) {
    clearInterval(timerIntervals[task.id]);
    delete timerIntervals[task.id];
  }
  saveUserData();
  renderTasks();
}

/**
 * Add a new empty subtask row to the subtasks list in the modal. Each row
 * contains a checkbox for completion status, a text input for the title
 * and a remove button to delete the row.
 */
function addSubtaskRow(title = '', completed = false) {
  const row = document.createElement('div');
  row.className = 'subtask-row';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = completed;
  const txt = document.createElement('input');
  txt.type = 'text';
  txt.placeholder = 'Subtask title';
  txt.value = title;
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => {
    row.remove();
  });
  row.appendChild(cb);
  row.appendChild(txt);
  row.appendChild(removeBtn);
  subtasksList.appendChild(row);
}

/**
 * Render existing subtasks into the modal by clearing any current rows and
 * appending a row for each subtask in the provided array.
 */
function renderSubtasks(subtasks) {
  subtasksList.innerHTML = '';
  if (Array.isArray(subtasks)) {
    subtasks.forEach(st => addSubtaskRow(st.title, st.completed));
  }
}

/**
 * Compute the next due date for a recurring task based on its current
 * dueDate and recurrence pattern. Returns a date string in YYYY‑MM‑DD
 * format or null if the input is invalid.
 */
function advanceDate(dateStr, recurrence) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  if (recurrence === 'daily') {
    date.setDate(date.getDate() + 1);
  } else if (recurrence === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else if (recurrence === 'monthly') {
    const day = date.getDate();
    date.setMonth(date.getMonth() + 1);
    // JavaScript automatically adjusts the day for month length
    if (date.getDate() !== day) {
      // If month rolled over incorrectly, set to last day of previous month
      date.setDate(0);
    }
  }
  return date.toISOString().split('T')[0];
}

/**
 * Create a new instance of a recurring task when its current instance is
 * completed. Copies all task fields except id, createdAt, time tracking and
 * completion status. Subtasks are reset to incomplete. The new task is
 * appended to the tasks array.
 */
function createRecurringTask(task) {
  if (!task.dueDate) return;
  const nextDate = advanceDate(task.dueDate, task.recurrence);
  if (!nextDate) return;
  const copy = Object.assign({}, task);
  copy.id = Date.now();
  copy.dueDate = nextDate;
  copy.completed = false;
  copy.createdAt = Date.now();
  copy.timeSpent = 0;
  copy.timerStart = null;
  if (Array.isArray(copy.subtasks)) {
    copy.subtasks = copy.subtasks.map(st => ({ title: st.title, completed: false }));
  }
  tasks.push(copy);
}

/**
 * Toggle between the calendar view and the task list view. When showing
 * the calendar, it is re‑rendered to reflect any new tasks.
 */
function toggleCalendarView() {
  const calendarVisible = calendarSection.style.display !== 'none';
  if (calendarVisible) {
    calendarSection.style.display = 'none';
    taskSection.style.display = '';
    calendarBtn.textContent = '📅 Calendar';
  } else {
    calendarSection.style.display = '';
    taskSection.style.display = 'none';
    calendarBtn.textContent = '📋 List';
    renderCalendar();
  }
}

/**
 * Increment or decrement the current month used by the calendar and
 * re‑render it. Accepts a positive or negative integer.
 */
function changeMonth(delta) {
  currentDate.setMonth(currentDate.getMonth() + delta);
  renderCalendar();
}

/**
 * Render the monthly calendar table. Shows the days of the current month
 * and indicates how many tasks are due on each day. Clicking on a day
 * displays the tasks for that date in a separate list.
 */
function renderCalendar() {
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();
  // Update the header title
  calendarTitle.textContent = currentDate.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  // Calculate dates
  const firstOfMonth = new Date(year, month, 1);
  const startDay = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let dayCounter = 1 - startDay;
  // Build the table HTML
  let html = '<thead><tr>';
  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  weekdays.forEach(w => { html += `<th>${w}</th>`; });
  html += '</tr></thead><tbody>';
  for (let i = 0; i < 6; i++) {
    html += '<tr>';
    for (let j = 0; j < 7; j++) {
      if (dayCounter < 1 || dayCounter > daysInMonth) {
        html += '<td class="empty"></td>';
      } else {
        const date = new Date(year, month, dayCounter);
        const dateStr = date.toISOString().split('T')[0];
        const count = tasks.filter(t => t.dueDate === dateStr && !t.completed).length;
        html += `<td data-date="${dateStr}">${dayCounter}${count > 0 ? '<span class="badge">' + count + '</span>' : ''}</td>`;
      }
      dayCounter++;
    }
    html += '</tr>';
  }
  html += '</tbody>';
  calendarTable.innerHTML = html;
  // Attach click handlers for date cells
  Array.from(calendarTable.querySelectorAll('td[data-date]')).forEach(td => {
    td.addEventListener('click', () => {
      const dateStr = td.getAttribute('data-date');
      showTasksForDate(dateStr);
    });
  });
  // Clear any previously displayed tasks
  dateTaskList.innerHTML = '';
}

/**
 * Show the list of tasks for a specific date in the calendar view. Tasks
 * belonging to that date are displayed as a simple list with completion
 * indicators.
 */
function showTasksForDate(dateStr) {
  const dayTasks = tasks.filter(t => t.dueDate === dateStr);
  let html = `<h3>Tasks on ${new Date(dateStr).toLocaleDateString()}</h3>`;
  html += '<ul>';
  dayTasks.forEach(t => {
    html += `<li>${t.title}${t.completed ? ' ✅' : ''}</li>`;
  });
  html += '</ul>';
  dateTaskList.innerHTML = html;
}

/**
 * Toggle the UI theme between light and dark. The chosen theme is persisted
 * to localStorage so it survives page reloads. Also updates the toggle
 * button emoji.
 */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const newTheme = current === 'dark' ? '' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('ffa_theme', newTheme);
  themeToggleBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

/**
 * Load the persisted theme from localStorage and apply it to the document.
 */
function loadTheme() {
  const saved = localStorage.getItem('ffa_theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggleBtn.textContent = '☀️';
  }
}

/**
 * Register the service worker for offline caching. Ignores any errors
 * gracefully.
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      // Registration failure is non‑fatal; no further action required
    });
  }
}

/**
 * Open the category creation modal. Clears any existing input value.
 */
function openCategoryModal() {
  categoryNameInput.value = '';
  categoryModal.classList.add('show');
  categoryModal.setAttribute('aria-hidden', 'false');
}

/**
 * Close the specified modal element by removing the `show` class and
 * updating the aria attribute to hidden.
 */
function closeModal(modal) {
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
}