// The Calendar view: a month grid with each dated task on its day, plus the upcoming
// dates of repeating tasks (shown faded, since they don't exist as separate tasks yet).
(function (root) {
  'use strict';

  const { h, cx, icon, renderInto } = root.UI;
  const T = root.Tasks;
  const D = root.Dates;
  const Store = root.Store;

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function render(container, state) {
    const now = new Date();
    const today = D.toISODate(now);
    const month = state.month || D.startOfMonth(today);
    const days = D.monthGrid(month);
    const visible = state.tasks.filter((t) => T.matchesFilter(t, state.filter));
    const byDay = entriesByDay(visible, days[0], days[days.length - 1]);
    const ctx = { month, today, now, selectedId: state.selectedId };

    renderInto(container, [
      h(
        'div.cal-header',
        null,
        h('h2', null, D.formatMonth(month)),
        h('button.button', { type: 'button', 'data-key': 'cal-today', onclick: () => Store.setMonth(null) }, 'Today'),
        h(
          'button.icon-button',
          { type: 'button', 'aria-label': 'Previous month', 'data-key': 'cal-prev', onclick: () => Store.setMonth(D.addMonths(month, -1)) },
          icon('chevronLeft')
        ),
        h(
          'button.icon-button',
          { type: 'button', 'aria-label': 'Next month', 'data-key': 'cal-next', onclick: () => Store.setMonth(D.addMonths(month, 1)) },
          icon('chevronRight')
        )
      ),
      h(
        'div.cal-grid',
        null,
        WEEKDAYS.map((name) => h('div.cal-weekday', { 'aria-hidden': 'true' }, name)),
        days.map((iso) => renderDay(iso, byDay.get(iso) || [], ctx))
      ),
    ]);
  }

  function entriesByDay(tasks, start, end) {
    const map = new Map();
    const add = (iso, task, projected) => {
      if (!map.has(iso)) map.set(iso, []);
      map.get(iso).push({ task, projected });
    };
    for (const task of tasks) {
      if (!task.dueDate) continue;
      if (task.dueDate >= start && task.dueDate <= end) add(task.dueDate, task, false);
      if (task.repeat && task.status !== 'done') {
        const after = task.dueDate >= start ? task.dueDate : D.addDays(start, -1);
        for (const iso of D.occurrencesAfter(task.anchorDate, task.repeat, after, end)) add(iso, task, true);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.task.dueTime || '99:99').localeCompare(b.task.dueTime || '99:99'));
    }
    return map;
  }

  function renderDay(iso, entries, ctx) {
    return h(
      'div',
      { class: cx('cal-day', iso.slice(0, 7) !== ctx.month.slice(0, 7) && 'is-outside', iso === ctx.today && 'is-today') },
      h(
        'div.cal-day-head',
        null,
        h('span.cal-date', null, String(Number(iso.slice(8)))),
        h(
          'button.icon-button.cal-add',
          {
            type: 'button',
            'aria-label': `New task on ${D.formatDate(iso, ctx.today)}`,
            'data-key': 'cal-add:' + iso,
            onclick: () => root.App.newTask({ dueDate: iso }),
          },
          icon('plus')
        )
      ),
      entries.map(({ task, projected }) => renderChip(task, projected, iso, ctx))
    );
  }

  function renderChip(task, projected, iso, ctx) {
    const name = task.title || 'Untitled task';
    return h(
      'button',
      {
        type: 'button',
        class: cx(
          'cal-task',
          'priority-' + task.priority,
          projected && 'is-projected',
          task.status === 'done' && 'is-done',
          !projected && T.isOverdue(task, ctx.now) && 'is-overdue',
          !projected && task.id === ctx.selectedId && 'is-selected'
        ),
        title: projected ? `${name} (repeats ${T.REPEAT_LABELS[task.repeat].toLowerCase()})` : name,
        'data-key': `cal:${task.id}:${iso}`,
        onclick: () => Store.select(task.id),
      },
      task.dueTime ? h('span.cal-time', null, D.formatTime(task.dueTime)) : null,
      h('span.cal-task-title', null, name)
    );
  }

  root.CalendarView = { render };
})(globalThis);
