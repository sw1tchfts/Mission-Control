// Boots the app: wires the sidebar, toolbar, filter and keyboard shortcuts, and re-renders on every change.
(function (root) {
  'use strict';

  const { h, cx, icon, hydrateIcons, openPopover, closePopover } = root.UI;
  const T = root.Tasks;
  const Store = root.Store;

  hydrateIcons();

  const content = document.getElementById('content');
  const overdueBadge = document.getElementById('badge-overdue');
  const todayBadge = document.getElementById('badge-today');
  const viewButtons = document.querySelectorAll('[data-view]');
  const filterButton = document.getElementById('filter-button');
  const filterCount = document.getElementById('filter-count');

  function render() {
    const state = Store.state;
    const counts = T.countBadges(state.tasks, new Date());
    setBadge(overdueBadge, counts.overdue, 'overdue');
    setBadge(todayBadge, counts.today, 'due today');

    viewButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    const filters = T.activeFilterCount(state.filter);
    filterCount.hidden = filters === 0;
    filterCount.textContent = String(filters);
    filterButton.classList.toggle('is-active', filters > 0);

    if (state.view === 'calendar') root.CalendarView.render(content, state);
    else root.ListView.render(content, state);
    root.DetailPanel.render(state);
  }

  function setBadge(badge, count, label) {
    badge.hidden = count === 0;
    badge.textContent = String(count);
    badge.title = `${count} ${label}`;
  }

  function newTask(fields) {
    Store.create(fields);
    root.DetailPanel.focusTitle();
  }

  function openFilter() {
    const filter = Store.state.filter;
    const search = h('input.field', {
      type: 'search',
      value: filter.query,
      placeholder: 'Search tasks',
      'aria-label': 'Search tasks',
      oninput: () => Store.setFilter({ query: search.value }),
    });
    const toggles = (key, values, labels, dotPrefix) =>
      h(
        'div.chip-row',
        null,
        values.map((value) => {
          const chip = h(
            'button.chip',
            {
              type: 'button',
              'aria-pressed': String(filter[key].includes(value)),
              onclick: () => {
                const current = Store.state.filter[key];
                const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
                chip.setAttribute('aria-pressed', String(next.includes(value)));
                Store.setFilter({ [key]: next });
              },
            },
            h('span', { class: cx('dot', dotPrefix + value) }),
            labels[value]
          );
          return chip;
        })
      );

    const panel = h(
      'div.filter-panel',
      null,
      h('div.search-field', null, icon('search'), search),
      h('div.field-label', null, 'Status'),
      toggles('statuses', T.STATUSES, T.STATUS_LABELS, 'status-'),
      h('div.field-label', null, 'Priority'),
      toggles('priorities', T.PRIORITIES, T.PRIORITY_LABELS, 'priority-'),
      h(
        'button.link',
        {
          type: 'button',
          onclick: () => {
            Store.clearFilter();
            closePopover({ restoreFocus: true });
          },
        },
        'Clear filters'
      )
    );
    if (openPopover(filterButton, panel, { align: 'end', className: 'popover-form' })) search.focus();
  }

  viewButtons.forEach((b) => b.addEventListener('click', () => Store.setView(b.dataset.view)));
  filterButton.addEventListener('click', openFilter);
  document.getElementById('new-task').addEventListener('click', () => newTask());

  // N: new task. /: search. Esc: leave the field you're typing in, or close the task.
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const typing = e.target instanceof Element && e.target.closest('input, textarea, select');
    if (e.key === 'Escape') {
      if (typing) e.target.blur();
      else if (Store.state.selectedId) Store.select(null);
    } else if (!typing && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      newTask();
    } else if (!typing && e.key === '/') {
      e.preventDefault();
      openFilter();
    }
  });

  Store.subscribe(render);
  render();
  // Keep "overdue" and the Morning/Afternoon/Evening sections current as time passes.
  setInterval(render, 60 * 1000);

  // Clean up files left behind by tasks deleted in an earlier session.
  const usedFiles = new Set(Store.state.tasks.flatMap((t) => t.attachments.map((a) => a.id)));
  root.Attachments.removeUnused(usedFiles).catch(() => {});

  root.App = { newTask };
})(globalThis);
