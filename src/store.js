// App state (the task list, saved to localStorage, plus view settings) and the actions every view uses.
// Views subscribe and re-render whenever anything changes.
(function (root) {
  'use strict';

  const T = root.Tasks;
  const D = root.Dates;
  const { toast } = root.UI;
  const UI_KEY = 'mission-control.ui';

  const listeners = new Set();

  const state = {
    tasks: loadTasks(),
    selectedId: null,
    draftId: null, // a task just made with New Task; dropped if closed before it gets a title
    view: 'list',
    month: null, // first day of the month shown in the calendar; null means this month
    collapsed: { done: true },
    filter: T.EMPTY_FILTER,
    ...loadUi(),
  };

  function loadTasks() {
    try {
      return T.parseTasks(localStorage.getItem(T.STORAGE_KEY));
    } catch {
      return [];
    }
  }

  function loadUi() {
    try {
      const saved = JSON.parse(localStorage.getItem(UI_KEY)) || {};
      return {
        view: saved.view === 'calendar' ? 'calendar' : 'list',
        collapsed: saved.collapsed && typeof saved.collapsed === 'object' ? saved.collapsed : { done: true },
      };
    } catch {
      return {};
    }
  }

  let warnedSaveFailed = false;

  function saveTasks() {
    try {
      localStorage.setItem(T.STORAGE_KEY, JSON.stringify(state.tasks));
      warnedSaveFailed = false;
    } catch {
      if (!warnedSaveFailed) toast("Couldn't save. Changes will be lost when this page closes.");
      warnedSaveFailed = true;
    }
  }

  function saveUi() {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ view: state.view, collapsed: state.collapsed }));
    } catch {
      // Only view preferences; nothing to warn about.
    }
  }

  function emit() {
    listeners.forEach((fn) => fn(state));
  }

  function setTasks(next) {
    if (next === state.tasks) return;
    state.tasks = next;
    saveTasks();
    emit();
  }

  const get = (id) => state.tasks.find((t) => t.id === id) || null;
  const today = () => D.toISODate(new Date());

  function discardDraft() {
    const draft = state.draftId && get(state.draftId);
    if (draft && !draft.title.trim()) {
      state.tasks = T.removeTask(state.tasks, draft.id);
      saveTasks();
    }
    state.draftId = null;
  }

  const Store = {
    state,
    get,

    subscribe(fn) {
      listeners.add(fn);
    },

    select(id) {
      if (state.selectedId === id) return;
      if (state.draftId !== id) discardDraft();
      state.selectedId = id;
      emit();
    },

    // New tasks are due today unless told otherwise, so they land in today's list.
    create(fields = {}) {
      discardDraft();
      const task = T.createTask({ dueDate: today(), ...fields });
      state.tasks = [...state.tasks, task];
      state.draftId = task.id;
      state.selectedId = task.id;
      saveTasks();
      emit();
      return task.id;
    },

    update(id, patch) {
      if (id === state.draftId && patch.title && patch.title.trim()) state.draftId = null;
      setTasks(T.updateTask(state.tasks, id, patch));
    },

    setStatus(id, status) {
      const before = get(id);
      if (!before) return;
      setTasks(T.setStatus(state.tasks, id, status, new Date()));
      const after = get(id);
      if (before.repeat && after.dueDate !== before.dueDate) {
        toast(`"${before.title}" repeats. Next due ${D.formatDate(after.dueDate, today())}.`, {
          action: 'Undo',
          onAction: () => setTasks(T.replaceTask(state.tasks, before)),
        });
      }
    },

    toggleDone(id) {
      const task = get(id);
      if (task) Store.setStatus(id, task.status === 'done' ? 'todo' : 'done');
    },

    remove(id) {
      const index = state.tasks.findIndex((t) => t.id === id);
      if (index < 0) return;
      const task = state.tasks[index];
      if (state.selectedId === id) state.selectedId = null;
      if (state.draftId === id) state.draftId = null;
      setTasks(T.removeTask(state.tasks, id));
      if (task.title.trim()) {
        toast(`Deleted "${task.title}"`, {
          action: 'Undo',
          onAction: () => setTasks(T.insertTask(state.tasks, task, index)),
        });
      }
    },

    addSubtask: (id, title) => setTasks(T.addSubtask(state.tasks, id, title)),
    toggleSubtask: (id, subId) => setTasks(T.toggleSubtask(state.tasks, id, subId)),
    renameSubtask: (id, subId, title) => setTasks(T.renameSubtask(state.tasks, id, subId, title)),
    removeSubtask: (id, subId) => setTasks(T.removeSubtask(state.tasks, id, subId)),

    addAttachment: (id, file) => setTasks(T.addAttachment(state.tasks, id, file)),
    removeAttachment(id, fileId) {
      setTasks(T.removeAttachment(state.tasks, id, fileId));
      root.Attachments.remove(fileId).catch(() => {});
    },

    setView(view) {
      state.view = view;
      saveUi();
      emit();
    },

    toggleGroup(key) {
      state.collapsed = { ...state.collapsed, [key]: !state.collapsed[key] };
      saveUi();
      emit();
    },

    setMonth(iso) {
      state.month = iso;
      emit();
    },

    setFilter(patch) {
      state.filter = { ...state.filter, ...patch };
      emit();
    },

    clearFilter() {
      state.filter = T.EMPTY_FILTER;
      emit();
    },

    addSampleTasks() {
      const now = new Date();
      const day = today();
      const make = (fields) => T.createTask(fields, now);
      const subtasks = (...titles) => titles.map((title) => ({ id: T.newId(), title, done: false }));
      setTasks([
        ...state.tasks,
        make({
          title: 'Pay rent', priority: 'high', dueDate: D.addDays(day, -1), dueTime: '09:00',
          repeat: 'monthly', estimate: 10, notes: 'Transfer to landlord via bank app.',
        }),
        make({ title: 'Call dentist to reschedule', dueDate: day, dueTime: '13:00' }),
        make({
          title: 'Grocery run', priority: 'low', dueDate: day, dueTime: '18:30', estimate: 45,
          subtasks: subtasks('Milk', 'Eggs', 'Bread', 'Coffee'),
        }),
        make({ title: 'Evening walk', priority: 'low', dueDate: day, dueTime: '19:00', repeat: 'daily', estimate: 30 }),
        make({ title: 'Plan weekend trip', dueDate: D.addDays(day, 2), estimate: 60 }),
        make({ title: 'Renew passport', priority: 'high' }),
      ]);
    },
  };

  // Another tab changed the tasks: pick up its version so the tabs don't overwrite each other.
  window.addEventListener('storage', (e) => {
    if (e.key !== T.STORAGE_KEY) return;
    state.tasks = loadTasks();
    if (!get(state.selectedId)) state.selectedId = null;
    emit();
  });

  root.Store = Store;
})(globalThis);
