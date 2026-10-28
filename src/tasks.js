// Pure task logic shared by the browser app (window.Tasks) and the Node tests (require).
// Every function returns new values and never mutates its input. Functions that change
// nothing return the very same array, so callers can skip saving and re-rendering.
(function (root) {
  'use strict';

  const D = typeof module === 'object' && module.exports ? require('./dates.js') : root.Dates;

  const STORAGE_KEY = 'mission-control.tasks';

  const STATUSES = ['todo', 'in_progress', 'done'];
  const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
  const PRIORITIES = ['high', 'medium', 'low'];
  const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };
  const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
  const REPEAT_LABELS = { daily: 'Daily', weekdays: 'Weekdays', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };

  // List sections in display order. Today's timed tasks split into morning, afternoon and evening.
  const GROUPS = [
    { key: 'overdue', label: 'Overdue' },
    { key: 'today', label: 'Anytime today' },
    { key: 'morning', label: 'Morning' },
    { key: 'afternoon', label: 'Afternoon' },
    { key: 'evening', label: 'Evening' },
    { key: 'tomorrow', label: 'Tomorrow' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'someday', label: 'No date' },
    { key: 'done', label: 'Completed' },
  ];

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Coerces anything loaded from storage (including the first version's { id, title, done }
  // records) into a complete, valid task, or returns null if it can't be one.
  function normalizeTask(t) {
    if (!t || typeof t.id !== 'string' || typeof t.title !== 'string') return null;
    const status = STATUSES.includes(t.status) ? t.status : t.done ? 'done' : 'todo';
    const dueDate = D.isValidDate(t.dueDate) ? t.dueDate : null;
    const repeat = dueDate && Object.hasOwn(REPEAT_LABELS, t.repeat) ? t.repeat : null;
    const createdAt = Number(t.createdAt) || 0;
    return {
      id: t.id,
      title: t.title,
      status,
      priority: PRIORITIES.includes(t.priority) ? t.priority : 'medium',
      dueDate,
      dueTime: dueDate && D.isValidTime(t.dueTime) ? t.dueTime : null,
      repeat,
      anchorDate: repeat ? (D.isValidDate(t.anchorDate) ? t.anchorDate : dueDate) : null,
      estimate: Number.isFinite(t.estimate) && t.estimate > 0 ? Math.round(t.estimate) : null,
      notes: typeof t.notes === 'string' ? t.notes : '',
      subtasks: listOf(
        t.subtasks,
        (s) => typeof s.id === 'string' && typeof s.title === 'string',
        (s) => ({ id: s.id, title: s.title, done: Boolean(s.done) })
      ),
      attachments: listOf(
        t.attachments,
        (a) => typeof a.id === 'string' && typeof a.name === 'string',
        (a) => ({ id: a.id, name: a.name, size: Number(a.size) || 0, type: typeof a.type === 'string' ? a.type : '' })
      ),
      createdAt,
      completedAt: status === 'done' ? Number(t.completedAt) || createdAt : null,
    };
  }

  function listOf(value, isValid, normalize) {
    return Array.isArray(value) ? value.filter((v) => v && isValid(v)).map(normalize) : [];
  }

  // Reads saved JSON, dropping anything malformed so a bad value never breaks the app.
  function parseTasks(json) {
    let data;
    try {
      data = JSON.parse(json);
    } catch {
      return [];
    }
    return Array.isArray(data) ? data.map(normalizeTask).filter(Boolean) : [];
  }

  function createTask(fields = {}, now = new Date()) {
    return normalizeTask({ title: '', ...fields, id: newId(), createdAt: now.getTime() });
  }

  function mapTask(tasks, id, fn) {
    let changed = false;
    const next = tasks.map((t) => {
      if (t.id !== id) return t;
      const updated = fn(t);
      if (updated !== t) changed = true;
      return updated;
    });
    return changed ? next : tasks;
  }

  // Edits plain fields. Status changes go through setStatus so repeating tasks roll forward.
  function updateTask(tasks, id, patch) {
    return mapTask(tasks, id, (t) => {
      const next = { ...t, ...patch, status: t.status, completedAt: t.completedAt };
      // A new date or a new repeat rule restarts the series from the current due date.
      if (next.dueDate !== t.dueDate || next.repeat !== t.repeat) next.anchorDate = next.dueDate;
      const normalized = normalizeTask(next);
      return JSON.stringify(normalized) === JSON.stringify(t) ? t : normalized;
    });
  }

  function setStatus(tasks, id, status, now = new Date()) {
    if (!STATUSES.includes(status)) return tasks;
    return mapTask(tasks, id, (t) => {
      if (t.status === status) return t;
      if (status === 'done' && t.repeat) return rollForward(t, now);
      return { ...t, status, completedAt: status === 'done' ? now.getTime() : null };
    });
  }

  function toggleDone(tasks, id, now = new Date()) {
    const task = tasks.find((t) => t.id === id);
    return task ? setStatus(tasks, id, task.status === 'done' ? 'todo' : 'done', now) : tasks;
  }

  // Completing a repeating task moves it to its next date after today and starts it fresh.
  function rollForward(t, now) {
    const today = D.toISODate(now);
    return {
      ...t,
      status: 'todo',
      completedAt: null,
      dueDate: D.nextOccurrence(t.anchorDate, t.repeat, t.dueDate > today ? t.dueDate : today),
      subtasks: t.subtasks.map((s) => ({ ...s, done: false })),
    };
  }

  function removeTask(tasks, id) {
    const next = tasks.filter((t) => t.id !== id);
    return next.length === tasks.length ? tasks : next;
  }

  // Puts a task back where it was (used by Undo).
  function insertTask(tasks, task, index) {
    if (tasks.some((t) => t.id === task.id)) return tasks;
    const next = tasks.slice();
    next.splice(Math.min(index, next.length), 0, task);
    return next;
  }

  function replaceTask(tasks, task) {
    return mapTask(tasks, task.id, () => task);
  }

  function addSubtask(tasks, id, title) {
    const trimmed = String(title).trim();
    if (!trimmed) return tasks;
    return mapTask(tasks, id, (t) => ({ ...t, subtasks: [...t.subtasks, { id: newId(), title: trimmed, done: false }] }));
  }

  function mapSubtask(tasks, id, subId, fn) {
    return mapTask(tasks, id, (t) => {
      const subtasks = t.subtasks.map((s) => (s.id === subId ? fn(s) : s));
      return subtasks.every((s, i) => s === t.subtasks[i]) ? t : { ...t, subtasks };
    });
  }

  function toggleSubtask(tasks, id, subId) {
    return mapSubtask(tasks, id, subId, (s) => ({ ...s, done: !s.done }));
  }

  // A blank title keeps the old one rather than leaving an empty subtask.
  function renameSubtask(tasks, id, subId, title) {
    const trimmed = String(title).trim();
    return mapSubtask(tasks, id, subId, (s) => (!trimmed || trimmed === s.title ? s : { ...s, title: trimmed }));
  }

  function removeSubtask(tasks, id, subId) {
    return mapTask(tasks, id, (t) =>
      t.subtasks.some((s) => s.id === subId) ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subId) } : t
    );
  }

  function addAttachment(tasks, id, file) {
    const meta = { id: file.id, name: file.name, size: file.size, type: file.type };
    return mapTask(tasks, id, (t) => ({ ...t, attachments: [...t.attachments, meta] }));
  }

  function removeAttachment(tasks, id, fileId) {
    return mapTask(tasks, id, (t) =>
      t.attachments.some((a) => a.id === fileId) ? { ...t, attachments: t.attachments.filter((a) => a.id !== fileId) } : t
    );
  }

  function isOverdue(task, now = new Date()) {
    if (task.status === 'done' || !task.dueDate) return false;
    const today = D.toISODate(now);
    if (task.dueDate !== today) return task.dueDate < today;
    return task.dueTime !== null && task.dueTime < D.toTime(now);
  }

  // Display pieces for a due date, e.g. { date: '1d overdue', time: '9 AM', overdue: true, today: false }.
  function describeDue(task, now = new Date()) {
    if (!task.dueDate) return null;
    const today = D.toISODate(now);
    const daysLate = D.daysBetween(task.dueDate, today);
    return {
      date: daysLate > 0 && task.status !== 'done' ? `${daysLate}d overdue` : D.formatDate(task.dueDate, today),
      time: task.dueTime ? D.formatTime(task.dueTime) : null,
      overdue: isOverdue(task, now),
      today: daysLate === 0,
    };
  }

  function groupOf(task, now) {
    if (task.status === 'done') return 'done';
    if (!task.dueDate) return 'someday';
    if (isOverdue(task, now)) return 'overdue';
    const today = D.toISODate(now);
    if (task.dueDate === today) {
      if (!task.dueTime) return 'today';
      if (task.dueTime < '12:00') return 'morning';
      return task.dueTime < '17:00' ? 'afternoon' : 'evening';
    }
    return task.dueDate === D.addDays(today, 1) ? 'tomorrow' : 'upcoming';
  }

  const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

  // Earliest first, untimed after timed on the same day, then by priority, then oldest first.
  function compareTasks(a, b) {
    return (
      compare(a.dueDate || '9999-12-31', b.dueDate || '9999-12-31') ||
      compare(a.dueTime || '99:99', b.dueTime || '99:99') ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.createdAt - b.createdAt
    );
  }

  // Sections for the list view, skipping empty ones. Completed tasks are newest first.
  function groupTasks(tasks, now = new Date()) {
    const buckets = Object.fromEntries(GROUPS.map((g) => [g.key, []]));
    for (const t of tasks) buckets[groupOf(t, now)].push(t);
    return GROUPS.filter((g) => buckets[g.key].length).map((g) => ({
      ...g,
      tasks: buckets[g.key].sort(g.key === 'done' ? (a, b) => b.completedAt - a.completedAt : compareTasks),
    }));
  }

  // Sidebar badges: overdue, and still to do today (not counting the overdue ones).
  function countBadges(tasks, now = new Date()) {
    const today = D.toISODate(now);
    let overdue = 0;
    let dueToday = 0;
    for (const t of tasks) {
      if (isOverdue(t, now)) overdue++;
      else if (t.status !== 'done' && t.dueDate === today) dueToday++;
    }
    return { overdue, today: dueToday };
  }

  const EMPTY_FILTER = { query: '', statuses: [], priorities: [] };

  // Empty lists mean "any". The search looks at titles, notes and subtasks.
  function matchesFilter(task, filter = EMPTY_FILTER) {
    if (filter.statuses.length && !filter.statuses.includes(task.status)) return false;
    if (filter.priorities.length && !filter.priorities.includes(task.priority)) return false;
    const q = filter.query.trim().toLowerCase();
    if (!q) return true;
    return [task.title, task.notes, ...task.subtasks.map((s) => s.title)].some((text) => text.toLowerCase().includes(q));
  }

  function activeFilterCount(filter) {
    return filter.statuses.length + filter.priorities.length + (filter.query.trim() ? 1 : 0);
  }

  // Accepts '10', '10m', '45 min', '1h', '1.5h', '1h 30m', '1:30'. Returns minutes, or null.
  function parseDuration(text) {
    const s = String(text).trim().toLowerCase();
    let m;
    if ((m = s.match(/^(\d+):([0-5]\d)$/))) return positive(Number(m[1]) * 60 + Number(m[2]));
    if (/^\d+(\.\d+)?$/.test(s)) return positive(Number(s));
    let total = 0;
    const rest = s.replace(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)/g, (_, n, unit) => {
      total += unit[0] === 'h' ? Number(n) * 60 : Number(n);
      return '';
    });
    return rest.trim() ? null : positive(total);
  }

  function positive(minutes) {
    const rounded = Math.round(minutes);
    return rounded > 0 ? rounded : null;
  }

  // 10 -> '10m', 60 -> '1h', 90 -> '1h 30m'
  function formatDuration(minutes) {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  const api = {
    STORAGE_KEY, STATUSES, STATUS_LABELS, PRIORITIES, PRIORITY_LABELS, REPEAT_LABELS, GROUPS, EMPTY_FILTER,
    newId, normalizeTask, parseTasks, createTask, updateTask, setStatus, toggleDone, removeTask, insertTask,
    replaceTask, addSubtask, toggleSubtask, renameSubtask, removeSubtask, addAttachment, removeAttachment,
    isOverdue, describeDue, groupTasks, countBadges, matchesFilter, activeFilterCount, parseDuration, formatDuration,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Tasks = api;
})(globalThis);
