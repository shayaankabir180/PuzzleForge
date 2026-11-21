/*
 * PuzzleForge Opening Book
 *
 * Data source: lichess-org/chess-openings (CC0-1.0)
 *
 * Compatibility:
 *   PFReviewBook.identify(sans)
 *   PFReviewBook.lines
 *
 * Additional:
 *   PFReviewBook.ready
 *   PFReviewBook.getBookMoves(sans)
 *   PFReviewBook.isBookMove(sans, nextSan)
 *   PFReviewBook.load(data)
 *   PFReviewBook.getStats()
 *
 * IMPORTANT:
 * - 69-entry local fallback is available immediately.
 * - Full catalogue loads asynchronously.
 * - Await PFReviewBook.ready before analysis if you need
 *   the complete catalogue.
 */
(function (w) {
  "use strict";

  const FALLBACK = [
    { "eco": "C20", "name": "King's Pawn Game", "moves": ["e4", "e5"] },
    { "eco": "C21", "name": "Danish Gambit", "moves": ["e4", "e5", "d4", "exd4", "c3"] },
    { "eco": "C22", "name": "Center Game", "moves": ["e4", "e5", "d4", "exd4"] },
    { "eco": "C23", "name": "Bishop's Opening", "moves": ["e4", "e5", "Bc4"] },
    { "eco": "C25", "name": "Vienna Game", "moves": ["e4", "e5", "Nc3"] },
    { "eco": "C26", "name": "Vienna Game: Falkbeer Variation", "moves": ["e4", "e5", "Nc3", "Nf6"] },
    { "eco": "C30", "name": "King's Gambit", "moves": ["e4", "e5", "f4"] },
    { "eco": "C33", "name": "King's Gambit Accepted", "moves": ["e4", "e5", "f4", "exf4"] },
    { "eco": "C40", "name": "King's Knight Opening", "moves": ["e4", "e5", "Nf3"] },
    { "eco": "C41", "name": "Philidor Defense", "moves": ["e4", "e5", "Nf3", "d6"] },
    { "eco": "C42", "name": "Petrov's Defense", "moves": ["e4", "e5", "Nf3", "Nf6"] },
    { "eco": "C44", "name": "Scotch Game", "moves": ["e4", "e5", "Nf3", "Nc6", "d4"] },
    { "eco": "C45", "name": "Scotch Game: Classical Variation", "moves": ["e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4"] },
    { "eco": "C46", "name": "Three Knights Opening", "moves": ["e4", "e5", "Nf3", "Nc6", "Nc3"] },
    { "eco": "C47", "name": "Four Knights Game", "moves": ["e4", "e5", "Nf3", "Nc6", "Nc3", "Nf6"] },
    { "eco": "C48", "name": "Four Knights: Spanish Variation", "moves": ["e4", "e5", "Nf3", "Nc6", "Nc3", "Nf6", "Bb5"] },
    { "eco": "C50", "name": "Italian Game", "moves": ["e4", "e5", "Nf3", "Nc6", "Bc4"] },
    { "eco": "C51", "name": "Evans Gambit", "moves": ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4"] },
    { "eco": "C53", "name": "Giuoco Piano", "moves": ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"] },
    { "eco": "C55", "name": "Two Knights Defense", "moves": ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"] },
    { "eco": "C60", "name": "Ruy Lopez", "moves": ["e4", "e5", "Nf3", "Nc6", "Bb5"] },
    { "eco": "C65", "name": "Ruy Lopez: Berlin Defense", "moves": ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"] },
    { "eco": "C68", "name": "Ruy Lopez: Exchange Variation", "moves": ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Bxc6"] },
    { "eco": "C70", "name": "Ruy Lopez: Morphy Defense", "moves": ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"] },

    { "eco": "B00", "name": "King's Pawn Opening", "moves": ["e4"] },
    { "eco": "B01", "name": "Scandinavian Defense", "moves": ["e4", "d5"] },
    { "eco": "B02", "name": "Alekhine's Defense", "moves": ["e4", "Nf6"] },
    { "eco": "B06", "name": "Modern Defense", "moves": ["e4", "g6"] },
    { "eco": "B07", "name": "Pirc Defense", "moves": ["e4", "d6", "d4", "Nf6"] },
    { "eco": "B10", "name": "Caro-Kann Defense", "moves": ["e4", "c6"] },
    { "eco": "B12", "name": "Caro-Kann: Advance Variation", "moves": ["e4", "c6", "d4", "d5", "e5"] },
    { "eco": "B15", "name": "Caro-Kann: Gurgenidze Variation", "moves": ["e4", "c6", "d4", "d5", "Nc3"] },
    { "eco": "B20", "name": "Sicilian Defense", "moves": ["e4", "c5"] },
    { "eco": "B21", "name": "Sicilian: Smith-Morra Gambit", "moves": ["e4", "c5", "d4", "cxd4", "c3"] },
    { "eco": "B22", "name": "Sicilian: Alapin Variation", "moves": ["e4", "c5", "c3"] },
    { "eco": "B23", "name": "Sicilian: Closed", "moves": ["e4", "c5", "Nc3"] },
    { "eco": "B27", "name": "Sicilian: Hyperaccelerated Dragon", "moves": ["e4", "c5", "Nf3", "g6"] },
    { "eco": "B30", "name": "Sicilian: Old Sicilian", "moves": ["e4", "c5", "Nf3", "Nc6"] },
    { "eco": "B32", "name": "Sicilian: Open", "moves": ["e4", "c5", "Nf3", "Nc6", "d4"] },
    { "eco": "B33", "name": "Sicilian: Sveshnikov Variation", "moves": ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e5"] },
    { "eco": "B50", "name": "Sicilian: Modern Variation", "moves": ["e4", "c5", "Nf3", "d6"] },
    { "eco": "B90", "name": "Sicilian: Najdorf Variation", "moves": ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"] },

    { "eco": "C00", "name": "French Defense", "moves": ["e4", "e6"] },
    { "eco": "C01", "name": "French: Exchange Variation", "moves": ["e4", "e6", "d4", "d5", "exd5"] },
    { "eco": "C02", "name": "French: Advance Variation", "moves": ["e4", "e6", "d4", "d5", "e5"] },
    { "eco": "C05", "name": "French: Tarrasch Variation", "moves": ["e4", "e6", "d4", "d5", "Nd2"] },

    { "eco": "D00", "name": "Queen's Pawn Game", "moves": ["d4", "d5"] },
    { "eco": "D02", "name": "Queen's Pawn Game: London setup", "moves": ["d4", "d5", "Nf3", "Nf6", "Bf4"] },
    { "eco": "D06", "name": "Queen's Gambit", "moves": ["d4", "d5", "c4"] },
    { "eco": "D10", "name": "Slav Defense", "moves": ["d4", "d5", "c4", "c6"] },
    { "eco": "D20", "name": "Queen's Gambit Accepted", "moves": ["d4", "d5", "c4", "dxc4"] },
    { "eco": "D30", "name": "Queen's Gambit Declined", "moves": ["d4", "d5", "c4", "e6"] },
    { "eco": "D31", "name": "QGD: Semi-Slav setup", "moves": ["d4", "d5", "c4", "e6", "Nc3", "c6"] },
    { "eco": "D35", "name": "QGD: Exchange Variation", "moves": ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "cxd5"] },

    { "eco": "E00", "name": "Catalan Opening", "moves": ["d4", "Nf6", "c4", "e6", "g3"] },
    { "eco": "E20", "name": "Nimzo-Indian Defense", "moves": ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"] },
    { "eco": "E60", "name": "King's Indian Defense", "moves": ["d4", "Nf6", "c4", "g6"] },
    { "eco": "E70", "name": "King's Indian: Normal Variation", "moves": ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4"] },
    { "eco": "E90", "name": "King's Indian: Sämisch setup", "moves": ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "f3"] },

    { "eco": "A04", "name": "Réti Opening", "moves": ["Nf3"] },
    { "eco": "A05", "name": "Réti: King's Indian Attack setup", "moves": ["Nf3", "Nf6", "g3"] },
    { "eco": "A10", "name": "English Opening", "moves": ["c4"] },
    { "eco": "A13", "name": "English: Agincourt Defense", "moves": ["c4", "e6"] },
    { "eco": "A20", "name": "English: King's English", "moves": ["c4", "e5"] },
    { "eco": "A30", "name": "English: Symmetrical", "moves": ["c4", "c5"] },
    { "eco": "A40", "name": "Queen's Pawn Opening", "moves": ["d4"] },
    { "eco": "A45", "name": "Indian Game", "moves": ["d4", "Nf6"] },
    { "eco": "A50", "name": "Indian Defense", "moves": ["d4", "Nf6", "c4"] },
    { "eco": "A80", "name": "Dutch Defense", "moves": ["d4", "f5"] }
  ];

  const SOURCE_FILES = [
    "https://raw.githubusercontent.com/lichess-org/chess-openings/master/a.tsv",
    "https://raw.githubusercontent.com/lichess-org/chess-openings/master/b.tsv",
    "https://raw.githubusercontent.com/lichess-org/chess-openings/master/c.tsv",
    "https://raw.githubusercontent.com/lichess-org/chess-openings/master/d.tsv",
    "https://raw.githubusercontent.com/lichess-org/chess-openings/master/e.tsv"
  ];

  let records = normalizeRecords(FALLBACK);
  let positionIndex = new Map();
  let ready = Promise.resolve(records);
  let sourceStatus = "fallback";

  function cleanSAN(value) {
    return String(value || "")
      .replace(/^\d+\.(?:\.\.)?/, "")
      .replace(/[+#?!]+$/g, "")
      .replace(/[!?]+/g, "")
      .trim();
  }

  function normalizeRecords(data) {
    if (!Array.isArray(data)) return [];

    const seen = new Set();
    const result = [];

    for (const item of data) {
      if (!item || !Array.isArray(item.moves) || !item.moves.length) {
        continue;
      }

      const moves = item.moves.map(cleanSAN).filter(Boolean);
      if (!moves.length) continue;

      const eco = String(item.eco || "").trim();
      const name = String(item.name || "Unknown Opening").trim();
      const key = eco + "|" + name + "|" + moves.join(" ");

      if (seen.has(key)) continue;

      seen.add(key);
      result.push({ eco, name, moves });
    }

    return result;
  }

  function mergeRecords(a, b) {
    return normalizeRecords((a || []).concat(b || []));
  }

  function chessCtor() {
    return typeof w.Chess === "function" ? w.Chess : null;
  }

  function positionKey(chess) {
    try {
      return chess.fen().split(/\s+/).slice(0, 4).join(" ");
    } catch (_) {
      return null;
    }
  }

  function parsePGNLine(pgn) {
    let text = String(pgn || "");

    text = text
      .replace(/\{[^}]*\}/g, " ")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\$\d+/g, " ")
      .replace(/\d+\.(?:\.\.)?/g, " ");

    return text.trim().split(/\s+/)
      .map(cleanSAN)
      .filter(token =>
        token &&
        !/^(1-0|0-1|1\/2-1\/2|\*|e\.p\.)$/i.test(token)
      );
  }

  function parseTSV(text) {
    const rows = String(text || "")
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/);

    const parsed = [];

    for (let i = 1; i < rows.length; i++) {
      if (!rows[i].trim()) continue;

      const cols = rows[i].split("\t");
      if (cols.length < 3) continue;

      const eco = cols[0].trim();
      const name = cols[1].trim();
      const moves = parsePGNLine(cols.slice(2).join("\t"));

      if (eco && name && moves.length) {
        parsed.push({ eco, name, moves });
      }
    }

    return parsed;
  }

  function buildPositionIndex() {
    const C = chessCtor();
    const index = new Map();

    if (!C) {
      positionIndex = index;
      return;
    }

    for (const line of records) {
      let game;

      try {
        game = new C();
      } catch (_) {
        continue;
      }

      for (let ply = 0; ply < line.moves.length; ply++) {
        let moved = null;

        try {
          moved = game.move(line.moves[ply]);
        } catch (_) {}

        if (!moved) break;

        const key = positionKey(game);
        if (!key) continue;

        if (!index.has(key)) {
          index.set(key, []);
        }

        index.get(key).push({
          eco: line.eco,
          name: line.name,
          moves: line.moves.slice(),
          ply: ply + 1
        });
      }
    }

    positionIndex = index;
  }

  function replay(sans) {
    const C = chessCtor();
    if (!C) return null;

    let game;

    try {
      game = new C();
    } catch (_) {
      return null;
    }

    const states = [];

    for (const raw of (sans || [])) {
      const san = cleanSAN(raw);
      let result = null;

      try {
        result = game.move(san);
      } catch (_) {}

      if (!result) return null;

      states.push({
        key: positionKey(game),
        ply: states.length + 1
      });
    }

    return { game, states };
  }

  function identify(sans) {
    const moves = (sans || [])
      .map(cleanSAN)
      .filter(Boolean);

    let best = null;

    // Direct opening-line recognition.
    for (const line of records) {
      if (line.moves.length > moves.length) continue;

      let match = true;

      for (let i = 0; i < line.moves.length; i++) {
        if (line.moves[i] !== moves[i]) {
          match = false;
          break;
        }
      }

      if (match && (!best || line.moves.length > best.ply)) {
        best = {
          eco: line.eco,
          name: line.name,
          moves: line.moves.slice(),
          ply: line.moves.length,
          complete: true,
          transposition: false
        };
      }
    }

    // Transposition recognition.
    const replayed = replay(moves);

    if (replayed && positionIndex.size) {
      for (const state of replayed.states) {
        const candidates = positionIndex.get(state.key);

        if (!candidates || !candidates.length) continue;

        const candidate = candidates[0];

        if (!best || state.ply >= best.ply) {
          best = {
            eco: candidate.eco,
            name: candidate.name,
            moves: moves.slice(0, state.ply),
            ply: state.ply,
            complete: true,
            transposition: true
          };
        }
      }
    }

    return best ? Object.freeze(best) : null;
  }

  function getBookMoves(sans) {
    const moves = (sans || [])
      .map(cleanSAN)
      .filter(Boolean);

    const found = new Map();

    // Find next moves from matching SAN prefixes.
    for (const line of records) {
      if (moves.length >= line.moves.length) continue;

      let match = true;

      for (let i = 0; i < moves.length; i++) {
        if (line.moves[i] !== moves[i]) {
          match = false;
          break;
        }
      }

      if (!match) continue;

      const san = line.moves[moves.length];

      if (!found.has(san)) {
        found.set(san, {
          san,
          frequency: 0,
          openings: new Set(),
          transposition: false
        });
      }

      const item = found.get(san);
      item.frequency++;
      item.openings.add(line.name);
    }

    // Also search by resulting board position.
    const replayed = replay(moves);

    if (replayed && moves.length) {
      const key = positionKey(replayed.game);
      const candidates = positionIndex.get(key) || [];

      for (const line of candidates) {
        const nextSan = line.moves[line.ply];

        if (!nextSan) continue;

        if (!found.has(nextSan)) {
          found.set(nextSan, {
            san: nextSan,
            frequency: 0,
            openings: new Set(),
            transposition: true
          });
        }

        const item = found.get(nextSan);

        item.frequency++;
        item.openings.add(line.name);
        item.transposition = true;
      }
    }

    return Array.from(found.values())
      .sort((a, b) =>
        b.frequency - a.frequency ||
        a.san.localeCompare(b.san)
      )
      .map(item => Object.freeze({
        san: item.san,
        frequency: item.frequency,
        openings: Array.from(item.openings).slice(0, 12),
        transposition: item.transposition
      }));
  }

  function isBookMove(sans, nextSan) {
    const target = cleanSAN(nextSan);

    return getBookMoves(sans)
      .some(item => item.san === target);
  }

  function load(data) {
    records = mergeRecords(FALLBACK, data);

    buildPositionIndex();

    sourceStatus = "custom";
    ready = Promise.resolve(records);

    return ready;
  }

  async function loadRemote() {
    sourceStatus = "loading";

    try {
      const responses = await Promise.all(
        SOURCE_FILES.map(url =>
          fetch(url, { cache: "force-cache" }).then(response => {
            if (!response.ok) {
              throw new Error(
                "Opening source HTTP " + response.status
              );
            }

            return response.text();
          })
        )
      );

      const remote = [];

      for (const tsv of responses) {
        remote.push.apply(remote, parseTSV(tsv));
      }

      if (remote.length < 1000) {
        throw new Error(
          "Opening catalogue unexpectedly small: " + remote.length
        );
      }

      records = mergeRecords(FALLBACK, remote);

      buildPositionIndex();

      sourceStatus = "loaded";

      return records;

    } catch (error) {
      // Fallback remains usable if offline or remote loading fails.
      buildPositionIndex();

      sourceStatus = "fallback";

      return records;
    }
  }

  function getStats() {
    return Object.freeze({
      count: records.length,
      indexedPositions: positionIndex.size,
      status: sourceStatus,
      source: "lichess-org/chess-openings"
    });
  }

  // Build the fallback index immediately.
  buildPositionIndex();

  // Start loading the full remote catalogue.
  ready = loadRemote();

  w.PFReviewBook = Object.freeze({
    identify,
    getBookMoves,
    isBookMove,
    load,

    get ready() {
      return ready;
    },

    get lines() {
      return records.map(line => ({
        eco: line.eco,
        name: line.name,
        moves: line.moves.slice()
      }));
    },

    getStats
  });

})(window);