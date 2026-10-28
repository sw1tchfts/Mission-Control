// Pure task-list logic, shared by the browser app (window.Tasks) and the Node tests (require).
// Every function returns a new array and never mutates its input.
(function (root) {
  'use strict';

  const STORAGE_KEY = 'mission-control.tasks';

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function addTask(tasks, title) {
    const trimmed = String(title).trim();
    if (!trimmed) return tasks;
    return [...tasks, { id: newId(), title: trimmed, done: false, createdAt: Date.now() }];
  }

  function toggleTask(tasks, id) {
    return tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  }

  // A blank title keeps the old one rather than silently deleting the task.
  function renameTask(tasks, id, title) {
    const trimmed = String(title).trim();
    if (!trimmed) return tasks;
    return tasks.map((t) => (t.id === id ? { ...t, title: trimmed } : t));
  }

  function removeTask(tasks, id) {
    return tasks.filter((t) => t.id !== id);
  }

  function clearCompleted(tasks) {
    return tasks.filter((t) => !t.done);
  }

  function filterTasks(tasks, filter) {
    if (filter === 'active') return tasks.filter((t) => !t.done);
    if (filter === 'done') return tasks.filter((t) => t.done);
    return tasks;
  }

  // Reads saved JSON, dropping anything malformed so a bad value never breaks the app.
  function parseTasks(json) {
    let data;
    try {
      data = JSON.parse(json);
    } catch {
      return [];
    }
    if (!Array.isArray(data)) return [];
    return data
      .filter((t) => t && typeof t.id === 'string' && typeof t.title === 'string')
      .map((t) => ({ id: t.id, title: t.title, done: Boolean(t.done), createdAt: Number(t.createdAt) || 0 }));
  }

  const api = { STORAGE_KEY, addTask, toggleTask, renameTask, removeTask, clearCompleted, filterTasks, parseTasks };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Tasks = api;
})(globalThis);
