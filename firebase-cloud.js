
/* PuzzleForge — Firebase shared cloud layer
   Google Authentication + account-isolated Cloud Firestore data.
   Woodpecker statistics are synchronized per Google account.
*/
(function () {
  "use strict";

  const firebaseConfig = {
    apiKey: "AIzaSyDQZyOI668CXUoBf1T9u-Ie-geQtyR1fNQ",
    authDomain: "puzzleforge-19f12.firebaseapp.com",
    projectId: "puzzleforge-19f12",
    storageBucket: "puzzleforge-19f12.firebasestorage.app",
    messagingSenderId: "256070455473",
    appId: "1:256070455473:web:95b213b7d600f137539290"
  };

  const PROGRESS_KEY = "puzzleforge_progress_v1";
  const PROFILE_KEY = "puzzleforge_profile_v1";
  const WOODPECKER_KEY = "puzzleforge_woodpecker_v1";
  const PROGRESS_OWNER_KEY = "puzzleforge_progress_owner_uid_v1";
  const WOODPECKER_OWNER_KEY = "puzzleforge_woodpecker_owner_uid_v1";

  const ACCOUNT_WOODPECKER_PREFIX =
    "puzzleforge_woodpecker_account_";

  const ACCOUNT_PROFILE_PREFIX =
    "puzzleforge_profile_account_";

  if (!window.firebase) {
    console.error("PuzzleForge: Firebase SDK was not loaded.");
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();
  const googleProvider = new firebase.auth.GoogleAuthProvider();

  let currentUser = null;
  let previousUid = null;

  let syncTimer = null;
  let syncInProgress = false;
  let syncAgain = false;
  let progressLoadedUid = null;

  let authReadyResolve;

  const authReady = new Promise(resolve => {
    authReadyResolve = resolve;
  });

  /* ---------------- LOCAL STORAGE ---------------- */

  function readLocal(key, fallback = {}) {
    try {
      const value = JSON.parse(
        localStorage.getItem(key) || "null"
      );

      return value && typeof value === "object"
        ? value
        : fallback;

    } catch (error) {
      return fallback;
    }
  }

  function writeLocal(key, value) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(value)
      );

      return true;

    } catch (error) {
      console.warn(
        "PuzzleForge: local save failed",
        error
      );

      return false;
    }
  }

  function removeLocal(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(error);
    }
  }

  function accountWoodpeckerKey(uid) {
    return ACCOUNT_WOODPECKER_PREFIX + uid;
  }

  function accountProfileKey(uid) {
    return ACCOUNT_PROFILE_PREFIX + uid;
  }

  function unique(values) {
    return [
      ...new Set(
        (Array.isArray(values) ? values : []).map(String)
      )
    ];
  }

  /* ---------------- PROGRESS ---------------- */

  function emptyProgress() {
    return {
      solvedIds: [],
      noHintIds: [],
      totalHints: 0,
      totalAttempts: 0,
      correctMoves: 0,
      solvedDates: [],
      dailySolved: {},
      currentIndex: 0
    };
  }

  function normalizeProgress(data) {
    data = data && typeof data === "object"
      ? data
      : {};

    const daily =
      data.dailySolved &&
      typeof data.dailySolved === "object" &&
      !Array.isArray(data.dailySolved)
        ? data.dailySolved
        : {};

    const cleanDaily = {};

    Object.keys(daily).forEach(date => {
      cleanDaily[String(date)] = Math.max(
        0,
        Number(daily[date]) || 0
      );
    });

    return {
      solvedIds: unique(data.solvedIds),
      noHintIds: unique(data.noHintIds),

      totalHints: Math.max(
        0,
        Number(data.totalHints) || 0
      ),

      totalAttempts: Math.max(
        0,
        Number(data.totalAttempts) || 0
      ),

      correctMoves: Math.max(
        0,
        Number(data.correctMoves) || 0
      ),

      solvedDates: unique(data.solvedDates),

      dailySolved: cleanDaily,

      currentIndex: Math.max(
        0,
        Number(data.currentIndex) || 0
      )
    };
  }

  /* ---------------- WOODPECKER DATA ---------------- */

  function emptyWoodpecker() {
    return {
      history: [],

      lifetimeStats: {
        rounds: 0,
        puzzles: 0,
        bestMilliseconds: null,
        fewestMistakes: null
      },

      puzzleRoundCounts: {}
    };
  }

  function historyKey(record) {
    if (record.roundId) {
      return String(record.roundId);
    }

    return [
      record.date || "",
      record.time || "",
      record.milliseconds || "",
      Array.isArray(record.puzzleIds)
        ? record.puzzleIds.join(",")
        : ""
    ].join("|");
  }

  function normalizeWoodpecker(data) {
    data = data && typeof data === "object"
      ? data
      : {};

    const history = Array.isArray(data.history)
      ? data.history.filter(
          item => item && typeof item === "object"
        )
      : [];

    const stats = data.lifetimeStats || {};

    const counts =
      data.puzzleRoundCounts &&
      typeof data.puzzleRoundCounts === "object" &&
      !Array.isArray(data.puzzleRoundCounts)
        ? data.puzzleRoundCounts
        : {};

    const cleanCounts = {};

    Object.keys(counts).forEach(id => {
      cleanCounts[String(id)] = Math.max(
        0,
        Math.floor(Number(counts[id]) || 0)
      );
    });

    const validMin = values => {
      const nums = values
        .map(Number)
        .filter(
          n => Number.isFinite(n) && n >= 0
        );

      return nums.length
        ? Math.min(...nums)
        : null;
    };

    return {
      history: history
        .slice(-20),

      lifetimeStats: {
        rounds: Math.max(
          0,
          Number(stats.rounds) || 0
        ),

        puzzles: Math.max(
          0,
          Number(stats.puzzles) || 0
        ),

        bestMilliseconds: validMin([
          stats.bestMilliseconds
        ]),

        fewestMistakes: validMin([
          stats.fewestMistakes
        ])
      },

      puzzleRoundCounts: cleanCounts
    };
  }

  function mergeWoodpecker(local, cloud) {
    local = normalizeWoodpecker(local);
    cloud = normalizeWoodpecker(cloud);

    const records = new Map();

    [
      ...cloud.history,
      ...local.history
    ].forEach(record => {
      if (record && typeof record === "object") {
        records.set(historyKey(record), record);
      }
    });

    const history = [
      ...records.values()
    ]
      .sort((a, b) => {
        return (
          new Date(a.date || 0).getTime() -
          new Date(b.date || 0).getTime()
        );
      })
      .slice(-20);

    const ls = local.lifetimeStats;
    const cs = cloud.lifetimeStats;

    const validMin = values => {
      const nums = values
        .map(Number)
        .filter(
          n => Number.isFinite(n) && n >= 0
        );

      return nums.length
        ? Math.min(...nums)
        : null;
    };

    const lifetimeStats = {
      rounds: Math.max(
        ls.rounds,
        cs.rounds
      ),

      puzzles: Math.max(
        ls.puzzles,
        cs.puzzles
      ),

      bestMilliseconds: validMin([
        ls.bestMilliseconds,
        cs.bestMilliseconds
      ]),

      fewestMistakes: validMin([
        ls.fewestMistakes,
        cs.fewestMistakes
      ])
    };

    const puzzleRoundCounts = {};

    const allIds = new Set([
      ...Object.keys(local.puzzleRoundCounts),
      ...Object.keys(cloud.puzzleRoundCounts)
    ]);

    allIds.forEach(id => {
      puzzleRoundCounts[id] = Math.max(
        Number(local.puzzleRoundCounts[id]) || 0,
        Number(cloud.puzzleRoundCounts[id]) || 0
      );
    });

    return {
      history,
      lifetimeStats,
      puzzleRoundCounts
    };
  }

  /* ---------------- FIRESTORE REFERENCES ---------------- */

  async function userDoc() {
    if (!currentUser) {
      throw new Error(
        "Please sign in with Google first."
      );
    }

    return db
      .collection("users")
      .doc(currentUser.uid);
  }

  async function readCloudData(collectionName) {
    const ref = await userDoc();

    const snapshot = await ref
      .collection("data")
      .doc(collectionName)
      .get();

    return snapshot.exists
      ? snapshot.data() || {}
      : {};
  }

  async function writeCloudData(collectionName, data) {
    const ref = await userDoc();

    await ref
      .collection("data")
      .doc(collectionName)
      .set(data);
  }

  /* ---------------- PROGRESS CLOUD SYNC ---------------- */

  async function syncProgress() {
    if (!currentUser) {
      return emptyProgress();
    }

    const uid = currentUser.uid;

    if (progressLoadedUid !== uid) {
      const ref = await userDoc();

      const snapshot = await ref
        .collection("data")
        .doc("progress")
        .get();

      let progress;

      if (snapshot.exists) {
        progress = normalizeProgress(
          snapshot.data()
        );

      } else {
        const cachedOwner = localStorage.getItem(
          PROGRESS_OWNER_KEY
        );

        const belongsToAnotherAccount =
          cachedOwner && cachedOwner !== uid;

        progress = belongsToAnotherAccount
          ? emptyProgress()
          : normalizeProgress(
              readLocal(
                PROGRESS_KEY,
                emptyProgress()
              )
            );

        await ref
          .collection("data")
          .doc("progress")
          .set(progress);
      }

      writeLocal(PROGRESS_KEY, progress);

      localStorage.setItem(
        PROGRESS_OWNER_KEY,
        uid
      );

      progressLoadedUid = uid;

      return progress;
    }

    const progress = normalizeProgress(
      readLocal(PROGRESS_KEY, emptyProgress())
    );

    await writeCloudData("progress", progress);

    return progress;
  }

  /* ---------------- WOODPECKER CLOUD SYNC ---------------- */

  async function syncWoodpecker() {
    if (!currentUser) {
      return emptyWoodpecker();
    }

    const uid = currentUser.uid;

    const owner = localStorage.getItem(
      WOODPECKER_OWNER_KEY
    );

    const accountCache = readLocal(
      accountWoodpeckerKey(uid),
      emptyWoodpecker()
    );

    let local;

    if (owner === uid) {
      // Local data belongs to the currently signed-in account.
      local = readLocal(
        WOODPECKER_KEY,
        accountCache
      );

    } else if (!owner) {
      // First account sign-in: guest data may be imported.
      const guestData = readLocal(
        WOODPECKER_KEY,
        emptyWoodpecker()
      );

      local = mergeWoodpecker(
        guestData,
        accountCache
      );

    } else {
      // Another Gmail previously used this browser.
      // Never import that account's global cache.
      local = accountCache;
    }

    const cloud = await readCloudData(
      "woodpecker"
    );

    const merged = mergeWoodpecker(
      local,
      cloud
    );

    // Maintain a separate local backup for each Gmail.
    writeLocal(
      accountWoodpeckerKey(uid),
      merged
    );

    // Keep compatibility with the existing Woodpecker HTML.
    writeLocal(
      WOODPECKER_KEY,
      merged
    );

    localStorage.setItem(
      WOODPECKER_OWNER_KEY,
      uid
    );

    await writeCloudData(
      "woodpecker",
      merged
    );

    return merged;
  }

  /* ---------------- PROFILE CLOUD SYNC ---------------- */

  async function syncProfile() {
    if (!currentUser) return {};

    const uid = currentUser.uid;

    const accountCache = readLocal(
      accountProfileKey(uid),
      {}
    );

    const owner = localStorage.getItem(
      "puzzleforge_profile_owner_uid_v1"
    );

    let local;

    if (owner === uid) {
      local = readLocal(
        PROFILE_KEY,
        accountCache
      );

    } else {
      local = accountCache;
    }

    const cloud = await readCloudData("profile");

    const merged = {
      ...local,
      ...cloud,
      ...local
    };

    writeLocal(
      accountProfileKey(uid),
      merged
    );

    writeLocal(
      PROFILE_KEY,
      merged
    );

    localStorage.setItem(
      "puzzleforge_profile_owner_uid_v1",
      uid
    );

    await writeCloudData(
      "profile",
      merged
    );

    return merged;
  }

  /* ---------------- MAIN SYNC ---------------- */

  async function syncNow() {
    if (!currentUser) return false;

    if (syncInProgress) {
      syncAgain = true;
      return false;
    }

    syncInProgress = true;

    try {
      do {
        syncAgain = false;

        await Promise.all([
          syncProgress(),
          syncWoodpecker(),
          syncProfile()
        ]);

      } while (syncAgain);

      window.dispatchEvent(
        new CustomEvent(
          "puzzleforge:cloud-synced"
        )
      );

      return true;

    } catch (error) {
      console.error(
        "PuzzleForge cloud sync failed:",
        error
      );

      window.dispatchEvent(
        new CustomEvent(
          "puzzleforge:sync-error",
          {
            detail: error
          }
        )
      );

      return false;

    } finally {
      syncInProgress = false;
    }
  }

  function scheduleSync(delay = 900) {
    if (!currentUser) return;

    clearTimeout(syncTimer);

    syncTimer = setTimeout(() => {
      syncNow();
    }, delay);
  }

  /* ---------------- PROGRESS API ---------------- */

  async function getProgress() {
    await authReady;

    if (
      currentUser &&
      progressLoadedUid !== currentUser.uid
    ) {
      await syncProgress();
    }

    return normalizeProgress(
      readLocal(
        PROGRESS_KEY,
        emptyProgress()
      )
    );
  }

  async function saveProgress(progress) {
    const clean = normalizeProgress(progress);

    writeLocal(PROGRESS_KEY, clean);

    if (currentUser) {
      await authReady;

      if (currentUser) {
        if (
          progressLoadedUid !== currentUser.uid
        ) {
          await syncProgress();
        }

        await writeCloudData(
          "progress",
          clean
        );
      }
    }

    return clean;
  }

  /* ---------------- GOOGLE AUTHENTICATION ---------------- */

  async function signIn() {
    try {
      const result = await auth.signInWithPopup(
        googleProvider
      );

      return result.user;

    } catch (error) {
      if (
        error.code === "auth/popup-blocked" ||
        error.code === "auth/popup-closed-by-user"
      ) {
        throw error;
      }

      if (
        error.code === "auth/unauthorized-domain"
      ) {
        throw new Error(
          "This website domain is not authorized. " +
          "Add your GitHub Pages domain in Firebase " +
          "Authentication settings."
        );
      }

      throw error;
    }
  }

  async function signOut() {
    await auth.signOut();
  }

  /* ---------------- COMMUNITY PUZZLES ---------------- */

  async function getPublicPuzzles() {
    const snapshot = await db
      .collection("puzzles")
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  function cleanPuzzle(input) {
    const puzzle = {
      fen: String(input.fen || "").trim(),

      moves: Array.isArray(input.moves)
        ? input.moves.map(
            m => String(m).trim()
          )
        : String(input.moves || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean),

      rating: Number(input.rating) || 0,

      themes: Array.isArray(input.themes)
        ? input.themes
        : String(input.themes || "")
            .split(",")
            .map(x => x.trim())
            .filter(Boolean),

      gameUrl: String(
        input.gameUrl || ""
      ).trim()
    };

    if (!puzzle.fen) {
      throw new Error("FEN is required.");
    }

    if (puzzle.moves.length < 2) {
      throw new Error(
        "At least two UCI moves are required."
      );
    }

    return puzzle;
  }

  async function uploadPuzzle(input) {
    await authReady;

    if (!currentUser) {
      throw new Error(
        "Sign in with Google before uploading a puzzle."
      );
    }

    const puzzle = cleanPuzzle(input);

    const doc = db
      .collection("puzzles")
      .doc();

    await doc.set({
      ...puzzle,

      ownerId: currentUser.uid,

      ownerName:
        currentUser.displayName || "",

      createdAt:
        firebase.firestore.FieldValue.serverTimestamp()
    });

    return {
      id: doc.id,
      ...puzzle
    };
  }

  async function deletePuzzle(puzzleId) {
    await authReady;

    if (!currentUser) {
      throw new Error("Sign in first.");
    }

    const ref = db
      .collection("puzzles")
      .doc(String(puzzleId));

    const snap = await ref.get();

    if (!snap.exists) {
      throw new Error("Puzzle not found.");
    }

    if (
      snap.data().ownerId !== currentUser.uid
    ) {
      throw new Error(
        "You can only delete puzzles you uploaded."
      );
    }

    await ref.delete();
  }

  /* ---------------- SOLVED PUZZLES ---------------- */

  function solvedPuzzleDocumentId(puzzleId) {
    return encodeURIComponent(
      String(puzzleId)
    );
  }

  async function getSolvedPuzzleIds() {
    await authReady;

    const ref = await userDoc();

    const snapshot = await ref
      .collection("solvedPuzzles")
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data() || {};

      return String(
        data.puzzleId || doc.id
      );
    });
  }

  async function markPuzzleSolved(puzzleId) {
    await authReady;

    if (!currentUser) {
      throw new Error(
        "Sign in to save solved puzzles to your account."
      );
    }

    const originalId = String(puzzleId);

    if (!originalId) {
      throw new Error("Puzzle ID is required.");
    }

    const ref = await userDoc();

    const docRef = ref
      .collection("solvedPuzzles")
      .doc(
        solvedPuzzleDocumentId(originalId)
      );

    const existing = await docRef.get();

    if (existing.exists) {
      return false;
    }

    await docRef.set({
      puzzleId: originalId,

      solvedAt:
        firebase.firestore.FieldValue.serverTimestamp()
    });

    return true;
  }

  /* ---------------- AUTH STATE ---------------- */

  auth.onAuthStateChanged(async user => {
    const oldUid = previousUid;
    const newUid = user ? user.uid : null;

    // Preserve the previous account's local backup
    // before another account becomes active.
    if (oldUid && oldUid !== newUid) {
      writeLocal(
        accountWoodpeckerKey(oldUid),
        readLocal(
          WOODPECKER_KEY,
          emptyWoodpecker()
        )
      );

      writeLocal(
        accountProfileKey(oldUid),
        readLocal(PROFILE_KEY, {})
      );

      removeLocal(WOODPECKER_KEY);
      removeLocal(WOODPECKER_OWNER_KEY);

      removeLocal(PROFILE_KEY);
      removeLocal(
        "puzzleforge_profile_owner_uid_v1"
      );

      removeLocal(PROGRESS_KEY);
      removeLocal(PROGRESS_OWNER_KEY);
    }

    currentUser = user || null;
    progressLoadedUid = null;

    if (currentUser) {
      previousUid = currentUser.uid;

      await syncNow();

    } else {
      previousUid = null;
    }

    window.dispatchEvent(
      new CustomEvent(
        "puzzleforge:auth",
        {
          detail: {
            user: currentUser
          }
        }
      )
    );

    authReadyResolve(currentUser);
  });

  /* ---------------- PUBLIC API ---------------- */

  window.PF = {
    auth,
    db,

    get user() {
      return currentUser;
    },

    authReady,

    signIn,
    signOut,

    syncNow,
    scheduleSync,

    getProgress,
    saveProgress,

    getPublicPuzzles,
    uploadPuzzle,
    deletePuzzle,

    getSolvedPuzzleIds,
    markPuzzleSolved,

    readLocal,
    writeLocal,

    keys: {
      progress: PROGRESS_KEY,
      profile: PROFILE_KEY,
      woodpecker: WOODPECKER_KEY
    }
  };

})();
