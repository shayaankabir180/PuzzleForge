/* PuzzleForge Review Statistics */
(function (w) {
  "use strict";

  function average(moves, key) {
    const values = moves
      .map(m => Number(m[key]))
      .filter(Number.isFinite);

    if (!values.length) return null;

    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function summarize(moves) {
    moves = Array.isArray(moves) ? moves : [];

    const white = moves.filter(m => m.color === "w");
    const black = moves.filter(m => m.color === "b");

    const counts = {
      "Engine Move": 0,
      "Good Move": 0,
      "Bad Move": 0,
      "Chaos": 0
    };

    moves.forEach(m => {
      if (counts[m.classification] !== undefined) {
        counts[m.classification]++;
      }
    });

    return {
      total: moves.length,

      bookMoves: moves.filter(
        m => m.book && m.book.isBook
      ).length,

      counts,

      white: {
        moves: white.length,
        averageCPL: average(white, "cpl"),
        averageLoss: average(white, "loss")
      },

      black: {
        moves: black.length,
        averageCPL: average(black, "cpl"),
        averageLoss: average(black, "loss")
      },

      phases: ["Opening", "Middlegame", "Endgame"].map(name => ({
        name,
        moves: moves.filter(m => m.phase === name).length
      }))
    };
  }

  w.PFReviewStats = {
    average,
    summarize
  };

})(window);
