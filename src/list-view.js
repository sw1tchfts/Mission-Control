// The List view: tasks in sections (Overdue, Morning, Afternoon, Evening, ...).
(function (root) {
  'use strict';

  const { h, cx, icon, renderInto, openMenu } = root.UI;
  const T = root.Tasks;
  const Store = root.Store;

  const STATUS_OPTIONS = T.STATUSES.map((value) => ({ value, label: T.STATUS_LABELS[value], dot: 'status-' + value }));

  function render(container, state) {
    if (!state.tasks.length) return renderInto(container, emptyState());
    const now = new Date();
    const groups = T.groupTasks(state.tasks.filter((t) => T.matchesFilter(t, state.filter)), now);
    if (!groups.length) return renderInto(container, noMatches());
    renderInto(container, groups.map((group) => renderGroup(group, state, now)));
  }

  function emptyState() {
    return h(
      'div.empty',
      null,
      h('h2', null, 'No tasks yet'),
      h('p', null, 'Add your first task, or load a few examples to look around.'),
      h(
        'div.empty-actions',
        null,
        h('button.button.button-accent', { type: 'button', onclick: () => root.App.newTask() }, icon('plus'), 'New Task'),
        h('button.button', { type: 'button', onclick: () => Store.addSampleTasks() }, 'Add sample tasks')
      )
    );
  }

  function noMatches() {
    return h(
      'div.empty',
      null,
      h('h2', null, 'Nothing matches'),
      h('p', null, 'No tasks match the current filters.'),
      h('div.empty-actions', null, h('button.button', { type: 'button', onclick: () => Store.clearFilter() }, 'Clear filters'))
    );
  }

  function renderGroup(group, state, now) {
    const collapsed = Boolean(state.collapsed[group.key]);
    return h(
      'section.group',
      null,
      h(
        'button.group-header',
        {
          type: 'button',
          'aria-expanded': String(!collapsed),
          'data-key': 'group:' + group.key,
          onclick: () => Store.toggleGroup(group.key),
        },
        h('span', null, group.label),
        h('span.group-count', null, String(group.tasks.length)),
        icon('chevronDown', 'group-chevron')
      ),
      collapsed ? null : h('ul.task-list', null, group.tasks.map((task) => renderRow(task, state, now)))
    );
  }

  function renderRow(task, state, now) {
    const done = task.status === 'done';
    const name = task.title || 'Untitled task';
    const subtasksDone = task.subtasks.filter((s) => s.done).length;

    return h(
      'li',
      {
        class: cx('task', 'priority-' + task.priority, done && 'is-done', state.selectedId === task.id && 'is-selected'),
        // The whole row opens the task; its own buttons do their own thing.
        onclick: (e) => {
          if (!e.target.closest('button, input, a')) Store.select(task.id);
        },
      },
      h(
        'button.check',
        {
          type: 'button',
          role: 'checkbox',
          'aria-checked': String(done),
          'aria-label': `Done: ${name}`,
          'data-key': 'check:' + task.id,
          onclick: () => Store.toggleDone(task.id),
        },
        icon('check')
      ),
      h(
        'div.task-main',
        null,
        h(
          'button',
          {
            type: 'button',
            class: cx('task-title', !task.title && 'is-untitled'),
            'data-key': 'open:' + task.id,
            onclick: () => Store.select(task.id),
          },
          name
        ),
        renderMeta(task, T.describeDue(task, now))
      ),
      h(
        'div.task-side',
        null,
        h(
          'button',
          {
            type: 'button',
            class: cx('status-pill', 'status-' + task.status),
            'aria-haspopup': 'menu',
            'aria-label': `Status: ${T.STATUS_LABELS[task.status]}`,
            'data-key': 'status:' + task.id,
            onclick: (e) => openMenu(e.currentTarget, STATUS_OPTIONS, task.status, (s) => Store.setStatus(task.id, s)),
          },
          h('span.dot'),
          T.STATUS_LABELS[task.status],
          icon('chevronDown')
        ),
        task.subtasks.length > 0
          ? h(
              'div.progress',
              { title: `${subtasksDone} of ${task.subtasks.length} subtasks done` },
              h(
                'span.progress-track',
                null,
                h('span.progress-fill', { style: `width: ${(subtasksDone / task.subtasks.length) * 100}%` })
              ),
              h('span', null, `${subtasksDone}/${task.subtasks.length}`)
            )
          : null
      ),
      h(
        'button.icon-button.task-delete',
        { type: 'button', 'aria-label': `Delete: ${name}`, 'data-key': 'delete:' + task.id, onclick: () => Store.remove(task.id) },
        icon('trash')
      )
    );
  }

  // Priority (Medium is the default, so it is shown only as the row's edge colour), due date, repeat, files.
  function renderMeta(task, due) {
    const items = [
      task.priority !== 'medium'
        ? h('span', { class: cx('meta', 'meta-priority', 'priority-' + task.priority) }, h('span.dot'), T.PRIORITY_LABELS[task.priority])
        : null,
      due
        ? h(
            'span',
            { class: cx('meta', 'meta-due', due.overdue && 'is-overdue', due.today && 'is-today') },
            icon('calendar'),
            h('strong', null, due.date),
            due.time ? h('span.meta-time', null, ` · ${due.time}`) : null
          )
        : null,
      task.repeat ? h('span.meta.meta-repeat', null, icon('repeat'), T.REPEAT_LABELS[task.repeat]) : null,
      task.attachments.length > 0
        ? h('span.meta', { title: `${task.attachments.length} attached` }, icon('paperclip'), String(task.attachments.length))
        : null,
    ].filter(Boolean);
    return items.length ? h('div.task-meta', null, items) : null;
  }

  root.ListView = { render };
})(globalThis);
