/* PuzzleForge — Firebase shared cloud layer
   Google Authentication + per-account Cloud Firestore data.
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

  if (!window.firebase) {
    console.error("PuzzleForge: Firebase SDK was not loaded.");
    return;
  }

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

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

  function readLocal(key, fallback = {}) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeLocal(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("PuzzleForge: local save failed", error);
    }
  }

  function unique(values) {
    return [...new Set(
      (Array.isArray(values) ? values : []).map(String)
    )];
  }

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
    data = data && typeof data === "object" ? data : {};

    const daily = data.dailySolved &&
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
      totalHints: Math.max(0, Number(data.totalHints) || 0),
      totalAttempts: Math.max(0, Number(data.totalAttempts) || 0),
      correctMoves: Math.max(0, Number(data.correctMoves) || 0),
      solvedDates: unique(data.solvedDates),
      dailySolved: cleanDaily,
      currentIndex: Math.max(0, Number(data.currentIndex) || 0)
    };
  }

  function historyKey(record) {
    return [
      record.time || "",
      record.milliseconds || "",
      Array.isArray(record.puzzleIds)
        ? record.puzzleIds.join(",")
        : ""
    ].join("|");
  }

  function mergeWoodpecker(local, cloud) {
    local = local || {};
    cloud = cloud || {};

    const records = new Map();

    [...(cloud.history || []), ...(local.history || [])]
      .forEach(record => {
        if (record && typeof record === "object") {
          records.set(historyKey(record), record);
        }
      });

    const history = [...records.values()]
      .sort((a, b) =>
        new Date(a.date || 0) - new Date(b.date || 0)
      )
      .slice(-20);

    const ls = local.lifetimeStats || {};
    const cs = cloud.lifetimeStats || {};

    const validMin = values => {
      const nums = values
        .map(Number)
        .filter(n => Number.isFinite(n) && n >= 0);

      return nums.length ? Math.min(...nums) : null;
    };

    const lifetimeStats = {
      rounds: Math.max(
        Number(ls.rounds) || 0,
        Number(cs.rounds) || 0
      ),
      puzzles: Math.max(
        Number(ls.puzzles) || 0,
        Number(cs.puzzles) || 0
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

    const allCounts = {
      ...(cloud.puzzleRoundCounts || {}),
      ...(local.puzzleRoundCounts || {})
    };

    Object.keys(allCounts).forEach(id => {
      puzzleRoundCounts[id] = Math.max(
        Number((cloud.puzzleRoundCounts || {})[id]) || 0,
        Number((local.puzzleRoundCounts || {})[id]) || 0
      );
    });

    return {
      history,
      lifetimeStats,
      puzzleRoundCounts
    };
  }

  async function userDoc() {
    if (!currentUser) {
      throw new Error("Please sign in with Google first.");
    }

    return db.collection("users").doc(currentUser.uid);
  }

  async function readCloudData(collectionName) {
    const ref = await userDoc();

    const snapshot = await ref
      .collection("data")
      .doc(collectionName)
      .get();

    return snapshot.exists ? (snapshot.data() || {}) : {};
  }

  async function writeCloudData(collectionName, data) {
    const ref = await userDoc();

    await ref
      .collection("data")
      .doc(collectionName)
      .set(data);
  }

  /*
   * Account-safe progress loading:
   * Existing cloud data is authoritative.
   * Guest data can be imported for a new account.
   * Another account's local data is never imported.
   */

  async function syncProgress() {
    if (!currentUser) return emptyProgress();

    const uid = currentUser.uid;

    if (progressLoadedUid !== uid) {
      const ref = await userDoc();

      const snapshot = await ref
        .collection("data")
        .doc("progress")
        .get();

      let progress;

      if (snapshot.exists) {
        progress = normalizeProgress(snapshot.data());
      } else {
        const cachedOwner = localStorage.getItem(
          PROGRESS_OWNER_KEY
        );

        const localBelongsToAnotherAccount =
          cachedOwner && cachedOwner !== uid;

        progress = localBelongsToAnotherAccount
          ? emptyProgress()
          : normalizeProgress(
              readLocal(PROGRESS_KEY, emptyProgress())
            );

        await ref
          .collection("data")
          .doc("progress")
          .set(progress);
      }

      writeLocal(PROGRESS_KEY, progress);

      localStorage.setItem(PROGRESS_OWNER_KEY, uid);

      progressLoadedUid = uid;

      return progress;
    }

    const progress = normalizeProgress(
      readLocal(PROGRESS_KEY, emptyProgress())
    );

    await writeCloudData("progress", progress);

    return progress;
  }

  async function syncWoodpecker() {
    const local = readLocal(WOODPECKER_KEY);
    const cloud = await readCloudData("woodpecker");

    const merged = mergeWoodpecker(local, cloud);

    writeLocal(WOODPECKER_KEY, merged);

    await writeCloudData("woodpecker", merged);

    return merged;
  }

  async function syncProfile() {
    const local = readLocal(PROFILE_KEY);
    const cloud = await readCloudData("profile");

    const merged = {
      ...cloud,
      ...local
    };

    writeLocal(PROFILE_KEY, merged);

    await writeCloudData("profile", merged);

    return merged;
  }

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
        new CustomEvent("puzzleforge:cloud-synced")
      );

      return true;

    } catch (error) {
      console.error("PuzzleForge cloud sync failed:", error);

      window.dispatchEvent(
        new CustomEvent("puzzleforge:sync-error", {
          detail: error
        })
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

  async function getProgress() {
    await authReady;

    if (
      currentUser &&
      progressLoadedUid !== currentUser.uid
    ) {
      await syncProgress();
    }

    return normalizeProgress(
      readLocal(PROGRESS_KEY, emptyProgress())
    );
  }

  async function saveProgress(progress) {
    const clean = normalizeProgress(progress);

    writeLocal(PROGRESS_KEY, clean);

    if (currentUser) {
      await authReady;

      if (currentUser) {
        if (progressLoadedUid !== currentUser.uid) {
          await syncProgress();
        }

        await writeCloudData("progress", clean);
      }
    }

    return clean;
  }

  async function signIn() {
    try {
      const result = await auth.signInWithPopup(googleProvider);

      return result.user;

    } catch (error) {
      if (
        error.code === "auth/popup-blocked" ||
        error.code === "auth/popup-closed-by-user"
      ) {
        throw error;
      }

      if (error.code === "auth/unauthorized-domain") {
        throw new Error(
          "This website domain is not authorized. Add your GitHub Pages domain in Firebase Authentication settings."
        );
      }

      throw error;
    }
  }

  async function signOut() {
    await auth.signOut();
  }

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
        ? input.moves.map(m => String(m).trim())
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

      gameUrl: String(input.gameUrl || "").trim()
    };

    if (!puzzle.fen) {
      throw new Error("FEN is required.");
    }

    if (puzzle.moves.length < 2) {
      throw new Error("At least two UCI moves are required.");
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
    const doc = db.collection("puzzles").doc();

    await doc.set({
      ...puzzle,
      ownerId: currentUser.uid,
      ownerName: currentUser.displayName || "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
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

    if (snap.data().ownerId !== currentUser.uid) {
      throw new Error(
        "You can only delete puzzles you uploaded."
      );
    }

    await ref.delete();
  }

  function solvedPuzzleDocumentId(puzzleId) {
    return encodeURIComponent(String(puzzleId));
  }

  async function getSolvedPuzzleIds() {
    await authReady;

    const ref = await userDoc();

    const snapshot = await ref
      .collection("solvedPuzzles")
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return String(data.puzzleId || doc.id);
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
      .doc(solvedPuzzleDocumentId(originalId));

    const existing = await docRef.get();

    if (existing.exists) {
      return false;
    }

    await docRef.set({
      puzzleId: originalId,
      solvedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return true;
  }

  auth.onAuthStateChanged(async user => {
    const oldUid = previousUid;

    currentUser = user || null;
    progressLoadedUid = null;

    if (!currentUser && oldUid) {
      try {
        localStorage.removeItem(PROGRESS_KEY);
        localStorage.removeItem(PROGRESS_OWNER_KEY);
      } catch (error) {
        console.warn(
          "Could not clear signed-out progress cache:",
          error
        );
      }
    }

    if (currentUser) {
      previousUid = currentUser.uid;
      await syncNow();
    } else {
      previousUid = null;
    }

    window.dispatchEvent(
      new CustomEvent("puzzleforge:auth", {
        detail: {
          user: currentUser
        }
      })
    );

    authReadyResolve(currentUser);
  });

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