/* Abide 2.0 — Personal Records */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  let db;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);

  const newId = () =>
    crypto.randomUUID ? crypto.randomUUID() : `record-${Date.now()}-${Math.random()}`;

  function openDB() {
    if (db) return Promise.resolve(db);

    return window.AbideDB.open().then(connection => {
      db = connection;

      ["prayerRequests", "propheticWords"].forEach(store => {
        if (!db.objectStoreNames.contains(store)) {
          throw new Error(`${store} storage is missing.`);
        }
      });

      return db;
    });
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getAll(store) {
    const database = await openDB();
    return requestResult(
      database.transaction(store, "readonly")
        .objectStore(store).getAll()
    );
  }

  async function save(store, record) {
    const database = await openDB();
    return requestResult(
      database.transaction(store, "readwrite")
        .objectStore(store).put(record)
    );
  }

  async function remove(store, id) {
    const database = await openDB();
    return requestResult(
      database.transaction(store, "readwrite")
        .objectStore(store).delete(id)
    );
  }

  function dateLabel(value) {
    return value
      ? new Date(value).toLocaleDateString([], { dateStyle: "medium" })
      : "Date not set";
  }

  function ensureInterface() {
    const main = document.querySelector("main");
    const more = $("moreView");

    if (!main || !more || $("recordsView")) return;

    const view = document.createElement("section");
    view.className = "view";
    view.id = "recordsView";

    view.innerHTML = `
      <div class="page-heading">
        <p class="eyebrow">KEEP WHAT MATTERS</p>
        <h1>Personal records</h1>
        <p class="subtle">
          A private place to remember what you're praying about
          and what you believe God has spoken.
        </p>
      </div>

      <div class="records-tabs">
        <button class="records-tab active" data-tab="requests" type="button">
          Prayer requests
        </button>
        <button class="records-tab" data-tab="words" type="button">
          Prophetic words
        </button>
      </div>

      <section class="records-panel active" id="requestPanel">
        <article class="settings-card">
          <p class="eyebrow">BRING IT BEFORE GOD</p>
          <h2>Save a prayer request</h2>

          <form id="requestForm" class="records-form">
            <label for="requestTitle">What are you praying about?</label>
            <input id="requestTitle" maxlength="100"
              placeholder="e.g. Direction concerning my career" required>

            <label for="requestCategory">Category</label>
            <select id="requestCategory">
              <option>Spiritual growth</option>
              <option>Family</option>
              <option>Health</option>
              <option>Work & career</option>
              <option>Finances</option>
              <option>Relationships</option>
              <option>Church & ministry</option>
              <option>Other</option>
            </select>

            <label for="requestDetails">Details (optional)</label>
            <textarea id="requestDetails" rows="4" maxlength="3000"
              placeholder="Add context, prayer points, or Scriptures..."></textarea>

            <button class="primary-button wide" type="submit">
              Save prayer request
            </button>
          </form>
        </article>

        <div class="records-list-heading">
          <h2>Your prayer requests</h2>
          <span class="count-pill" id="requestCount">0</span>
        </div>

        <div id="requestList" class="records-list"></div>
      </section>

      <section class="records-panel" id="wordPanel">
        <article class="settings-card">
          <p class="eyebrow">RECORD WITH CARE</p>
          <h2>Save a prophetic word</h2>

          <p class="records-guidance">
            Preserve the exact wording first. Add your interpretation
            or reflection separately, so the original message is not
            unintentionally changed.
          </p>

          <form id="wordForm" class="records-form">
            <label for="wordText">Original wording</label>
            <textarea id="wordText" rows="5" maxlength="5000"
              placeholder="Record the words as accurately as you remember them..."
              required></textarea>

            <label for="wordDate">Date received (if known)</label>
            <input id="wordDate" type="date">

            <label for="wordSource">Source / context (optional)</label>
            <input id="wordSource" maxlength="160"
              placeholder="e.g. During personal prayer">

            <label for="wordScripture">Scripture references (optional)</label>
            <input id="wordScripture" maxlength="300"
              placeholder="e.g. Isaiah 60:1–3">

            <label for="wordReflection">Personal reflection (optional)</label>
            <textarea id="wordReflection" rows="3" maxlength="3000"
              placeholder="Your thoughts, questions, or discernment..."></textarea>

            <button class="primary-button wide" type="submit">
              Save prophetic word
            </button>
          </form>
        </article>

        <div class="records-list-heading">
          <h2>Recorded words</h2>
          <span class="count-pill" id="wordCount">0</span>
        </div>

        <div id="wordList" class="records-list"></div>
      </section>

      <article class="records-journal-link">
        <div>
          <p class="eyebrow">YOUR REFLECTIONS</p>
          <h2>General journal</h2>
          <p>
            Keep Bible study notes, lessons, and everyday reflections
            in your journal.
          </p>
        </div>
        <button class="secondary-button" id="openGeneralJournal" type="button">
          Open journal
        </button>
      </article>

      <div class="records-footer">
        <button class="secondary-button wide" id="exportRecords" type="button">
          Export personal records
        </button>
        <p class="tiny-note">
          Records are stored in this browser on this device.
          Export a backup before clearing browser data.
        </p>
        <p class="records-status" id="recordsStatus" role="status"></p>
      </div>
    `;

    main.appendChild(view);

    const shortcut = document.createElement("article");
    shortcut.className = "settings-card records-shortcut";

    shortcut.innerHTML = `
      <p class="eyebrow">YOUR PERSONAL RECORDS</p>
      <h2>Prayer requests & prophetic words</h2>
      <p class="subtle">
        Keep track of what you're praying about and preserve
        words you want to reflect on.
      </p>
      <button class="secondary-button wide" id="recordsShortcut" type="button">
        Open personal records
      </button>
    `;

    more.appendChild(shortcut);

    $("recordsShortcut").addEventListener("click", showRecords);
    $("openGeneralJournal").addEventListener("click", showJournal);

    $("requestForm").addEventListener("submit", saveRequest);
    $("wordForm").addEventListener("submit", saveWord);

    $("requestList").addEventListener("click", handleRequestAction);
    $("requestList").addEventListener("change", handleRequestAction);

    $("wordList").addEventListener("click", handleWordAction);
    $("wordList").addEventListener("change", handleWordAction);

    $("exportRecords").addEventListener("click", exportRecords);

    view.querySelectorAll("[data-tab]").forEach(button => {
      button.addEventListener("click", () => switchTab(button.dataset.tab));
    });
  }

  function showRecords() {
    document.querySelectorAll(".view").forEach(view => {
      view.classList.toggle("active", view.id === "recordsView");
    });

    document.querySelectorAll(".nav-item").forEach(button => {
      button.classList.remove("selected");
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
    renderAll();
  }

  function showJournal() {
    if (typeof window.showView === "function") {
      window.showView("journalView");
      return;
    }

    document.querySelectorAll(".view").forEach(view => {
      view.classList.toggle("active", view.id === "journalView");
    });

    document.querySelectorAll(".nav-item").forEach(button => {
      button.classList.toggle(
        "selected",
        button.dataset.view === "journalView"
      );
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function switchTab(tab) {
    const requests = tab === "requests";

    $("requestPanel").classList.toggle("active", requests);
    $("wordPanel").classList.toggle("active", !requests);

    document.querySelectorAll("[data-tab]").forEach(button => {
      button.classList.toggle("active", button.dataset.tab === tab);
    });
  }

  function showStatus(message, error = false) {
    const element = $("recordsStatus");
    if (!element) return;

    element.textContent = message;
    element.classList.toggle("is-error", error);
  }

  async function saveRequest(event) {
    event.preventDefault();

    const title = $("requestTitle").value.trim();
    if (!title) return;

    try {
      await save("prayerRequests", {
        id: newId(),
        title,
        category: $("requestCategory").value,
        details: $("requestDetails").value.trim(),
        status: "Ongoing",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      event.target.reset();
      showStatus("Prayer request saved on this device.");
      await renderRequests();

    } catch (error) {
      showStatus(error.message || "Could not save prayer request.", true);
    }
  }

  async function saveWord(event) {
    event.preventDefault();

    const originalText = $("wordText").value.trim();
    if (!originalText) return;

    try {
      await save("propheticWords", {
        id: newId(),
        originalText,
        receivedDate: $("wordDate").value,
        source: $("wordSource").value.trim(),
        scripture: $("wordScripture").value.trim(),
        reflection: $("wordReflection").value.trim(),
        status: "To reflect on",
        createdAt: new Date().toISOString()
      });

      event.target.reset();
      showStatus("Prophetic word saved. Original wording preserved.");
      await renderWords();

    } catch (error) {
      showStatus(error.message || "Could not save prophetic word.", true);
    }
  }

  async function renderRequests() {
    try {
      const items = (await getAll("prayerRequests")).sort(
        (a, b) => (b.updatedAt || b.createdAt)
          .localeCompare(a.updatedAt || a.createdAt)
      );

      $("requestCount").textContent = items.length;

      $("requestList").innerHTML = items.length
        ? items.map(item => `
          <article class="record-card">
            <div class="record-card-top">
              <span class="record-category">${esc(item.category)}</span>
              <span class="record-date">${dateLabel(item.createdAt)}</span>
            </div>

            <h3>${esc(item.title)}</h3>

            ${item.details
              ? `<p>${esc(item.details).replace(/\n/g, "<br>")}</p>`
              : ""}

            <div class="record-controls">
              <label>
                Status
                <select data-request-status="${esc(item.id)}">
                  ${["Ongoing", "Answered", "Archived"].map(status =>
                    `<option ${item.status === status ? "selected" : ""}>${status}</option>`
                  ).join("")}
                </select>
              </label>

              <button class="record-delete" type="button"
                data-request-delete="${esc(item.id)}">
                Delete
              </button>
            </div>
          </article>
        `).join("")
        : `<div class="empty-state">
            No prayer requests yet. Add one above to keep it in view.
          </div>`;

    } catch (error) {
      showStatus(error.message || "Could not load prayer requests.", true);
    }
  }

  async function renderWords() {
    try {
      const items = (await getAll("propheticWords")).sort(
        (a, b) => (b.receivedDate || b.createdAt)
          .localeCompare(a.receivedDate || a.createdAt)
      );

      $("wordCount").textContent = items.length;

      $("wordList").innerHTML = items.length
        ? items.map(item => `
          <article class="record-card word-record">
            <div class="record-card-top">
              <span class="record-category">Original record</span>
              <span class="record-date">
                ${dateLabel(item.receivedDate || item.createdAt)}
              </span>
            </div>

            <h3>Original wording</h3>

            <blockquote>
              ${esc(item.originalText).replace(/\n/g, "<br>")}
            </blockquote>

            ${item.source
              ? `<p><strong>Source / context:</strong> ${esc(item.source)}</p>`
              : ""}

            ${item.scripture
              ? `<p><strong>Scripture:</strong> ${esc(item.scripture)}</p>`
              : ""}

            ${item.reflection
              ? `<div class="record-reflection">
                  <strong>Personal reflection</strong>
                  <p>${esc(item.reflection).replace(/\n/g, "<br>")}</p>
                </div>`
              : ""}

            <div class="record-controls">
              <label>
                Status
                <select data-word-status="${esc(item.id)}">
                  ${[
                    "To reflect on",
                    "Under prayer",
                    "Fulfilled",
                    "Set aside"
                  ].map(status =>
                    `<option ${item.status === status ? "selected" : ""}>${status}</option>`
                  ).join("")}
                </select>
              </label>

              <button class="record-delete" type="button"
                data-word-delete="${esc(item.id)}">
                Delete
              </button>
            </div>
          </article>
        `).join("")
        : `<div class="empty-state">
            No prophetic words recorded yet.
          </div>`;

    } catch (error) {
      showStatus(error.message || "Could not load prophetic words.", true);
    }
  }

  async function handleRequestAction(event) {
    const statusId = event.target.dataset.requestStatus;
    const deleteId = event.target.dataset.requestDelete;

    try {
      if (statusId) {
        const item = (await getAll("prayerRequests"))
          .find(record => record.id === statusId);

        if (item) {
          item.status = event.target.value;
          item.updatedAt = new Date().toISOString();

          await save("prayerRequests", item);
          showStatus("Prayer request updated.");
          await renderRequests();
        }
      }

      if (deleteId && confirm("Delete this prayer request?")) {
        await remove("prayerRequests", deleteId);
        showStatus("Prayer request deleted.");
        await renderRequests();
      }

    } catch (error) {
      showStatus(error.message || "Could not update this request.", true);
    }
  }

  async function handleWordAction(event) {
    const statusId = event.target.dataset.wordStatus;
    const deleteId = event.target.dataset.wordDelete;

    try {
      if (statusId) {
        const item = (await getAll("propheticWords"))
          .find(record => record.id === statusId);

        if (item) {
          item.status = event.target.value;
          await save("propheticWords", item);

          showStatus("Record status updated.");
          await renderWords();
        }
      }

      if (deleteId && confirm("Delete this prophetic word?")) {
        await remove("propheticWords", deleteId);
        showStatus("Prophetic word deleted.");
        await renderWords();
      }

    } catch (error) {
      showStatus(error.message || "Could not update this record.", true);
    }
  }

  async function renderAll() {
    await Promise.all([renderRequests(), renderWords()]);
  }

  async function exportRecords() {
    try {
      const backup = {
        app: "Abide 2.0 — Personal Records",
        exportedAt: new Date().toISOString(),
        prayerRequests: await getAll("prayerRequests"),
        propheticWords: await getAll("propheticWords")
      };

      const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: "application/json" }
      );

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download =
        `abide-personal-records-${new Date().toISOString().slice(0, 10)}.json`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);

      showStatus("Your personal records backup has been exported.");

    } catch (error) {
      showStatus(error.message || "Could not export records.", true);
    }
  }

  function init() {
    ensureInterface();

    if ($("recordsView")) {
      renderAll();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
