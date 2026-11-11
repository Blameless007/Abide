
/* ABIDE 2.0 — DAILY CONTENT
   365-day welcome-message cycle.
   KJV Scripture is fetched once per day and saved locally for offline use.
*/
(function () {
  "use strict";

  // v3 starts a fresh daily Scripture cache.
  const STORAGE_KEY = "abide.daily.scriptures.v3";

  const openings = [
    "Begin this day with a quiet confidence in God.",
    "Approach today with prayer before pressure.",
    "Walk into this day remembering that God is with you.",
    "Make room today for what matters most.",
    "Step into today with faith for what lies ahead.",
    "Let this morning be a fresh opportunity to draw near to God.",
    "Choose today to be intentional about your walk with Christ.",
    "Give this day your best, one faithful step at a time.",
    "Enter this new day with a grateful heart.",
    "Take a moment today to be still before God.",
    "Set your heart on things that have eternal value.",
    "Move through today with wisdom, patience, and purpose.",
    "Start again today; yesterday does not have to define you.",
    "Let your spirit be strengthened by the truth of God's Word.",
    "Come before God honestly, just as you are.",
    "Make this moment an opportunity to listen and respond to God.",
    "Remember today that growth is built through daily faithfulness.",
    "Give yourself room to learn, grow, and keep moving forward.",
    "Let your walk with God shape the way you live today.",
    "Face this day with courage, humility, and trust in God.",
    "Embrace this moment as another opportunity to grow.",
    "Set aside time today for prayer and the Word.",
    "Allow today to be guided by truth rather than emotion.",
    "Keep your heart attentive to God's leading.",
    "Let this be a day of steady faith and meaningful action."
  ];

  const endings = [
    "Give God your attention before you give the day your energy.",
    "Let Scripture shape your thoughts, decisions, and actions.",
    "Do the next right thing, even when it feels small.",
    "Remember that consistency matters more than a perfect start.",
    "Make your words reflect the grace you have received.",
    "Choose obedience over convenience when the two disagree.",
    "Be patient with the process while remaining faithful to the work.",
    "Bring your worries to God instead of carrying them alone.",
    "Leave space in your plans for God's direction.",
    "Treat the people you meet with kindness and integrity.",
    "Do not rush past the quiet moments where wisdom can grow.",
    "Give thanks for what you have while preparing faithfully for what is ahead.",
    "Let your private devotion strengthen your public character.",
    "Keep going; faithful steps taken daily build a meaningful life.",
    "End the day able to say that you made room for God."
  ];

  function getDayIndex(date) {
    const dayNumber = Math.floor(
      Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      ) / 86400000
    );

    return ((dayNumber % 365) + 365) % 365;
  }

  function getWelcomeMessage(date) {
    const index = getDayIndex(date);
    const opening = openings[Math.floor(index / endings.length)];
    const ending = endings[index % endings.length];

    return opening + " " + ending;
  }

  function readSavedData() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "null"
      );

      if (!saved || typeof saved !== "object") {
        return {
          daily: {},
          usedReferences: []
        };
      }

      return {
        daily:
          saved.daily && typeof saved.daily === "object"
            ? saved.daily
            : {},

        usedReferences: Array.isArray(saved.usedReferences)
          ? saved.usedReferences
          : []
      };

    } catch (error) {
      console.warn(
        "Abide could not read saved daily Scriptures:",
        error
      );

      return {
        daily: {},
        usedReferences: []
      };
    }
  }

  function saveData(data) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
      );
    } catch (error) {
      console.warn(
        "Abide could not save daily Scripture:",
        error
      );
    }
  }

  function extractVerse(payload) {
    const verse = payload && payload.random_verse;

    if (
      !verse ||
      typeof verse.text !== "string" ||
      !verse.text.trim() ||
      !verse.book ||
      !verse.chapter ||
      !verse.verse
    ) {
      console.error(
        "Abide: Invalid KJV API response:",
        payload
      );

      return null;
    }

    return {
      text: verse.text.trim(),
      ref: `${verse.book} ${verse.chapter}:${verse.verse}`
    };
  }

  async function fetchKJVVerse(usedReferences) {
    const response = await fetch(
      "https://bible-api.com/data/kjv/random",
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `KJV service returned HTTP ${response.status}`
      );
    }

    const payload = await response.json();

    const verse = extractVerse(payload);

    if (!verse) {
      throw new Error(
        "The KJV API response could not be read."
      );
    }

    const alreadyUsed = usedReferences.some(
      ref =>
        String(ref).toLowerCase() ===
        verse.ref.toLowerCase()
    );

    return alreadyUsed ? null : verse;
  }

  async function getForDate(date, fallbackVerse) {
    const today = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");

    const data = readSavedData();
    const welcome = getWelcomeMessage(date);

    // Keep the same Scripture throughout the current day.
    if (
      data.daily[today] &&
      data.daily[today].text &&
      data.daily[today].ref
    ) {
      return {
        welcome,
        scripture: data.daily[today]
      };
    }

    // Try up to eight times to avoid a previously used reference.
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const verse = await fetchKJVVerse(
          data.usedReferences
        );

        if (!verse) continue;

        data.daily[today] = verse;
        data.usedReferences.push(verse.ref);

        saveData(data);

        return {
          welcome,
          scripture: verse
        };

      } catch (error) {
        console.warn(
          "Abide daily Scripture fetch failed:",
          error
        );

        break;
      }
    }

    // Offline fallback: most recently saved Scripture,
    // then the fallback supplied by app.js.
    const savedDates = Object.keys(data.daily).sort().reverse();

    const mostRecentSavedVerse = savedDates.length
      ? data.daily[savedDates[0]]
      : null;

    return {
      welcome,

      scripture:
        mostRecentSavedVerse ||
        fallbackVerse || {
          text: "Be still, and know that I am God.",
          ref: "Psalm 46:10"
        }
    };
  }

  window.AbideDailyContent = {
    getForDate,
    getWelcomeMessage
  };

})();
