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

    if (!oldData || typeof oldData !== "object" || Array.isArray(oldData)) {
  throw new Error("Legacy data format is invalid.");
}
    
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

    let migratedSchedules = 0;
let migratedCheckins = 0;
let migratedJournals = 0;
    schedule.forEach(item => {
      if (item && item.id) {
        tx.objectStore("prayerSchedules").put(item);
      migratedSchedules++;
      }
    });

    checkins.forEach((item, index) => {
      if (item) {
        tx.objectStore("legacyCheckins").put({
          ...item,
          id: `legacy-${index}-${item.day}-${item.id}`,
          prayerId: item.id
        });
        migratedCheckins++;
      }
    });

    journals.forEach(item => {
      if (item && item.id) {
        tx.objectStore("journals").put(item);
      migratedJournals++;
      }
    });

    tx.objectStore("appMeta").put({
      id: markerId,
      status: "completed",
      migratedAt: new Date().toISOString(),
      counts: {
  schedules: migratedSchedules,
  checkins: migratedCheckins,
  journals: migratedJournals
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
  schedules: migratedSchedules,
  checkins: migratedCheckins,
  journals: migratedJournals
};

  } catch (error) {
    db.close();
    throw error;
  }
}

window.AbideDB.migrateLegacyData = migrateLegacyData;
// Abide 2.0 — Read and save app data

function getAllRecords(db, storeName) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly")
      .objectStore(storeName).getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getRecordById(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly")
      .objectStore(storeName).get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadAppData() {
  const db = await openAbideDB();

  try {
    const [marker, schedule, sessions, legacy, journals] =
      await Promise.all([
        getRecordById(db, "appMeta", "legacy-v1-migration"),
        getAllRecords(db, "prayerSchedules"),
        getAllRecords(db, "prayerSessions"),
        getAllRecords(db, "legacyCheckins"),
        getAllRecords(db, "journals")
      ]);

    if (!marker) {
      const raw = localStorage.getItem("abide.v1.data");
      return raw ? JSON.parse(raw) : null;
    }

    const initialized = await getRecordById(db, "appMeta", "app-data-initialized");
const source = initialized ? sessions : legacy;

    return {
      schedule,
      checkins: source.map(item => ({
        id: item.prayerId || item.id,
        day: item.day,
        at: item.at
      })),
      journals
    };
  } finally {
    db.close();
  }
}

async function saveAppData(data) {
  const db = await openAbideDB();

  try {
    const tx = db.transaction(
      ["appMeta", "prayerSchedules", "prayerSessions", "journals"],
      "readwrite"
    );

    const completed = new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    const schedules = tx.objectStore("prayerSchedules");
    const sessions = tx.objectStore("prayerSessions");
    const journals = tx.objectStore("journals");
    tx.objectStore("appMeta").put({
  id: "app-data-initialized",
  updatedAt: new Date().toISOString()
});

    schedules.clear();
    sessions.clear();
    journals.clear();

    data.schedule.forEach(item => schedules.put(item));

    data.checkins.forEach(item => {
      sessions.put({
        ...item,
        id: `${item.id}-${item.day}`,
        prayerId: item.id
      });
    });

    data.journals.forEach(item => journals.put(item));

    await completed;
  } finally {
    db.close();
  }
}

window.AbideDB.loadAppData = loadAppData;
window.AbideDB.saveAppData = saveAppData;
