
/* PuzzleForge Move Classification Engine */
(function (w) {
  "use strict";

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function classify(move) {
    const loss = clamp(Number(move.loss) || 0, 0, 1);
    const cpl = Math.max(0, Number(move.cpl) || 0);

    if (move.isBest) return "Engine Move";

    if (loss <= 0.02 && cpl <= 35)
      return "Good Move";

    if (loss < 0.12 && cpl < 180)
      return "Bad Move";

    return "Chaos";
  }

  function getTags(move) {
    const tags = [];

    if (move.isBest) tags.push("Engine");
    if (move.book && move.book.isBook) tags.push("Book");

    if (move.loss <= 0.02 && !move.isBest)
      tags.push("Good");

    if (move.loss >= 0.12 || move.cpl >= 180)
      tags.push("Bad");

    if (move.loss >= 0.20)
      tags.push("Chaos");

    return [...new Set(tags)];
  }

  function analyse(move) {
    return {
      classification: classify(move),
      tags: getTags(move),
      severity: clamp((Number(move.loss) || 0) * 100, 0, 100)
    };
  }

  w.PFReviewAnalyser = {
    classify,
    getTags,
    analyse
  };

})(window);
