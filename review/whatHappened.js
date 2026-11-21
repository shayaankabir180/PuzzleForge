
/*
 * PuzzleForge — What Happened? Tactical Explanation
 * Version: 1.0
 *
 * Explains only facts supported by the resulting legal position, the
 * existing tactical detector, or Stockfish's selected best reply.
 * Requires chess.js 0.10.x to be loaded before this module.
 */
(function (w) {
  "use strict";

  const PIECES = {
    p: "pawn",
    n: "knight",
    b: "bishop",
    r: "rook",
    q: "queen",
    k: "king"
  };

  const KNOWN_TACTICS = {
    fork: "This move creates a fork: one piece attacks multiple targets.",
    pin: "This move creates a pin: moving the attacked piece would expose a more valuable piece behind it.",
    skewer: "This move creates a skewer: the front piece is attacked and moving it exposes a piece behind it.",
    "discovered attack": "This move opens a discovered attack from a second piece.",
    "discovered check": "This move opens a discovered check from another piece.",
    "double check": "This move gives double check: two pieces attack the king at once.",
    "back rank": "This move creates a back-rank threat.",
    "mate threat": "This move creates a checkmate threat.",
    "checkmate threat": "This move creates a checkmate threat."
  };

  function clean(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[!?+#]/g, "")
      .replace(/[_-]+/g, " ")
      .trim();
  }

  function squareName(square) {
    return square || "the target square";
  }

  const VALUE = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 100
  };

  const RAYS = {
    b: [[-1,-1],[-1,1],[1,-1],[1,1]],
    r: [[-1,0],[1,0],[0,-1],[0,1]],
    q: [
      [-1,-1],[-1,1],[1,-1],[1,1],
      [-1,0],[1,0],[0,-1],[0,1]
    ]
  };

  function rc(square) {
    if (!square || !/^[a-h][1-8]$/.test(square)) {
      return null;
    }

    return {
      r: 8 - Number(square[1]),
      c: square.charCodeAt(0) - 97
    };
  }

  function squareAt(r, c) {
    return "abcdefgh"[c] + (8-r);
  }

  function inside(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  function labelPiece(p) {
    return p
      ? ((p.color === "w" ? "White " : "Black ") +
        (PIECES[p.type] || "piece"))
      : "piece";
  }

  function attackedByMovedPiece(board, move) {
    const start = rc(move.to);
    const piece = board[start?.r]?.[start?.c];

    if (!start || !piece || piece.color !== move.color) {
      return [];
    }

    const targets = [];

    const add = (r, c) => {
      if (!inside(r, c)) return false;

      const p = board[r][c];

      if (!p) return true;

      if (p.color !== piece.color) {
        targets.push({
          piece: p,
          square: squareAt(r, c)
        });
      }

      return false;
    };

    if (piece.type === "n") {
      [
        [-2,-1],[-2,1],[-1,-2],[-1,2],
        [1,-2],[1,2],[2,-1],[2,1]
      ].forEach(([dr,dc]) => {
        add(start.r + dr, start.c + dc);
      });

    } else if (piece.type === "k") {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr || dc) {
            add(start.r + dr, start.c + dc);
          }
        }
      }

    } else if (piece.type === "p") {
      const dr = piece.color === "w" ? -1 : 1;

      [-1,1].forEach(dc => {
        const r = start.r + dr;
        const c = start.c + dc;

        if (
          inside(r,c) &&
          board[r][c] &&
          board[r][c].color !== piece.color
        ) {
          targets.push({
            piece: board[r][c],
            square: squareAt(r,c)
          });
        }
      });

    } else {
      (RAYS[piece.type] || []).forEach(([dr,dc]) => {
        let r = start.r + dr;
        let c = start.c + dc;

        while (inside(r,c)) {
          if (!add(r,c)) break;
          r += dr;
          c += dc;
        }
      });
    }

    return targets;
  }

  function lineMotifs(board, move) {
    const out = [];
    const start = rc(move.to);
    const moved = board[start?.r]?.[start?.c];

    if (!start || !moved || !RAYS[moved.type]) {
      return out;
    }

    RAYS[moved.type].forEach(([dr,dc]) => {
      let r = start.r + dr;
      let c = start.c + dc;
      let first = null;

      while (inside(r,c)) {
        const p = board[r][c];

        if (p) {
          if (p.color === moved.color) break;

          if (!first) {
            first = {
              piece: p,
              square: squareAt(r,c)
            };

          } else if (p.color !== moved.color) {

            if (p.type === "k") {
              out.push(
                "The moved " +
                (PIECES[moved.type] || "piece") +
                " pins the " +
                (PIECES[first.piece.type] || "piece") +
                " on " + first.square + " to the king."
              );

            } else if (
              VALUE[p.type] > VALUE[first.piece.type]
            ) {
              out.push(
                "The moved " +
                (PIECES[moved.type] || "piece") +
                " creates a pin against the " +
                (PIECES[first.piece.type] || "piece") +
                " on " + first.square +
                ", with the " +
                (PIECES[p.type] || "piece") +
                " behind it."
              );

            } else if (
              VALUE[first.piece.type] > VALUE[p.type]
            ) {
              out.push(
                "The moved " +
                (PIECES[moved.type] || "piece") +
                " creates a skewer pattern: the " +
                (PIECES[first.piece.type] || "piece") +
                " on " + first.square +
                " is in front of the " +
                (PIECES[p.type] || "piece") + "."
              );
            }

            break;
          }
        }

        r += dr;
        c += dc;
      }
    });

    return out;
  }

  function discoveredMotifs(beforeBoard, afterBoard, move) {
    const vacated = rc(move.from);
    const out = [];

    if (!vacated) return out;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const slider = afterBoard[r][c];

        if (
          !slider ||
          slider.color !== move.color ||
          !RAYS[slider.type]
        ) {
          continue;
        }

        RAYS[slider.type].forEach(([dr,dc]) => {
          let y = r + dr;
          let x = c + dc;
          let passedFrom = false;

          while (inside(y,x)) {
            if (y === vacated.r && x === vacated.c) {
              passedFrom = true;
            }

            const target = afterBoard[y][x];

            if (target) {
              if (passedFrom && target.color !== move.color) {
                const beforeBlock =
                  beforeBoard[vacated.r]?.[vacated.c];

                if (
                  beforeBlock &&
                  beforeBlock.color === move.color &&
                  beforeBlock.type === move.piece
                ) {
                  out.push(
                    target.type === "k"
                      ? "Moving this piece uncovered a discovered check against the king."
                      : "Moving this piece uncovered a discovered attack on the " +
                        (PIECES[target.type] || "piece") +
                        " on " + squareAt(y,x) + "."
                  );
                }
              }

              break;
            }

            y += dr;
            x += dc;
          }
        });
      }
    }

    return [...new Set(out)];
  }

  function explain(data) {
    data = data || {};

    const facts = [];
    const tags = Array.isArray(data.tags) ? data.tags : [];
    const move = data.move || null;
    const reply = data.reply || null;

    let afterGame = null;

    if (typeof w.Chess === "function" && data.afterFen) {
      try {
        afterGame = new w.Chess(data.afterFen);
      } catch (_) {}
    }

    if (afterGame && move) {
      try {
        const board = afterGame.board();
        const targets = attackedByMovedPiece(board, move);

        if (targets.length >= 2) {
          const names = targets.map(t =>
            (PIECES[t.piece.type] || "piece") +
            " on " + t.square
          );

          facts.push(
            "Fork candidate: your " +
            (PIECES[move.piece] || "piece") +
            " on " + move.to +
            " attacks " +
            names.slice(0,3).join(" and ") +
            " at the same time."
          );
        }

        facts.push(...lineMotifs(board, move));

        if (data.beforeFen) {
          const beforeGame = new w.Chess(data.beforeFen);

          facts.push(
            ...discoveredMotifs(
              beforeGame.board(),
              board,
              move
            )
          );
        }

      } catch (e) {
        /* Keep explanation conservative if inspection fails. */
      }
    }

    // Direct consequences of the played move.
    if (move && move.captured) {
      facts.push(
        "You captured the opponent's " +
        (PIECES[move.captured] || "piece") +
        " with " + move.san + "."
      );
    }

    if (move && move.promotion) {
      facts.push(
        "Your pawn promoted to a " +
        (PIECES[move.promotion] || "new piece") + "."
      );
    }

    if (afterGame) {
      try {
        if (afterGame.in_checkmate()) {
          facts.unshift(
            "Checkmate! " +
            (move ? move.san : "This move") +
            " ends the game; the opponent has no legal response."
          );

          return facts;
        }

        if (afterGame.in_check()) {
          facts.unshift(
            "Check! Your move attacks the opponent's king, " +
            "so the next move must answer the check."
          );
        }

        const legal = afterGame.moves({ verbose: true });

        if (legal.length === 1) {
          facts.push(
            "The opponent has only one legal move: " +
            legal[0].san +
            ". This is a forced response in the current position."
          );

        } else if (
          legal.length === 0 &&
          !afterGame.in_stalemate()
        ) {
          facts.push(
            "There are no legal moves in this position."
          );
        }

      } catch (_) {}
    }

    // Existing tacticalDetector.js remains the source of motif tags.
    const seen = new Set();

    tags.forEach(function (tag) {
      const key = clean(tag);

      if (!key || seen.has(key)) return;

      seen.add(key);

      if (
        key === "capture" ||
        key === "check" ||
        key === "checkmate" ||
        key === "promotion"
      ) {
        return;
      }

      if (KNOWN_TACTICS[key]) {
        facts.push(KNOWN_TACTICS[key]);

      } else if (
        /fork|pin|skewer|discovered|double check|back rank|mate threat|checkmate threat/.test(key)
      ) {
        facts.push(
          "Tactical pattern detected: " + String(tag) + "."
        );
      }
    });

    // Stockfish's selected best reply.
    if (reply && reply.move) {
      const rm = reply.move;

      if (rm.captured) {
        facts.push(
          "Stockfish's strongest reply is " +
          rm.san +
          ", capturing your " +
          (PIECES[rm.captured] || "piece") +
          " on " + squareName(rm.to) + "."
        );
      }

      if (rm.san && rm.san.includes("#")) {
        facts.push(
          "The engine's strongest reply is " +
          rm.san +
          " — checkmate. Your move allows a forced mate."
        );

      } else if (rm.san && rm.san.includes("+")) {
        facts.push(
          "Stockfish's strongest reply is " +
          rm.san + ", giving check."
        );
      }
    }

    if (!facts.length) {
      if (data.replySan) {
        facts.push(
          "No immediate fork, pin, checkmate, or forced tactical event " +
          "was confirmed by the available detectors. Stockfish's " +
          "strongest reply is " + data.replySan + "."
        );

      } else {
        facts.push(
          "No immediate tactical consequence was confirmed by " +
          "the available detectors at this analysis depth."
        );
      }
    }

    if (
      data.replyLine &&
      data.replyLine !== data.replySan
    ) {
      facts.push(
        "Engine continuation: " + data.replyLine + "."
      );
    }

    return facts;
  }

  w.PFWhatHappened = Object.freeze({
    version: "1.0",
    explain: explain
  });

})(window);
