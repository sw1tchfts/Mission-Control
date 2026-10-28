const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/tasks.js');

// Wednesday Oct 28 2026, 3 PM local time.
const NOW = new Date(2026, 9, 28, 15, 0);

function task(fields) {
  return T.normalizeTask({ id: fields.title, createdAt: 1, ...fields });
}

function sample() {
  return [
    task({ title: 'Pay rent', priority: 'high', dueDate: '2026-10-27', dueTime: '09:00', repeat: 'monthly' }),
    task({ title: 'Call dentist', dueDate: '2026-10-28', dueTime: '13:00' }),
    task({ title: 'Grocery run', priority: 'low', dueDate: '2026-10-28', dueTime: '18:30' }),
    task({ title: 'Stretch', dueDate: '2026-10-28', dueTime: '08:00', status: 'done' }),
    task({ title: 'Plan trip', dueDate: '2026-10-28' }),
    task({ title: 'Book flights', dueDate: '2026-10-29' }),
    task({ title: 'Renew passport', priority: 'high' }),
  ];
}

const titles = (tasks) => tasks.map((t) => t.title);

test('createTask fills in defaults', () => {
  const t = T.createTask({ title: 'Buy milk' }, NOW);
  assert.equal(t.title, 'Buy milk');
  assert.equal(t.status, 'todo');
  assert.equal(t.priority, 'medium');
  assert.equal(t.dueDate, null);
  assert.deepEqual(t.subtasks, []);
  assert.equal(t.createdAt, NOW.getTime());
  assert.notEqual(T.createTask({}).id, T.createTask({}).id);
});

test('parseTasks migrates tasks saved by the first version', () => {
  const old = JSON.stringify([
    { id: 'a', title: 'Old open task', done: false, createdAt: 5 },
    { id: 'b', title: 'Old done task', done: true, createdAt: 6 },
  ]);
  const [open, done] = T.parseTasks(old);
  assert.equal(open.status, 'todo');
  assert.equal(open.priority, 'medium');
  assert.equal(done.status, 'done');
  assert.equal(done.completedAt, 6);
});

test('parseTasks drops bad data instead of failing', () => {
  assert.deepEqual(T.parseTasks(null), []);
  assert.deepEqual(T.parseTasks('not json'), []);
  assert.deepEqual(T.parseTasks('{"id":"a"}'), []);
  const [t] = T.parseTasks(
    JSON.stringify([
      { id: 'a', title: 'Keep', priority: 'urgent', dueDate: '2026-02-30', dueTime: '09:00', repeat: 'toString', subtasks: [null, { id: 's', title: 'ok' }] },
      { id: 7, title: 'bad id' },
      null,
    ])
  );
  assert.equal(t.priority, 'medium');
  assert.equal(t.dueDate, null);
  assert.equal(t.dueTime, null);
  assert.equal(t.repeat, null);
  assert.deepEqual(t.subtasks, [{ id: 's', title: 'ok', done: false }]);
});

test('parseTasks round-trips saved tasks', () => {
  const tasks = sample();
  assert.deepEqual(T.parseTasks(JSON.stringify(tasks)), tasks);
});

test('updateTask edits fields and returns the same list when nothing changes', () => {
  const tasks = sample();
  const next = T.updateTask(tasks, 'Call dentist', { priority: 'high', notes: 'Ask about Tuesday' });
  assert.equal(next[1].priority, 'high');
  assert.equal(next[1].notes, 'Ask about Tuesday');
  assert.equal(T.updateTask(tasks, 'Call dentist', { priority: 'medium' }), tasks);
  assert.equal(T.updateTask(tasks, 'missing', { priority: 'high' }), tasks);
});

test('updateTask cannot change status and keeps fields consistent', () => {
  const tasks = sample();
  assert.equal(T.updateTask(tasks, 'Call dentist', { status: 'done' }), tasks);
  const cleared = T.updateTask(tasks, 'Pay rent', { dueDate: null });
  assert.equal(cleared[0].dueTime, null);
  assert.equal(cleared[0].repeat, null);
  const moved = T.updateTask(tasks, 'Pay rent', { dueDate: '2026-11-01' });
  assert.equal(moved[0].anchorDate, '2026-11-01');
});

test('completing a task records when, and reopening clears it', () => {
  const done = T.setStatus(sample(), 'Call dentist', 'done', NOW);
  assert.equal(done[1].status, 'done');
  assert.equal(done[1].completedAt, NOW.getTime());
  const reopened = T.toggleDone(done, 'Call dentist', NOW);
  assert.equal(reopened[1].status, 'todo');
  assert.equal(reopened[1].completedAt, null);
  assert.equal(T.setStatus(sample(), 'Call dentist', 'in_progress', NOW)[1].status, 'in_progress');
  assert.equal(T.setStatus(done, 'Call dentist', 'done', NOW), done);
});

test('completing a repeating task rolls it to the next date and resets it', () => {
  let tasks = T.addSubtask(sample(), 'Pay rent', 'Check balance');
  tasks = T.toggleSubtask(tasks, 'Pay rent', tasks[0].subtasks[0].id);
  const [rent] = T.setStatus(tasks, 'Pay rent', 'done', NOW);
  assert.equal(rent.status, 'todo');
  assert.equal(rent.dueDate, '2026-11-27');
  assert.equal(rent.dueTime, '09:00');
  assert.equal(rent.subtasks[0].done, false);
});

test('a daily task completed late moves to tomorrow, not another past day', () => {
  const walk = task({ title: 'Walk', dueDate: '2026-10-20', repeat: 'daily' });
  assert.equal(T.toggleDone([walk], 'Walk', NOW)[0].dueDate, '2026-10-29');
});

test('a repeating task completed early moves one step past its due date', () => {
  const review = task({ title: 'Review', dueDate: '2026-11-04', repeat: 'weekly' });
  assert.equal(T.toggleDone([review], 'Review', NOW)[0].dueDate, '2026-11-11');
});

test('removeTask and insertTask support undo', () => {
  const tasks = sample();
  const removed = T.removeTask(tasks, 'Call dentist');
  assert.equal(removed.length, tasks.length - 1);
  assert.deepEqual(T.insertTask(removed, tasks[1], 1), tasks);
  assert.equal(T.removeTask(tasks, 'missing'), tasks);
});

test('subtasks can be added, toggled, renamed and removed', () => {
  let tasks = T.addSubtask(sample(), 'Grocery run', '  Milk ');
  tasks = T.addSubtask(tasks, 'Grocery run', 'Eggs');
  assert.equal(T.addSubtask(tasks, 'Grocery run', '   '), tasks);
  const [milk, eggs] = tasks[2].subtasks;
  assert.equal(milk.title, 'Milk');

  tasks = T.toggleSubtask(tasks, 'Grocery run', milk.id);
  assert.equal(tasks[2].subtasks[0].done, true);
  tasks = T.renameSubtask(tasks, 'Grocery run', eggs.id, 'A dozen eggs');
  assert.equal(tasks[2].subtasks[1].title, 'A dozen eggs');
  assert.equal(T.renameSubtask(tasks, 'Grocery run', eggs.id, ' '), tasks);
  tasks = T.removeSubtask(tasks, 'Grocery run', milk.id);
  assert.deepEqual(titles(tasks[2].subtasks), ['A dozen eggs']);
});

test('attachments are tracked by id', () => {
  let tasks = T.addAttachment(sample(), 'Pay rent', { id: 'f1', name: 'lease.pdf', size: 1200, type: 'application/pdf' });
  assert.deepEqual(tasks[0].attachments, [{ id: 'f1', name: 'lease.pdf', size: 1200, type: 'application/pdf' }]);
  tasks = T.removeAttachment(tasks, 'Pay rent', 'f1');
  assert.deepEqual(tasks[0].attachments, []);
});

test('updates never mutate the original list', () => {
  const tasks = sample();
  const snapshot = structuredClone(tasks);
  T.updateTask(tasks, 'Pay rent', { title: 'Changed' });
  T.setStatus(tasks, 'Pay rent', 'done', NOW);
  T.addSubtask(tasks, 'Pay rent', 'Sub');
  T.removeTask(tasks, 'Pay rent');
  assert.deepEqual(tasks, snapshot);
});

test('isOverdue covers past days and earlier today', () => {
  const [rent, dentist, groceries, stretch, trip] = sample();
  assert.equal(T.isOverdue(rent, NOW), true);
  assert.equal(T.isOverdue(dentist, NOW), true); // 1 PM, and it is 3 PM
  assert.equal(T.isOverdue(groceries, NOW), false);
  assert.equal(T.isOverdue(stretch, NOW), false); // already done
  assert.equal(T.isOverdue(trip, NOW), false); // today with no time
});

test('describeDue matches the list labels', () => {
  const [rent, , groceries, stretch, , flights] = sample();
  assert.deepEqual(T.describeDue(rent, NOW), { date: '1d overdue', time: '9 AM', overdue: true, today: false });
  assert.deepEqual(T.describeDue(groceries, NOW), { date: 'Today', time: '6:30 PM', overdue: false, today: true });
  assert.equal(T.describeDue(flights, NOW).date, 'Tomorrow');
  assert.equal(T.describeDue(T.updateTask([stretch], stretch.id, { dueDate: '2026-10-20' })[0], NOW).date, 'Oct 20');
  assert.equal(T.describeDue(task({ title: 'x' }), NOW), null);
});

test('groupTasks sorts tasks into sections in display order', () => {
  const groups = T.groupTasks(sample(), NOW);
  assert.deepEqual(
    groups.map((g) => [g.key, titles(g.tasks)]),
    [
      ['overdue', ['Pay rent', 'Call dentist']],
      ['today', ['Plan trip']],
      ['evening', ['Grocery run']],
      ['tomorrow', ['Book flights']],
      ['someday', ['Renew passport']],
      ['done', ['Stretch']],
    ]
  );
  const morning = T.groupTasks(sample(), new Date(2026, 9, 28, 7, 0));
  assert.deepEqual(titles(morning.find((g) => g.key === 'afternoon').tasks), ['Call dentist']);
});

test('countBadges counts overdue and still-to-do-today separately', () => {
  assert.deepEqual(T.countBadges(sample(), NOW), { overdue: 2, today: 2 });
});

test('matchesFilter combines status, priority and search', () => {
  const tasks = T.updateTask(sample(), 'Plan trip', { notes: 'Look at Lisbon' });
  const filter = (f) => titles(tasks.filter((t) => T.matchesFilter(t, { ...T.EMPTY_FILTER, ...f })));
  assert.equal(filter({}).length, tasks.length);
  assert.deepEqual(filter({ priorities: ['high'] }), ['Pay rent', 'Renew passport']);
  assert.deepEqual(filter({ statuses: ['done'] }), ['Stretch']);
  assert.deepEqual(filter({ query: 'lisbon' }), ['Plan trip']);
  assert.deepEqual(filter({ query: 'PAY', priorities: ['low'] }), []);
  assert.equal(T.activeFilterCount({ query: ' x ', statuses: ['todo'], priorities: [] }), 2);
});

test('parseDuration understands common formats', () => {
  assert.equal(T.parseDuration('10'), 10);
  assert.equal(T.parseDuration('10m'), 10);
  assert.equal(T.parseDuration('45 min'), 45);
  assert.equal(T.parseDuration('1h'), 60);
  assert.equal(T.parseDuration('1.5h'), 90);
  assert.equal(T.parseDuration('1h 30m'), 90);
  assert.equal(T.parseDuration('2 hours 5 minutes'), 125);
  assert.equal(T.parseDuration('1:30'), 90);
  assert.equal(T.parseDuration(''), null);
  assert.equal(T.parseDuration('0'), null);
  assert.equal(T.parseDuration('soon'), null);
  assert.equal(T.parseDuration('1h later'), null);
});

test('formatDuration is compact', () => {
  assert.equal(T.formatDuration(10), '10m');
  assert.equal(T.formatDuration(60), '1h');
  assert.equal(T.formatDuration(90), '1h 30m');
});
