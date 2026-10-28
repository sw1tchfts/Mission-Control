// Stores attached files in IndexedDB (localStorage is far too small for files).
// Tasks only keep each file's id, name, size and type; the bytes live here under that id.
(function (root) {
  'use strict';

  const DB_NAME = 'mission-control';
  const STORE = 'attachments';
  let dbPromise = null;

  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }).catch((error) => {
        dbPromise = null; // let a later call try again
        throw error;
      });
    }
    return dbPromise;
  }

  function run(mode, operation) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, mode);
          const req = operation(tx.objectStore(STORE));
          tx.oncomplete = () => resolve(req.result);
          tx.onerror = tx.onabort = () => reject(tx.error);
        })
    );
  }

  const Attachments = {
    put: (id, blob) => run('readwrite', (store) => store.put(blob, id)),
    get: (id) => run('readonly', (store) => store.get(id)),
    remove: (id) => run('readwrite', (store) => store.delete(id)),

    // Deletes stored files no task refers to any more (for example after a task was deleted).
    removeUnused(usedIds) {
      return run('readonly', (store) => store.getAllKeys()).then((keys) =>
        Promise.all(keys.filter((key) => !usedIds.has(key)).map((key) => Attachments.remove(key)))
      );
    },
  };

  root.Attachments = Attachments;
})(globalThis);
