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

// Abide 2.0 — Safe legacy data migration

async function migrateLegacyData() {
  const db = await openAbideDB();
  const markerId = "legacy-v1-migration";

  try {
    const check = db.transaction("appMeta", "readonly");
    const marker = await new Promise((resolve, reject) => {
      const request = check.objectStore("appMeta").get(markerId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (marker) {
      db.close();
      return { success: true, alreadyMigrated: true };
    }

    const raw = localStorage.getItem("abide.v1.data");
 if (raw === null) {
  db.close();
  return { success: true, noLegacyData: true };
        }
    const oldData = JSON.parse(raw || "{}");

    const schedule = oldData.schedule || [];
    const checkins = oldData.checkins || [];
    const journals = oldData.journals || [];

    if (
      !Array.isArray(schedule) ||
      !Array.isArray(checkins) ||
      !Array.isArray(journals)
    ) {
      throw new Error("Legacy data format is invalid.");
    }

    const tx = db.transaction(
      ["appMeta", "prayerSchedules", "legacyCheckins", "journals", "migrationArchive"],
      "readwrite"
    );

    tx.objectStore("migrationArchive").put({
      id: markerId,
      source: "abide.v1.data",
      originalData: raw,
      archivedAt: new Date().toISOString()
    });

    schedule.forEach(item => {
      if (item && item.id) {
        tx.objectStore("prayerSchedules").put(item);
      }
    });

    checkins.forEach((item, index) => {
      if (item) {
        tx.objectStore("legacyCheckins").put({
          ...item,
          id: `legacy-${index}-${item.day}-${item.id}`,
          prayerId: item.id
        });
      }
    });

    journals.forEach(item => {
      if (item && item.id) {
        tx.objectStore("journals").put(item);
      }
    });

    tx.objectStore("appMeta").put({
      id: markerId,
      status: "completed",
      migratedAt: new Date().toISOString(),
      counts: {
        schedules: schedule.length,
        checkins: checkins.length,
        journals: journals.length
      }
    });

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    db.close();

    return {
      success: true,
      schedules: schedule.length,
      checkins: checkins.length,
      journals: journals.length
    };

  } catch (error) {
    db.close();
    throw error;
  }
}

window.AbideDB.migrateLegacyData = migrateLegacyData;
