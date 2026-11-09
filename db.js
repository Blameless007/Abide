// Abide 2.0 — Local Database Foundation
// Database setup only. Migration comes in a later step.

const DB_NAME = "abide-db";
const DB_VERSION = 1;

const STORES = [
  "appMeta",
  "prayerSchedules",
  "prayerSessions",
  "legacyCheckins",
  "journals",
  "prayerRequests",
  "propheticWords",
  "playlists",
  "audioLibrary",
  "settings",
  "migrationArchive"
];

function openAbideDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("This browser does not support IndexedDB."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      STORES.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, {
            keyPath: "id"
          });
        }
      });
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(
        request.error || new Error("Unable to open Abide database.")
      );
    };

    request.onblocked = () => {
      console.warn(
        "Abide database upgrade is blocked by another open connection."
      );
    };
  });
}

window.AbideDB = {
  open: openAbideDB,
  name: DB_NAME,
  version: DB_VERSION,
  stores: [...STORES]
};
