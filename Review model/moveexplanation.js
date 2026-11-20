/* PuzzleForge Explanation System */
(function (w) {
  "use strict";

  function describe(m) {
    if (!m) return "";

    const messages = [];

    if (m.book && m.book.isBook) {
      messages.push(
        "Opening recognition: " +
        m.book.name +
        " (" + m.book.eco + ")."
      );
    }

    if (m.tags && m.tags.includes("Engine")) {
      messages.push(
        "This move matches Stockfish's top move at the selected search depth."
      );
    }

    if (m.tags && m.tags.includes("Book")) {
      messages.push(
        "This move is recognised in the built-in opening reference."
      );
    }

    if (m.loss >= 0.12) {
      messages.push(
        "The engine estimates a substantial loss in expected points."
      );
    } else if (m.loss > 0.02) {
      messages.push(
        "The engine finds a measurable improvement for the opponent."
      );
    } else if (!m.isBest) {
      messages.push(
        "The move keeps the position relatively close to the best continuation."
      );
    }

    if (m.movePatterns?.forks?.length) {
      messages.push(
        "A new double-attack pattern was detected."
      );
    }

    if (m.movePatterns?.pins?.length) {
      messages.push(
        "A new pin pattern was detected."
      );
    }

    if (m.phase === "Opening" && !m.book) {
      messages.push(
        "No matching line was found in the built-in opening reference. This does not mean the move is bad."
      );
    }

    return messages.join(" ");
  }

  w.PFReviewExplanation = { describe };

})(window);
