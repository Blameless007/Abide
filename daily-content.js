
/* ABIDE 2.0 — DAILY CONTENT
   365 rotating welcome messages.
   KJV Scripture is fetched once per day and saved locally.
*/

(function () {
  "use strict";

  const STORAGE_KEY = "abide.daily.scriptures.v1";

  // 25 openings x 15 endings = 375 unique combinations.
  const openings = [
    "Begin this day",
    "Approach today",
    "Walk into this day",
    "Make room today",
    "Step into today",
    "Let this morning",
    "Choose today",
    "Give this day",
    "Enter this new day",
    "Take a moment today",
    "Set your heart today",
    "Move through today",
    "Start again today",
    "Let your spirit",
    "Come before God today",
    "Make this moment",
    "Remember today",
    "Give yourself permission today",
    "Let your walk with God",
    "Face this day",
    "Embrace this moment",
    "Set aside time today",
    "Allow today",
    "Keep your heart",
    "Let this be a day"
  ];

  const endings = [
    "with a quiet confidence in God.",
    "with prayer before pressure.",
    "with gratitude for another opportunity.",
    "with faith for what lies ahead.",
    "with a heart ready to learn.",
    "with patience for the process.",
    "with courage to obey God.",
    "with your eyes fixed on Christ.",
    "with room for God's direction.",
    "with peace instead of unnecessary worry.",
    "with a willingness to grow.",
    "with wisdom in every decision.",
    "with love in your words and actions.",
    "with discipline in the things that matter.",
    "with expectation for what God can do."
  ];

  function getDayIndex(date) {
    const dayNumber = Math.floor(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
      86400000
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
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
        daily: {},
        usedReferences: []
      };
    } catch (error) {
      return {
        daily: {},
        usedReferences: []
      };
    }
  }

  function saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn("Abide could not save daily Scripture:", error);
    }
  }

  function extractVerse(payload) {
    let verse = null;

    if (Array.isArray(payload.verses) && payload.verses.length) {
      verse = payload.verses[0];
    }

    if (!verse && payload.data && Array.isArray(payload.data.verses)) {
      verse = payload.data.verses[0];
    }

    if (!verse && payload.text && payload.reference) {
      return {
        text: payload.text.trim(),
        ref: payload.reference.trim()
      };
    }

    if (!verse && payload && typeof payload === "object") {
      for (const value of Object.values(payload)) {
        if (value && Array.isArray(value.verses) && value.verses.length) {
          verse = value.verses[0];
          break;
        }
      }
    }

    if (!verse || !verse.text) return null;

    const book = verse.book_name || verse.book || verse.book_id;
    const chapter = verse.chapter;
    const verseNumber = verse.verse;

    if (!book || !chapter || !verseNumber) return null;

    return {
      text: verse.text.trim(),
      ref: `${book} ${chapter}:${verseNumber}`
    };
  }

  async function fetchKJVVerse(usedReferences) {
    const response = await fetch(
      "https://bible-api.com/data/kjv/random",
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("KJV service unavailable");
    }

    const payload = await response.json();
    const verse = extractVerse(payload);

    if (!verse) {
      throw new Error("Unexpected KJV response");
    }

    if (usedReferences.includes(verse.ref.toLowerCase())) {
      return null;
    }

    return verse;
  }

  async function getForDate(date, fallbackVerse) {
    const today = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");

    const data = readSavedData();

    const welcome = getWelcomeMessage(date);

    // Reuse today's saved Scripture if it already exists.
    if (data.daily[today]) {
      return {
        welcome,
        scripture: data.daily[today]
      };
    }

    // Try to obtain a new KJV verse.
    // Previously used references are rejected.
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const verse = await fetchKJVVerse(data.usedReferences);

        if (!verse) continue;

        data.daily[today] = verse;
        data.usedReferences.push(verse.ref.toLowerCase());

        saveData(data);

        return {
          welcome,
          scripture: verse
        };
      } catch (error) {
        console.warn("Abide daily Scripture:", error);
        break;
      }
    }

    // If offline, show today's saved verse if available,
    // otherwise use the existing app Scripture as a fallback.
    return {
      welcome,
      scripture: fallbackVerse || {
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
