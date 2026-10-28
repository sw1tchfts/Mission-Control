const test = require('node:test');
const assert = require('node:assert/strict');
const Tasks = require('../tasks.js');

function sample() {
  return [
    { id: 'a', title: 'Write report', done: false, createdAt: 1 },
    { id: 'b', title: 'Book flights', done: true, createdAt: 2 },
    { id: 'c', title: 'Call Sam', done: false, createdAt: 3 },
  ];
}

test('addTask appends a trimmed, unfinished task with a unique id', () => {
  const one = Tasks.addTask([], '  Buy milk  ');
  const two = Tasks.addTask(one, 'Walk dog');

  assert.equal(two.length, 2);
  assert.equal(two[0].title, 'Buy milk');
  assert.equal(two[0].done, false);
  assert.equal(typeof two[0].id, 'string');
  assert.notEqual(two[0].id, two[1].id);
});

test('addTask ignores blank titles', () => {
  const tasks = sample();
  assert.equal(Tasks.addTask(tasks, ''), tasks);
  assert.equal(Tasks.addTask(tasks, '   '), tasks);
});

test('toggleTask flips only the matching task', () => {
  const result = Tasks.toggleTask(sample(), 'a');
  assert.deepEqual(
    result.map((t) => t.done),
    [true, true, false]
  );
  assert.equal(Tasks.toggleTask(result, 'a')[0].done, false);
});

test('renameTask trims the new title and keeps the old one when blank', () => {
  assert.equal(Tasks.renameTask(sample(), 'c', '  Call Alex ')[2].title, 'Call Alex');
  assert.equal(Tasks.renameTask(sample(), 'c', '   ')[2].title, 'Call Sam');
});

test('removeTask removes only the matching task', () => {
  assert.deepEqual(
    Tasks.removeTask(sample(), 'b').map((t) => t.id),
    ['a', 'c']
  );
});

test('clearCompleted keeps only unfinished tasks', () => {
  assert.deepEqual(
    Tasks.clearCompleted(sample()).map((t) => t.id),
    ['a', 'c']
  );
});

test('filterTasks returns all, active or done tasks', () => {
  const ids = (filter) => Tasks.filterTasks(sample(), filter).map((t) => t.id);
  assert.deepEqual(ids('all'), ['a', 'b', 'c']);
  assert.deepEqual(ids('active'), ['a', 'c']);
  assert.deepEqual(ids('done'), ['b']);
});

test('updates never mutate the original list', () => {
  const tasks = sample();
  const snapshot = structuredClone(tasks);

  Tasks.addTask(tasks, 'New');
  Tasks.toggleTask(tasks, 'a');
  Tasks.renameTask(tasks, 'a', 'Renamed');
  Tasks.removeTask(tasks, 'a');
  Tasks.clearCompleted(tasks);

  assert.deepEqual(tasks, snapshot);
});

test('parseTasks round-trips saved tasks', () => {
  assert.deepEqual(Tasks.parseTasks(JSON.stringify(sample())), sample());
});

test('parseTasks returns an empty list for missing or bad data', () => {
  assert.deepEqual(Tasks.parseTasks(null), []);
  assert.deepEqual(Tasks.parseTasks('not json'), []);
  assert.deepEqual(Tasks.parseTasks('{"id":"a"}'), []);
});

test('parseTasks drops malformed entries and normalizes fields', () => {
  const json = JSON.stringify([
    { id: 'a', title: 'Keep me', done: 1 },
    { id: 7, title: 'Bad id' },
    { title: 'No id' },
    null,
  ]);
  assert.deepEqual(Tasks.parseTasks(json), [{ id: 'a', title: 'Keep me', done: true, createdAt: 0 }]);
});
