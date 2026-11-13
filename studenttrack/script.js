'use strict';

/* =====================================================
   Student Activity Tracker
   ===================================================== */

/* ---------- Constants ---------- */
const STORAGE_KEY = 'studentActivities.v1';
const THEME_KEY = 'studentActivityTheme';
const TYPES = ['Sports', 'Academics', 'Arts', 'Club', 'Volunteering', 'Other'];
const TYPE_COLORS = {
  Sports: '#10b981',
  Academics: '#6366f1',
  Arts: '#ec4899',
  Club: '#0ea5e9',
  Volunteering: '#f59e0b',
  Other: '#64748b'
};
const FIELD_KEYS = ['name', 'roll', 'type', 'title', 'date', 'duration', 'notes'];

/* ---------- App state ---------- */
const state = {
  activities: [],
  editingId: null,
  sortBy: 'date',
  sortDir: 'desc',
  lastAddedId: null
};

let typeChart = null;
let studentChart = null;
let chartsReady = false;

/* ---------- DOM references ---------- */
const $ = (id) => document.getElementById(id);

const refs = {
  form: $('activityForm'),
  formTitle: $('formTitle'),
  submitText: $('submitText'),
  submitIcon: $('submitIcon'),
  cancelEditBtn: $('cancelEditBtn'),
  tbody: $('activityBody'),
  tableWrap: $('tableWrap'),
  emptyState: $('emptyState'),
  emptyTitle: $('emptyTitle'),
  emptyText: $('emptyText'),
  resultCount: $('resultCount'),
  filterError: $('filterError'),
  search: $('searchInput'),
  filterType: $('filterType'),
  dateFrom: $('dateFrom'),
  dateTo: $('dateTo'),
  sortBy: $('sortBy'),
  sortDirBtn: $('sortDirBtn'),
  sortDirIcon: $('sortDirIcon'),
  resetFilters: $('resetFiltersBtn'),
  exportBtn: $('exportBtn'),
  themeToggle: $('themeToggle'),
  themeIcon: $('themeIcon'),
  toastContainer: $('toastContainer'),
  statActivities: $('statActivities'),
  statStudents: $('statStudents'),
  statHours: $('statHours'),
  statTop: $('statTop'),
  statTopSub: $('statTopSub'),
  typeCanvas: $('typeChart'),
  studentCanvas: $('studentChart'),
  typeEmpty: $('typeChartEmpty'),
  studentEmpty: $('studentChartEmpty')
};

/* =====================================================
   Helpers
   ===================================================== */

// Format a Date as YYYY-MM-DD in local time
function toISODate(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function todayStr() {
  return toISODate(new Date());
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

// Show a YYYY-MM-DD string as "13 Nov 2026"
function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// Trim floating point noise (e.g. 2.5000001 -> 2.5)
function fmt(n) {
  return Number(Number(n).toFixed(2));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function typeSlug(type) {
  return String(type).toLowerCase();
}

/* =====================================================
   Storage: sample data, load, save
   ===================================================== */

function buildSampleData() {
  const samples = [
    { name: 'Aarav Sharma', roll: 'CS101', type: 'Sports', title: 'Inter-school Football Tournament', date: daysAgo(3), duration: 3, notes: 'Scored the winning goal in the final.' },
    { name: 'Priya Nair', roll: 'CS102', type: 'Academics', title: 'Science Olympiad Prep', date: daysAgo(6), duration: 2.5, notes: 'Physics and chemistry problem solving.' },
    { name: 'Rohan Mehta', roll: 'CS103', type: 'Arts', title: 'Annual Day Painting Exhibit', date: daysAgo(10), duration: 4, notes: '' },
    { name: 'Ananya Iyer', roll: 'CS104', type: 'Volunteering', title: 'Community Clean-up Drive', date: daysAgo(14), duration: 5, notes: 'Led a team of 8 volunteers.' },
    { name: 'Aarav Sharma', roll: 'CS101', type: 'Club', title: 'Robotics Club Workshop', date: daysAgo(20), duration: 2, notes: 'Built a line-following robot.' }
  ];
  return samples.map((s) => ({ id: generateId(), ...s }));
}

// Basic sanity check for records loaded from storage
function isValidRecord(r) {
  return r && typeof r === 'object' &&
    typeof r.id === 'string' &&
    typeof r.name === 'string' &&
    typeof r.roll === 'string' &&
    TYPES.includes(r.type) &&
    typeof r.title === 'string' &&
    typeof r.date === 'string' &&
    typeof r.duration === 'number' && isFinite(r.duration) &&
    (typeof r.notes === 'string' || r.notes === undefined);
}

// Load activities (seed sample data on first visit)
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      state.activities = buildSampleData();
      saveData();
      return;
    }
    const parsed = JSON.parse(raw);
    state.activities = Array.isArray(parsed)
      ? parsed.filter(isValidRecord).map((r) => ({ ...r, notes: r.notes || '' }))
      : [];
  } catch (err) {
    state.activities = buildSampleData();
  }
}

// Persist activities to localStorage
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.activities));
  } catch (err) {
    showToast('Could not save to browser storage.', 'error');
  }
}

/* =====================================================
   Toasts
   ===================================================== */

function showToast(message, type = 'success') {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');

  const icon = document.createElement('i');
  icon.className = `fa-solid ${icons[type] || icons.success}`;
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.textContent = message;

  toast.append(icon, text);
  refs.toastContainer.appendChild(toast);

  setTimeout(() => toast.classList.add('toast-hide'), 3000);
  setTimeout(() => toast.remove(), 3350);
}

/* =====================================================
   Validation and form handling
   ===================================================== */

// Read trimmed values from the form
function readForm() {
  const values = {};
  FIELD_KEYS.forEach((key) => {
    values[key] = $(`field-${key}`).value.trim();
  });
  return values;
}

// Validate values; returns an object of { field: message }
function validate(v, ignoreId) {
  const errors = {};

  if (!v.name) errors.name = 'Student name is required.';
  else if (v.name.length < 2) errors.name = 'Name must be at least 2 characters.';

  if (!v.roll) errors.roll = 'Roll number is required.';

  if (!v.type) errors.type = 'Please choose an activity type.';
  else if (!TYPES.includes(v.type)) errors.type = 'Invalid activity type.';

  if (!v.title) errors.title = 'Activity title is required.';

  if (!v.date) errors.date = 'Date is required.';
  else if (v.date > todayStr()) errors.date = 'Date cannot be in the future.';

  if (v.duration === '') {
    errors.duration = 'Duration is required.';
  } else {
    const n = Number(v.duration);
    if (!Number.isFinite(n) || n <= 0) errors.duration = 'Duration must be a positive number.';
  }

  if (v.notes.length > 300) errors.notes = 'Notes cannot exceed 300 characters.';

  // Duplicate check: same roll number + title + date
  if (!errors.roll && !errors.title && !errors.date) {
    const dup = state.activities.some((a) =>
      a.id !== ignoreId &&
      a.roll.toLowerCase() === v.roll.toLowerCase() &&
      a.title.toLowerCase() === v.title.toLowerCase() &&
      a.date === v.date
    );
    if (dup) errors.title = 'An entry with this roll number, title and date already exists.';
  }

  return errors;
}

function setFieldError(key, message) {
  const input = $(`field-${key}`);
  const error = $(`error-${key}`);
  error.textContent = message || '';
  input.classList.toggle('invalid', Boolean(message));
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

function showErrors(errors) {
  FIELD_KEYS.forEach((key) => setFieldError(key, errors[key] || ''));
}

function clearAllErrors() {
  FIELD_KEYS.forEach((key) => setFieldError(key, ''));
}

// Handle add / update submit
function handleSubmit(event) {
  event.preventDefault();

  const values = readForm();
  const errors = validate(values, state.editingId);

  if (Object.keys(errors).length > 0) {
    showErrors(errors);
    const firstKey = FIELD_KEYS.find((k) => errors[k]);
    if (firstKey) $(`field-${firstKey}`).focus();
    return;
  }

  clearAllErrors();
  const duration = Math.round(Number(values.duration) * 100) / 100;
  let message;
  let id;

  const editIndex = state.editingId
    ? state.activities.findIndex((a) => a.id === state.editingId)
    : -1;

  if (editIndex !== -1) {
    id = state.editingId;
    state.activities[editIndex] = { ...state.activities[editIndex], ...values, duration };
    message = 'Activity updated successfully';
  } else {
    id = generateId();
    state.activities.push({ id, ...values, duration });
    state.lastAddedId = id;
    message = 'Activity added successfully';
  }

  saveData();
  resetForm();
  renderAll();

  const isVisible = getVisibleActivities().some((a) => a.id === id);
  showToast(isVisible ? message : `${message} (hidden by current filters)`, 'success');
}

// Reset the form back to "add" mode
function resetForm() {
  refs.form.reset();
  state.editingId = null;
  refs.formTitle.textContent = 'Add New Activity';
  refs.submitText.textContent = 'Add Activity';
  refs.submitIcon.className = 'fa-solid fa-plus';
  refs.cancelEditBtn.hidden = true;
  clearAllErrors();
  markEditingRow();
}

// Pre-fill the form with an existing record
function startEdit(id) {
  const record = state.activities.find((a) => a.id === id);
  if (!record) return;

  state.editingId = id;
  FIELD_KEYS.forEach((key) => {
    $(`field-${key}`).value = record[key] === undefined ? '' : record[key];
  });
  clearAllErrors();

  refs.formTitle.textContent = 'Edit Activity';
  refs.submitText.textContent = 'Update Activity';
  refs.submitIcon.className = 'fa-solid fa-floppy-disk';
  refs.cancelEditBtn.hidden = false;
  markEditingRow();

  refs.form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('field-name').focus({ preventScroll: true });
}

// Delete a record after confirmation
function deleteActivity(id) {
  const record = state.activities.find((a) => a.id === id);
  if (!record) return;

  const ok = window.confirm(`Delete "${record.title}" for ${record.name}?\nThis cannot be undone.`);
  if (!ok) return;

  state.activities = state.activities.filter((a) => a.id !== id);
  if (state.editingId === id) resetForm();
  saveData();
  renderAll();
  showToast('Activity deleted', 'success');
}

/* =====================================================
   Filtering and sorting
   ===================================================== */

function isRangeInvalid() {
  return Boolean(refs.dateFrom.value && refs.dateTo.value && refs.dateFrom.value > refs.dateTo.value);
}

// Apply search, filters and sorting; returns a new array
function getVisibleActivities() {
  if (isRangeInvalid()) return [];

  const query = refs.search.value.trim().toLowerCase();
  const type = refs.filterType.value;
  const from = refs.dateFrom.value;
  const to = refs.dateTo.value;

  const list = state.activities.filter((a) => {
    if (query && !(a.name.toLowerCase().includes(query) || a.roll.toLowerCase().includes(query))) return false;
    if (type && a.type !== type) return false;
    if (from && a.date < from) return false;
    if (to && a.date > to) return false;
    return true;
  });

  const dir = state.sortDir === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    let result;
    if (state.sortBy === 'name') {
      result = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    } else if (state.sortBy === 'duration') {
      result = a.duration - b.duration;
    } else {
      result = a.date.localeCompare(b.date);
    }
    return (result * dir) || a.name.localeCompare(b.name) || a.title.localeCompare(b.title);
  });

  return list;
}

function resetFilters() {
  refs.search.value = '';
  refs.filterType.value = '';
  refs.dateFrom.value = '';
  refs.dateTo.value = '';
  renderTable();
}

function toggleSortDirection() {
  state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  const asc = state.sortDir === 'asc';
  refs.sortDirIcon.className = asc ? 'fa-solid fa-arrow-up-wide-short' : 'fa-solid fa-arrow-down-wide-short';
  refs.sortDirBtn.setAttribute('aria-label', `Sort direction: ${asc ? 'ascending' : 'descending'}`);
  renderTable();
}

/* =====================================================
   Rendering: table
   ===================================================== */

function makeCell(label, content, className) {
  const td = document.createElement('td');
  td.setAttribute('data-label', label);
  if (className) td.className = className;
  if (content instanceof Node) td.appendChild(content);
  else td.textContent = content;
  return td;
}

function makeActionButton(action, id, iconClass, label, ariaLabel, extraClass) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn btn-sm ${extraClass}`;
  btn.setAttribute('data-action', action);
  btn.setAttribute('data-id', id);
  btn.setAttribute('aria-label', ariaLabel);

  const icon = document.createElement('i');
  icon.className = iconClass;
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.textContent = label;

  btn.append(icon, text);
  return btn;
}

// Build one table row
function buildRow(a) {
  const tr = document.createElement('tr');
  tr.dataset.id = a.id;
  if (a.id === state.lastAddedId) tr.classList.add('row-new');

  const badge = document.createElement('span');
  badge.className = `badge badge-${typeSlug(a.type)}`;
  badge.textContent = a.type;

  const notesCell = makeCell('Notes', a.notes || '—', 'cell-notes');
  if (a.notes) notesCell.title = a.notes;

  const actions = document.createElement('div');
  actions.className = 'cell-actions-inner';
  actions.append(
    makeActionButton('edit', a.id, 'fa-solid fa-pen', 'Edit', `Edit ${a.title} for ${a.name}`, 'btn-edit'),
    makeActionButton('delete', a.id, 'fa-solid fa-trash', 'Delete', `Delete ${a.title} for ${a.name}`, 'btn-delete')
  );

  tr.append(
    makeCell('Student', a.name, 'cell-name'),
    makeCell('Roll No.', a.roll, 'cell-nowrap'),
    makeCell('Type', badge),
    makeCell('Title', a.title),
    makeCell('Date', formatDate(a.date), 'cell-nowrap'),
    makeCell('Hours', String(fmt(a.duration)), 'cell-nowrap'),
    notesCell,
    makeCell('Actions', actions, 'cell-actions')
  );
  return tr;
}

// Highlight the row currently being edited
function markEditingRow() {
  refs.tbody.querySelectorAll('tr').forEach((tr) => {
    tr.classList.toggle('row-editing', Boolean(state.editingId) && tr.dataset.id === state.editingId);
  });
}

// Render the table, empty states and result count
function renderTable() {
  const total = state.activities.length;
  const rangeInvalid = isRangeInvalid();
  const list = getVisibleActivities();

  refs.filterError.textContent = rangeInvalid ? '"From" date must be on or before the "To" date.' : '';

  refs.tbody.replaceChildren();
  list.forEach((a) => refs.tbody.appendChild(buildRow(a)));
  state.lastAddedId = null;
  markEditingRow();

  refs.tableWrap.hidden = list.length === 0;
  refs.emptyState.hidden = list.length > 0;

  if (list.length === 0) {
    if (total === 0) {
      refs.emptyTitle.textContent = 'No activities yet';
      refs.emptyText.textContent = 'Add your first student activity using the form above.';
    } else {
      refs.emptyTitle.textContent = 'No matching activities';
      refs.emptyText.textContent = 'Try changing your search or filters, or press Reset.';
    }
  }

  refs.resultCount.textContent = total === 0
    ? ''
    : `Showing ${list.length} of ${total} ${total === 1 ? 'activity' : 'activities'}`;
}

/* =====================================================
   Rendering: dashboard summary
   ===================================================== */

// Group activities by student (roll number) with totals
function aggregateByStudent(activities) {
  const map = new Map();
  const ordered = [...activities].sort((a, b) => a.date.localeCompare(b.date));

  ordered.forEach((a) => {
    const key = a.roll.toLowerCase();
    if (!map.has(key)) map.set(key, { roll: a.roll, name: a.name, hours: 0, count: 0 });
    const s = map.get(key);
    s.hours += a.duration;
    s.count += 1;
    s.name = a.name; // use the most recent spelling of the name
  });

  return [...map.values()].sort((x, y) =>
    (y.hours - x.hours) || (y.count - x.count) || x.name.localeCompare(y.name)
  );
}

function renderSummary() {
  const acts = state.activities;
  const students = aggregateByStudent(acts);
  const totalHours = acts.reduce((sum, a) => sum + a.duration, 0);

  refs.statActivities.textContent = acts.length;
  refs.statStudents.textContent = students.length;
  refs.statHours.textContent = fmt(totalHours);

  if (students.length === 0) {
    refs.statTop.textContent = '—';
    refs.statTopSub.textContent = 'No data yet';
  } else {
    const top = students[0];
    refs.statTop.textContent = top.name;
    refs.statTopSub.textContent = `${fmt(top.hours)} hrs · ${top.count} ${top.count === 1 ? 'activity' : 'activities'}`;
  }
}

/* =====================================================
   Rendering: charts (Chart.js)
   ===================================================== */

function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    text: s.getPropertyValue('--text').trim() || '#1f2040',
    muted: s.getPropertyValue('--muted').trim() || '#6b7090',
    grid: s.getPropertyValue('--border').trim() || '#e4e6f2',
    card: s.getPropertyValue('--card').trim() || '#ffffff'
  };
}

function initCharts() {
  if (typeof Chart === 'undefined') {
    chartsReady = false;
    return;
  }
  chartsReady = true;
  Chart.defaults.font.family = "'Poppins', system-ui, sans-serif";

  typeChart = new Chart(refs.typeCanvas, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{ data: [], backgroundColor: [], borderWidth: 3 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed} ${ctx.parsed === 1 ? 'activity' : 'activities'}`
          }
        }
      }
    }
  });

  studentChart = new Chart(refs.studentCanvas, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Hours',
        data: [],
        backgroundColor: '#6366f1',
        borderRadius: 8,
        maxBarThickness: 52
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y} hrs` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: {} },
        y: { beginAtZero: true, grid: {}, ticks: {}, title: { display: true, text: 'Hours' } }
      }
    }
  });
}

// Refresh chart data and theme colours
function renderCharts() {
  if (!chartsReady) {
    refs.typeEmpty.textContent = 'Charts unavailable: Chart.js could not be loaded (check your internet connection).';
    refs.studentEmpty.textContent = refs.typeEmpty.textContent;
    refs.typeEmpty.hidden = false;
    refs.studentEmpty.hidden = false;
    return;
  }

  const colors = getThemeColors();
  const acts = state.activities;
  const isEmpty = acts.length === 0;

  // Doughnut: count per activity type
  const counts = {};
  TYPES.forEach((t) => { counts[t] = 0; });
  acts.forEach((a) => { counts[a.type] += 1; });
  const usedTypes = TYPES.filter((t) => counts[t] > 0);

  typeChart.data.labels = usedTypes;
  typeChart.data.datasets[0].data = usedTypes.map((t) => counts[t]);
  typeChart.data.datasets[0].backgroundColor = usedTypes.map((t) => TYPE_COLORS[t]);
  typeChart.data.datasets[0].borderColor = colors.card;
  typeChart.options.plugins.legend.labels.color = colors.text;

  // Bar: total hours per student
  const students = aggregateByStudent(acts);
  studentChart.data.labels = students.map((s) => s.name);
  studentChart.data.datasets[0].data = students.map((s) => fmt(s.hours));
  studentChart.options.scales.x.ticks.color = colors.muted;
  studentChart.options.scales.y.ticks.color = colors.muted;
  studentChart.options.scales.y.grid.color = colors.grid;
  studentChart.options.scales.y.title.color = colors.muted;

  refs.typeEmpty.hidden = !isEmpty;
  refs.studentEmpty.hidden = !isEmpty;
  refs.typeEmpty.textContent = 'No data to chart yet.';
  refs.studentEmpty.textContent = 'No data to chart yet.';

  typeChart.update();
  studentChart.update();
}

/* =====================================================
   Render everything
   ===================================================== */

function renderAll() {
  renderSummary();
  renderTable();
  renderCharts();
}

/* =====================================================
   CSV export
   ===================================================== */

// Quote a CSV cell and neutralise spreadsheet formula injection
function csvCell(value) {
  let s = String(value === undefined || value === null ? '' : value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function exportCSV() {
  if (state.activities.length === 0) {
    showToast('No records to export yet', 'info');
    return;
  }

  const headers = ['Student Name', 'Roll Number', 'Activity Type', 'Activity Title', 'Date', 'Duration (hours)', 'Notes'];
  const rows = [...state.activities]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((a) => [a.name, a.roll, a.type, a.title, a.date, fmt(a.duration), a.notes || ''].map(csvCell).join(','));

  const csv = '\uFEFF' + [headers.map(csvCell).join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `student-activities-${todayStr()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  showToast('CSV exported successfully', 'success');
}

/* =====================================================
   Theme (dark mode)
   ===================================================== */

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  refs.themeIcon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  refs.themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
}

function loadTheme() {
  let theme = null;
  try { theme = localStorage.getItem(THEME_KEY); } catch (err) { /* ignore */ }
  if (theme !== 'dark' && theme !== 'light') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  applyTheme(theme);
}

function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch (err) { /* ignore */ }
  renderCharts(); // refresh chart colours
}

/* =====================================================
   Event listeners
   ===================================================== */

function bindEvents() {
  refs.form.addEventListener('submit', handleSubmit);
  refs.cancelEditBtn.addEventListener('click', resetForm);

  // Clear a field's inline error as soon as the user edits it
  const onFieldEdit = (e) => {
    const key = e.target.name;
    if (!FIELD_KEYS.includes(key)) return;
    setFieldError(key, '');
    if ((key === 'roll' || key === 'date') && $('error-title').textContent.includes('already exists')) {
      setFieldError('title', '');
    }
  };
  refs.form.addEventListener('input', onFieldEdit);
  refs.form.addEventListener('change', onFieldEdit);

  // Search, filters, sorting
  refs.search.addEventListener('input', renderTable);
  refs.filterType.addEventListener('change', renderTable);
  refs.dateFrom.addEventListener('input', renderTable);
  refs.dateTo.addEventListener('input', renderTable);
  refs.sortBy.addEventListener('change', () => {
    state.sortBy = refs.sortBy.value;
    renderTable();
  });
  refs.sortDirBtn.addEventListener('click', toggleSortDirection);
  refs.resetFilters.addEventListener('click', resetFilters);

  // Edit / delete buttons (event delegation)
  refs.tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (btn.getAttribute('data-action') === 'edit') startEdit(id);
    else if (btn.getAttribute('data-action') === 'delete') deleteActivity(id);
  });

  refs.exportBtn.addEventListener('click', exportCSV);
  refs.themeToggle.addEventListener('click', toggleTheme);
}

/* =====================================================
   Init
   ===================================================== */

function init() {
  // Dates cannot be in the future
  const today = todayStr();
  $('field-date').max = today;
  refs.dateFrom.max = today;
  refs.dateTo.max = today;

  loadTheme();
  loadData();
  initCharts();
  bindEvents();
  renderAll();
}

init();