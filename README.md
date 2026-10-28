# Mission Control

A very simple task tracker. It runs entirely in your browser with no build step,
no server and no dependencies. Tasks are saved in the browser's `localStorage`,
so they are still there when you come back.

## Use it

Open `index.html` in any modern browser.

- **Add** a task: type it and press Enter (or click **Add**).
- **Finish** a task: tick its checkbox.
- **Edit** a task: double-click its title, then press Enter to save or Escape to cancel.
- **Delete** a task: hover it and click **×**.
- **Filter** with **All**, **Active** and **Done**.
- **Clear done** removes every finished task at once.

Tasks are stored per browser (and per file location), so they do not sync
between devices.

## Project layout

| File | What it does |
|------|--------------|
| `index.html` | The page markup. |
| `styles.css` | Styling, with automatic light and dark themes. |
| `tasks.js` | Pure task-list logic (add, toggle, rename, remove, filter, load). Shared by the page and the tests. |
| `app.js` | Connects the logic to the page and saves to `localStorage`. |
| `tests/` | Unit tests for `tasks.js`. |

## Run the tests

Requires Node.js 18 or newer; there is nothing to install.

```bash
npm test
```
