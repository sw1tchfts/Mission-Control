const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/dates.js');

test('validates dates and times', () => {
  assert.equal(D.isValidDate('2026-02-28'), true);
  assert.equal(D.isValidDate('2026-02-30'), false);
  assert.equal(D.isValidDate('2026-2-3'), false);
  assert.equal(D.isValidDate(null), false);
  assert.equal(D.isValidTime('09:30'), true);
  assert.equal(D.isValidTime('24:00'), false);
  assert.equal(D.isValidTime('9:30'), false);
});

test('adds days and months across month and year ends', () => {
  assert.equal(D.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(D.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(D.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(D.addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(D.addMonths('2026-11-15', 2), '2027-01-15');
  assert.equal(D.addMonths('2026-03-31', -1), '2026-02-28');
});

test('counts whole days between dates', () => {
  assert.equal(D.daysBetween('2026-10-27', '2026-10-28'), 1);
  assert.equal(D.daysBetween('2026-10-28', '2026-10-27'), -1);
  assert.equal(D.daysBetween('2026-03-01', '2026-04-01'), 31);
});

test('formats times in 12-hour style', () => {
  assert.equal(D.formatTime('09:00'), '9 AM');
  assert.equal(D.formatTime('13:00'), '1 PM');
  assert.equal(D.formatTime('18:30'), '6:30 PM');
  assert.equal(D.formatTime('00:05'), '12:05 AM');
  assert.equal(D.formatTime('12:00'), '12 PM');
});

test('formats dates relative to today', () => {
  const today = '2026-10-28'; // a Wednesday
  assert.equal(D.formatDate('2026-10-28', today), 'Today');
  assert.equal(D.formatDate('2026-10-29', today), 'Tomorrow');
  assert.equal(D.formatDate('2026-10-27', today), 'Yesterday');
  assert.equal(D.formatDate('2026-10-30', today), 'Fri');
  assert.equal(D.formatDate('2026-11-12', today), 'Nov 12');
  assert.equal(D.formatDate('2027-01-03', today), 'Jan 3, 2027');
  assert.equal(D.formatMonth('2026-10-01'), 'October 2026');
});

test('builds a Sunday-first month grid of whole weeks', () => {
  const days = D.monthGrid('2026-10-15');
  assert.equal(days.length % 7, 0);
  assert.equal(days[0], '2026-09-27');
  assert.equal(days.at(-1), '2026-10-31');
  assert.ok(days.includes('2026-10-01'));
});

test('next occurrence for each repeat rule', () => {
  assert.equal(D.nextOccurrence('2026-10-01', 'daily', '2026-10-28'), '2026-10-29');
  assert.equal(D.nextOccurrence('2026-10-01', 'weekly', '2026-10-28'), '2026-10-29');
  assert.equal(D.nextOccurrence('2026-10-01', 'weekly', '2026-10-29'), '2026-11-05');
  assert.equal(D.nextOccurrence('2026-10-27', 'monthly', '2026-10-28'), '2026-11-27');
  assert.equal(D.nextOccurrence('2026-10-28', 'yearly', '2026-10-28'), '2027-10-28');
  // Friday to Monday
  assert.equal(D.nextOccurrence('2026-10-01', 'weekdays', '2026-10-30'), '2026-11-02');
  // An anchor in the future is itself the next occurrence.
  assert.equal(D.nextOccurrence('2026-12-01', 'monthly', '2026-10-28'), '2026-12-01');
  assert.equal(D.nextOccurrence('2026-10-01', 'nonsense', '2026-10-28'), null);
});

test('monthly and yearly repeats keep their day instead of drifting', () => {
  assert.equal(D.nextOccurrence('2026-01-31', 'monthly', '2026-01-31'), '2026-02-28');
  assert.equal(D.nextOccurrence('2026-01-31', 'monthly', '2026-02-28'), '2026-03-31');
  assert.equal(D.nextOccurrence('2024-02-29', 'yearly', '2024-02-29'), '2025-02-28');
  assert.equal(D.nextOccurrence('2024-02-29', 'yearly', '2027-03-01'), '2028-02-29');
});

test('lists occurrences within a range', () => {
  assert.deepEqual(D.occurrencesAfter('2026-10-01', 'weekly', '2026-10-01', '2026-10-31'), [
    '2026-10-08',
    '2026-10-15',
    '2026-10-22',
    '2026-10-29',
  ]);
  assert.deepEqual(D.occurrencesAfter('2026-10-01', 'monthly', '2026-10-01', '2026-10-31'), []);
});
