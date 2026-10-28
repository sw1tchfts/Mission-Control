# Mission Control

A personal task tracker that runs entirely in your browser: no build step, no server
and no dependencies. Open `index.html` and go.

- **List view** groups tasks into Overdue, Anytime today, Morning, Afternoon, Evening,
  Tomorrow, Upcoming, No date and Completed. Click a section heading to fold it.
- **Calendar view** shows a month at a time, including the upcoming dates of repeating tasks.
- **Details panel** (click any task) edits status, due date and time, priority, estimate,
  repeat, subtasks, attachments and notes.
- **Filter** by status and priority, or search titles, notes and subtasks.
- The sidebar shows how many tasks are **overdue** (red) and **still due today**.

## Using it

| To do this | Do this |
|---|---|
| Add a task | **New Task** (or press **N**). New tasks are due today; change it in the panel. |
| Add a task on a given day | In Calendar view, hover the day and click **+**. |
| Finish a task | Click its circle. |
| Change status | Click the **To Do** pill on the row or in the panel (To Do, In Progress, Done). |
| Search or filter | **Filter** (or press **/**). |
| Close the panel | **×** or **Esc**. |
| Delete | The bin icon on the row or in the panel. You get a few seconds to **Undo**. |

**Priority.** High, Medium (the default) and Low. Each row's left edge shows it
(red, amber, grey); the label is shown for High and Low.

**Repeating tasks.** Choose Daily, Weekdays, Weekly, Monthly or Yearly. When you finish
one, it moves to its next date after today instead of being marked done, and its
subtasks reset. A monthly task on the 31st stays on the last day of shorter months
rather than drifting. **Undo** in the message puts it back.

**Estimates.** Type `15`, `15m`, `1h`, `1.5h`, `1h 30m` or `1:30`.

## Where your data lives

Tasks are saved in the browser's `localStorage` and attached files in IndexedDB, so
everything stays on this computer, in this browser. Nothing is uploaded anywhere, and
nothing syncs between browsers or devices. Several open tabs stay in step with each other.
Clearing the browser's site data deletes your tasks.

Tasks saved by the first version of this app are picked up automatically.

## Project layout

| File | What it does |
|------|--------------|
| `index.html` | Page skeleton and script order. |
| `styles.css` | All styling (dark theme). |
| `src/dates.js` | Date maths and labels: relative dates, month grids, repeat rules. |
| `src/tasks.js` | The task model: validation, edits, completion and repeats, grouping, filtering. |
| `src/ui.js` | DOM helper, icons, menus and popovers, toasts. |
| `src/attachments.js` | Stores attached files in IndexedDB. |
| `src/store.js` | App state, saving, Undo, and the actions the views call. |
| `src/list-view.js` | The grouped list. |
| `src/calendar-view.js` | The month calendar. |
| `src/detail-panel.js` | The task details panel. |
| `src/app.js` | Start-up, sidebar, toolbar, filter and keyboard shortcuts. |
| `tests/` | Unit tests for `dates.js` and `tasks.js`. |

`dates.js` and `tasks.js` have no browser dependencies, which is what lets Node test them.

## Run the tests

Requires Node.js 18 or newer; there is nothing to install.

```bash
npm test
```
