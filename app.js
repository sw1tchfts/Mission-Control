// Wires the task list to the page and keeps it saved in localStorage.
(function () {
  'use strict';

  const { STORAGE_KEY, addTask, toggleTask, renameTask, removeTask, clearCompleted, filterTasks, parseTasks } =
    window.Tasks;

  const form = document.getElementById('new-task-form');
  const input = document.getElementById('new-task-input');
  const list = document.getElementById('task-list');
  const empty = document.getElementById('empty');
  const summary = document.getElementById('summary');
  const count = document.getElementById('task-count');
  const clearButton = document.getElementById('clear-done');
  const filterButtons = document.querySelectorAll('[data-filter]');

  const EMPTY_MESSAGES = {
    all: 'No tasks yet. Add one above.',
    active: 'Nothing left to do.',
    done: 'No finished tasks yet.',
  };

  let tasks = load();
  let filter = 'all';

  function load() {
    try {
      return parseTasks(localStorage.getItem(STORAGE_KEY));
    } catch {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // Storage is unavailable (private mode, blocked site data); keep working in memory.
    }
  }

  function update(next) {
    tasks = next;
    save();
    render();
  }

  function render() {
    const visible = filterTasks(tasks, filter);
    list.replaceChildren(...visible.map(renderTask));

    empty.hidden = visible.length > 0;
    empty.textContent = tasks.length === 0 ? EMPTY_MESSAGES.all : EMPTY_MESSAGES[filter];

    const remaining = tasks.filter((t) => !t.done).length;
    summary.hidden = tasks.length === 0;
    count.textContent = `${remaining} ${remaining === 1 ? 'task' : 'tasks'} left`;
    clearButton.hidden = !tasks.some((t) => t.done);

    filterButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
  }

  function renderTask(task) {
    const li = document.createElement('li');
    li.className = task.done ? 'task done' : 'task';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.done;
    checkbox.setAttribute('aria-label', `Done: ${task.title}`);
    checkbox.addEventListener('change', () => update(toggleTask(tasks, task.id)));

    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = task.title;
    title.title = 'Double-click to edit';
    title.addEventListener('dblclick', () => startEditing(title, task));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'delete';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Delete: ${task.title}`);
    remove.addEventListener('click', () => update(removeTask(tasks, task.id)));

    li.append(checkbox, title, remove);
    return li;
  }

  function startEditing(title, task) {
    const field = document.createElement('input');
    field.type = 'text';
    field.className = 'edit';
    field.value = task.title;
    field.maxLength = 200;
    field.setAttribute('aria-label', 'Edit task');

    // Re-rendering removes the field, which fires blur; only act on the first finish.
    let finished = false;
    const finish = (commit) => {
      if (finished) return;
      finished = true;
      if (commit) update(renameTask(tasks, task.id, field.value));
      else render();
    };

    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    });
    field.addEventListener('blur', () => finish(true));

    title.replaceWith(field);
    field.focus();
    field.select();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    update(addTask(tasks, input.value));
    input.value = '';
    input.focus();
  });

  clearButton.addEventListener('click', () => update(clearCompleted(tasks)));

  filterButtons.forEach((b) =>
    b.addEventListener('click', () => {
      filter = b.dataset.filter;
      render();
    })
  );

  // Keep several open tabs in sync instead of letting one overwrite another.
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      tasks = load();
      render();
    }
  });

  render();
})();
