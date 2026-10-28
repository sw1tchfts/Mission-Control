// The right-hand panel that shows and edits every field of the selected task.
// Text fields are built once per task and never replaced while you type in them;
// everything else is re-rendered from the store on each change.
(function (root) {
  'use strict';

  const { h, cx, icon, renderInto, isEditing, openMenu, openPopover, closePopover, toast, formatSize, autosize } = root.UI;
  const T = root.Tasks;
  const D = root.Dates;
  const Store = root.Store;
  const Files = root.Attachments;

  const STATUS_OPTIONS = T.STATUSES.map((value) => ({ value, label: T.STATUS_LABELS[value], dot: 'status-' + value }));
  const PRIORITY_OPTIONS = T.PRIORITIES.map((value) => ({ value, label: T.PRIORITY_LABELS[value], dot: 'priority-' + value }));
  const REPEAT_OPTIONS = [
    { value: null, label: 'Does not repeat' },
    ...Object.entries(T.REPEAT_LABELS).map(([value, label]) => ({ value, label })),
  ];

  const panel = document.getElementById('detail');
  let shownId = null;
  let parts = null;

  const today = () => D.toISODate(new Date());

  function render(state) {
    const task = Store.get(state.selectedId);
    if (!task) {
      if (shownId) closePopover();
      panel.hidden = true;
      panel.replaceChildren();
      shownId = null;
      parts = null;
      return;
    }
    panel.hidden = false;
    if (task.id !== shownId) {
      closePopover();
      shownId = task.id;
      parts = build(task.id);
      panel.scrollTop = 0;
    }
    fill(task);
  }

  function focusTitle() {
    parts?.title.focus();
  }

  function build(id) {
    const title = h('textarea.detail-title', {
      rows: 1,
      maxLength: 200,
      placeholder: 'Task name',
      'aria-label': 'Task name',
      oninput: () => {
        autosize(title);
        const value = title.value.replace(/\s+/g, ' ').trim();
        if (value) Store.update(id, { title: value });
      },
      onkeydown: (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          title.blur();
        }
      },
      // A task can't be left without a name: an emptied title goes back to the saved one.
      onblur: () => {
        title.value = Store.get(id)?.title ?? '';
        autosize(title);
      },
    });

    const props = h('div.props');
    const subtaskCount = h('span.section-count');
    const subtaskList = h('ul.subtasks');
    const addSubtask = h('input.add-input', { type: 'text', maxLength: 200, placeholder: 'Add subtask', 'aria-label': 'Add subtask' });
    const attachmentList = h('ul.attachments');
    const fileInput = h('input', {
      type: 'file',
      multiple: true,
      hidden: true,
      onchange: async () => {
        for (const file of fileInput.files) await attach(id, file);
        fileInput.value = '';
      },
    });
    const notes = h('textarea.notes', {
      rows: 3,
      placeholder: 'Add notes…',
      'aria-label': 'Notes',
      oninput: () => {
        autosize(notes);
        Store.update(id, { notes: notes.value });
      },
    });

    panel.replaceChildren(
      h(
        'header.detail-header',
        null,
        title,
        h(
          'div.detail-actions',
          null,
          h('button.icon-button.danger', { type: 'button', 'aria-label': 'Delete task', title: 'Delete task', onclick: () => Store.remove(id) }, icon('trash')),
          h('button.icon-button', { type: 'button', 'aria-label': 'Close details', title: 'Close (Esc)', onclick: () => Store.select(null) }, icon('x'))
        )
      ),
      props,
      h('hr.divider'),
      h(
        'section.detail-section',
        null,
        h('h2.section-title', null, 'Subtasks', subtaskCount),
        subtaskList,
        h(
          'form.add-row',
          {
            onsubmit: (e) => {
              e.preventDefault();
              Store.addSubtask(id, addSubtask.value);
              addSubtask.value = '';
            },
          },
          icon('plus'),
          addSubtask
        )
      ),
      h('hr.divider'),
      h(
        'section.detail-section',
        null,
        h('h2.section-title', null, 'Attachments'),
        attachmentList,
        h('button.add-row.add-file', { type: 'button', onclick: () => fileInput.click() }, icon('plus'), 'Add file'),
        fileInput
      ),
      h('hr.divider'),
      h('section.detail-section', null, h('h2.section-title', null, 'Notes'), notes)
    );

    return { title, props, subtaskCount, subtaskList, attachmentList, notes };
  }

  function fill(task) {
    const { title, props, subtaskCount, subtaskList, attachmentList, notes } = parts;
    if (document.activeElement !== title) {
      title.value = task.title;
      autosize(title);
    }
    if (!isEditing(props)) renderInto(props, renderProps(task));

    const done = task.subtasks.filter((s) => s.done).length;
    subtaskCount.textContent = task.subtasks.length ? `${done}/${task.subtasks.length}` : '';
    if (!isEditing(subtaskList)) renderInto(subtaskList, task.subtasks.map((s) => renderSubtask(task.id, s)));

    renderInto(attachmentList, task.attachments.map((file) => renderAttachment(task.id, file)));

    if (document.activeElement !== notes) {
      notes.value = task.notes;
      autosize(notes);
    }
  }

  function prop(label, value) {
    return h('div.prop', null, h('span.prop-label', null, label), h('div.prop-value', null, value));
  }

  function renderProps(task) {
    const due = T.describeDue(task, new Date());
    return [
      prop(
        'Status',
        h(
          'button',
          {
            type: 'button',
            class: cx('pill', 'status-' + task.status),
            'aria-haspopup': 'menu',
            'aria-label': `Status: ${T.STATUS_LABELS[task.status]}`,
            'data-key': 'status',
            onclick: (e) => openMenu(e.currentTarget, STATUS_OPTIONS, task.status, (s) => Store.setStatus(task.id, s)),
          },
          h('span.dot'),
          T.STATUS_LABELS[task.status]
        )
      ),
      prop(
        'Due',
        h(
          'button',
          {
            type: 'button',
            class: cx('pill', 'due-pill', due?.overdue && 'is-overdue', !due && 'is-empty'),
            'aria-haspopup': 'dialog',
            'aria-label': due ? `Due: ${due.date}${due.time ? ' ' + due.time : ''}` : 'Set due date',
            'data-key': 'due',
            onclick: (e) => openDueEditor(e.currentTarget, task.id),
          },
          icon('calendar'),
          due ? [h('span', null, due.date), due.time ? h('span.due-time', null, ` · ${due.time}`) : null] : 'Set due date'
        )
      ),
      prop(
        'Priority',
        h(
          'button',
          {
            type: 'button',
            class: cx('plain', 'priority-' + task.priority),
            'aria-haspopup': 'menu',
            'aria-label': `Priority: ${T.PRIORITY_LABELS[task.priority]}`,
            'data-key': 'priority',
            onclick: (e) => openMenu(e.currentTarget, PRIORITY_OPTIONS, task.priority, (p) => Store.update(task.id, { priority: p })),
          },
          h('span.dot'),
          T.PRIORITY_LABELS[task.priority]
        )
      ),
      h('hr.divider'),
      prop('Estimate', estimateField(task)),
      prop(
        'Repeats',
        h(
          'button',
          {
            type: 'button',
            class: cx('plain', task.repeat ? 'is-repeat' : 'is-empty'),
            'aria-haspopup': 'menu',
            'aria-label': `Repeats: ${task.repeat ? T.REPEAT_LABELS[task.repeat] : 'never'}`,
            'data-key': 'repeat',
            // Repeating needs a start date, so use today if the task has none.
            onclick: (e) =>
              openMenu(e.currentTarget, REPEAT_OPTIONS, task.repeat, (repeat) =>
                Store.update(task.id, repeat ? { repeat, dueDate: task.dueDate || today() } : { repeat: null })
              ),
          },
          icon('repeat'),
          task.repeat ? T.REPEAT_LABELS[task.repeat] : 'Does not repeat'
        )
      ),
    ];
  }

  function estimateField(task) {
    const shown = task.estimate ? T.formatDuration(task.estimate) : '';
    const input = h('input.inline-input', {
      type: 'text',
      value: shown,
      placeholder: 'Add estimate',
      'aria-label': 'Estimate',
      'data-key': 'estimate',
      onchange: () => {
        const text = input.value.trim();
        const minutes = T.parseDuration(text);
        if (text && minutes === null) {
          input.value = shown;
          toast('Try an estimate like 15m, 1h or 1h 30m.');
          return;
        }
        Store.update(task.id, { estimate: minutes });
      },
      onkeydown: (e) => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') input.value = shown; // the app's Escape handler then leaves the field
      },
    });
    return h('label.with-icon', null, icon('clock'), input);
  }

  function openDueEditor(anchor, id) {
    const task = Store.get(id);
    const set = (patch, close) => {
      if (close) closePopover({ restoreFocus: true });
      Store.update(id, patch);
    };
    const date = h('input.field', {
      type: 'date',
      value: task.dueDate || '',
      onchange: () => set({ dueDate: date.value || null }),
    });
    const time = h('input.field', {
      type: 'time',
      value: task.dueTime || '',
      onchange: () => {
        if (!date.value) date.value = today();
        set({ dueDate: date.value, dueTime: time.value || null });
      },
    });
    const quick = (label, days) =>
      h('button.chip', { type: 'button', onclick: () => set({ dueDate: D.addDays(today(), days) }, true) }, label);

    const content = h(
      'div.due-editor',
      null,
      h('div.chip-row', null, quick('Today', 0), quick('Tomorrow', 1), quick('Next week', 7)),
      h('label.field-label', null, 'Date', date),
      h('label.field-label', null, 'Time', time),
      task.dueDate ? h('button.link.danger', { type: 'button', onclick: () => set({ dueDate: null }, true) }, 'Clear due date') : null
    );
    if (openPopover(anchor, content, { className: 'popover-form' })) date.focus();
  }

  function renderSubtask(taskId, sub) {
    const input = h('input.subtask-title', {
      type: 'text',
      value: sub.title,
      maxLength: 200,
      'aria-label': 'Subtask',
      'data-key': 'sub-title:' + sub.id,
      onchange: () => Store.renameSubtask(taskId, sub.id, input.value),
      onkeydown: (e) => {
        if (e.key === 'Enter') input.blur();
      },
      onblur: () => {
        if (!input.value.trim()) input.value = sub.title;
      },
    });
    return h(
      'li',
      { class: cx('subtask', sub.done && 'is-done') },
      h(
        'button.check.check-sm',
        {
          type: 'button',
          role: 'checkbox',
          'aria-checked': String(sub.done),
          'aria-label': `Done: ${sub.title}`,
          'data-key': 'sub-check:' + sub.id,
          onclick: () => Store.toggleSubtask(taskId, sub.id),
        },
        icon('check')
      ),
      input,
      h(
        'button.icon-button.row-remove',
        { type: 'button', 'aria-label': `Remove subtask: ${sub.title}`, onclick: () => Store.removeSubtask(taskId, sub.id) },
        icon('x')
      )
    );
  }

  function renderAttachment(taskId, file) {
    return h(
      'li.attachment',
      null,
      icon('file'),
      h('button.attachment-name', { type: 'button', title: `Download ${file.name}`, onclick: () => download(file) }, file.name),
      h('span.attachment-size', null, formatSize(file.size)),
      h(
        'button.icon-button.row-remove',
        { type: 'button', 'aria-label': `Remove ${file.name}`, onclick: () => Store.removeAttachment(taskId, file.id) },
        icon('x')
      )
    );
  }

  async function attach(taskId, file) {
    const meta = { id: T.newId(), name: file.name, size: file.size, type: file.type };
    try {
      await Files.put(meta.id, file);
      Store.addAttachment(taskId, meta);
    } catch {
      toast(`Couldn't attach "${file.name}". The browser may be out of storage space.`);
    }
  }

  async function download(file) {
    try {
      const blob = await Files.get(file.id);
      if (!blob) throw new Error('missing');
      const url = URL.createObjectURL(blob);
      const link = h('a', { href: url, download: file.name });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast(`Couldn't open "${file.name}". It may have been saved in a different browser.`);
    }
  }

  root.DetailPanel = { render, focusTitle };
})(globalThis);
