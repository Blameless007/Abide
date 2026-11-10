/* Abide 2.0 — Audio Library
   Uses the existing abide-db / audioLibrary IndexedDB store. */
(() => {
  "use strict";

  const STORE = "audioLibrary";
  let db;
  let currentObjectUrl = null;

  const $ = (id) => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function openDB() {
    if (db) return Promise.resolve(db);
    if (!window.AbideDB?.open) {
      return Promise.reject(new Error("Abide database is not available."));
    }
    return window.AbideDB.open().then((connection) => {
      db = connection;
      if (!db.objectStoreNames.contains(STORE)) {
        throw new Error("Audio storage is missing. Reload Abide and try again.");
      }
      return db;
    });
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getAll() {
    const database = await openDB();
    return requestResult(database.transaction(STORE, "readonly").objectStore(STORE).getAll());
  }

  async function save(item) {
    const database = await openDB();
    return requestResult(database.transaction(STORE, "readwrite").objectStore(STORE).put(item));
  }

  async function remove(id) {
    const database = await openDB();
    return requestResult(database.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
  }

  function platformInfo(rawUrl) {
    let url;
    try { url = new URL(rawUrl); } catch { return null; }
    if (url.protocol !== "https:") return null;

    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be" || host.endsWith("youtube.com")) {
      let videoId = host === "youtu.be" ? url.pathname.slice(1) : "";
      if (!videoId && url.pathname === "/watch") videoId = url.searchParams.get("v") || "";
      if (!videoId && /^\/(embed|shorts)\//.test(url.pathname)) videoId = url.pathname.split("/")[2] || "";
      if (!/^[\w-]{11}$/.test(videoId)) return null;
      return { type: "embed", provider: "YouTube", embed: `https://www.youtube-nocookie.com/embed/${videoId}` };
    }

    if (host === "soundcloud.com" || host.endsWith(".soundcloud.com")) {
      return {
        type: "embed",
        provider: "SoundCloud",
        embed: "https://w.soundcloud.com/player/?url=" + encodeURIComponent(url.href) + "&auto_play=false"
      };
    }

    return { type: "direct", provider: "Audio link", url: url.href };
  }

  function ensureInterface() {
    const main = document.querySelector("main");
    const nav = document.querySelector(".bottom-nav");
    if (!main || !nav || $("audioView")) return;

    const view = document.createElement("section");
    view.className = "view";
    view.id = "audioView";
    view.innerHTML = `
      <div class="page-heading">
        <p class="eyebrow">LISTEN & REFLECT</p>
        <h1>Audio</h1>
        <p class="subtle">Keep your worship, sermons, and other helpful audio in one place.</p>
      </div>
      <article class="audio-player-card">
        <div class="audio-player-art">♫</div>
        <p class="eyebrow">NOW PLAYING</p>
        <h2 id="audioNowTitle">Nothing playing</h2>
        <p id="audioNowType" class="subtle">Choose something from your library.</p>
        <audio id="audioElement" controls preload="metadata"></audio>
        <div id="audioEmbed" class="audio-embed" hidden></div>
        <button class="secondary-button wide" id="audioStop" type="button">Stop playback</button>
        <p id="audioStatus" class="audio-status" role="status" aria-live="polite"></p>
      </article>

      <article class="settings-card">
        <p class="eyebrow">ADD FROM YOUR DEVICE</p>
        <h2>Upload an audio file</h2>
        <form id="audioFileForm" class="audio-form">
          <label for="audioFileTitle">Title</label>
          <input id="audioFileTitle" maxlength="100" placeholder="e.g. Morning worship" required>
          <label for="audioFile">Audio file</label>
          <input id="audioFile" type="file" accept="audio/*" required>
          <button class="primary-button wide" type="submit">Save audio</button>
        </form>
      </article>

      <article class="settings-card">
        <p class="eyebrow">ADD FROM THE WEB</p>
        <h2>Paste an audio link</h2>
        <form id="audioLinkForm" class="audio-form">
          <label for="audioLinkTitle">Title</label>
          <input id="audioLinkTitle" maxlength="100" placeholder="e.g. Sunday message" required>
          <label for="audioLink">YouTube, SoundCloud, or direct HTTPS audio link</label>
          <input id="audioLink" type="url" inputmode="url" placeholder="https://…" required>
          <button class="primary-button wide" type="submit">Add link</button>
        </form>
        <p class="tiny-note">Some platforms restrict playback outside their own app. YouTube and SoundCloud open in an embedded player when supported.</p>
      </article>

      <div class="section-heading audio-library-heading">
        <div><p class="eyebrow">YOUR COLLECTION</p><h2>Audio library</h2></div>
        <span class="count-pill" id="audioCount">0 items</span>
      </div>
      <div id="audioLibraryList" class="audio-library-list"></div>
    `;
    main.appendChild(view);

    const navItem = document.createElement("button");
    navItem.className = "nav-item";
    navItem.type = "button";
    navItem.dataset.view = "audioView";
    navItem.innerHTML = "<span>♫</span><small>Audio</small>";
    const journalNav = [...nav.querySelectorAll(".nav-item")].find((item) => item.dataset.view === "journalView");
    nav.insertBefore(navItem, journalNav || null);

    navItem.addEventListener("click", () => showAudioView());
    $("audioFileForm").addEventListener("submit", addFile);
    $("audioLinkForm").addEventListener("submit", addLink);
    $("audioStop").addEventListener("click", stopPlayback);
  }

  function showAudioView() {
    document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === "audioView"));
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("selected", item.dataset.view === "audioView"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function status(message, isError = false) {
    const el = $("audioStatus");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("is-error", isError);
  }

  async function addFile(event) {
    event.preventDefault();
    const file = $("audioFile").files[0];
    const title = $("audioFileTitle").value.trim();
    if (!file || !title) return;
    if (!file.type.startsWith("audio/")) {
      status("Choose a valid audio file.", true);
      return;
    }
    try {
      await save({
        id: crypto.randomUUID ? crypto.randomUUID() : `audio-${Date.now()}`,
        title, kind: "file", mimeType: file.type, blob: file,
        size: file.size, addedAt: new Date().toISOString()
      });
      event.target.reset();
      status("Audio saved on this device.");
      await renderLibrary();
    } catch (error) {
      status(error.message || "Could not save this file. Device storage may be full.", true);
    }
  }

  async function addLink(event) {
    event.preventDefault();
    const title = $("audioLinkTitle").value.trim();
    const rawUrl = $("audioLink").value.trim();
    const info = platformInfo(rawUrl);
    if (!info) {
      status("Use a valid HTTPS direct audio, YouTube, or SoundCloud link.", true);
      return;
    }
    try {
      await save({
        id: crypto.randomUUID ? crypto.randomUUID() : `audio-${Date.now()}`,
        title, kind: info.type, provider: info.provider,
        url: info.url || rawUrl, embed: info.embed || "",
        addedAt: new Date().toISOString()
      });
      event.target.reset();
      status("Link added to your library.");
      await renderLibrary();
    } catch (error) {
      status(error.message || "Could not save this link.", true);
    }
  }

  async function playItem(item) {
    stopPlayback(false);
    $("audioNowTitle").textContent = item.title;
    $("audioNowType").textContent = item.provider || (item.kind === "file" ? "Device audio" : "Audio link");

    if (item.kind === "file") {
      currentObjectUrl = URL.createObjectURL(item.blob);
      $("audioElement").src = currentObjectUrl;
      $("audioElement").hidden = false;
      $("audioEmbed").hidden = true;
      $("audioElement").play().catch(() => status("Press play to start audio."));
    } else if (item.kind === "embed") {
      $("audioElement").pause();
      $("audioElement").removeAttribute("src");
      $("audioElement").hidden = true;
      $("audioEmbed").hidden = false;
      $("audioEmbed").innerHTML = `<iframe src="${escapeHtml(item.embed)}" title="${escapeHtml(item.provider)} player" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
      status("Use the embedded player controls.");
    } else {
      $("audioElement").src = item.url;
      $("audioElement").hidden = false;
      $("audioEmbed").hidden = true;
      $("audioElement").play().catch(() => status("This link may not allow direct playback. Open it in your browser."));
    }
  }

  function stopPlayback(clearTitle = true) {
    const audio = $("audioElement");
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.hidden = false;
    }
    if ($("audioEmbed")) {
      $("audioEmbed").innerHTML = "";
      $("audioEmbed").hidden = true;
    }
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
    if (clearTitle && $("audioNowTitle")) {
      $("audioNowTitle").textContent = "Nothing playing";
      $("audioNowType").textContent = "Choose something from your library.";
    }
  }

  async function deleteItem(id) {
    if (!window.confirm("Remove this item from your audio library?")) return;
    try {
      await remove(id);
      await renderLibrary();
      status("Item removed.");
    } catch (error) {
      status(error.message || "Could not remove item.", true);
    }
  }

  async function renderLibrary() {
    const list = $("audioLibraryList");
    if (!list) return;
    try {
      const items = (await getAll()).sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""));
      $("audioCount").textContent = `${items.length} ${items.length === 1 ? "item" : "items"}`;
      if (!items.length) {
        list.innerHTML = '<div class="audio-empty">Your library is empty. Add an audio file or link above.</div>';
        return;
      }
      list.innerHTML = items.map((item) => `
        <article class="audio-item">
          <div class="audio-item-info">
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.provider || (item.kind === "file" ? "Device audio" : "Audio link"))}</small>
          </div>
          <div class="audio-item-actions">
            <button class="audio-play-button" type="button" data-play="${escapeHtml(item.id)}">Play</button>
            <button class="audio-delete-button" type="button" data-delete="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.title)}">×</button>
          </div>
        </article>
      `).join("");
      list.querySelectorAll("[data-play]").forEach((button) => {
        button.addEventListener("click", () => {
          const item = items.find((entry) => entry.id === button.dataset.play);
          if (item) playItem(item);
        });
      });
      list.querySelectorAll("[data-delete]").forEach((button) => {
        button.addEventListener("click", () => deleteItem(button.dataset.delete));
      });
    } catch (error) {
      list.innerHTML = '<div class="audio-empty">Audio library could not be opened. Reload Abide and try again.</div>';
      status(error.message || "Audio storage error.", true);
    }
  }

  function init() {
    ensureInterface();
    renderLibrary();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
