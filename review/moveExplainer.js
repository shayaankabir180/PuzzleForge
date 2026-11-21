/* Short, factual move explanations built from engine result + move metadata. */
(function (w) {
  "use strict";
  const copy = {
    best:"This move matches the engine's top choice.",
    excellent:"A very strong move with only a small evaluation loss.",
    good:"A reasonable move that keeps most of the position's value.",
    inaccuracy:"This move gives the opponent a noticeable improvement.",
    mistake:"This move loses a significant amount of evaluation.",
    blunder:"This move causes a major deterioration in the position."
  };
  function explain(moveResult) {
    const r = moveResult || {};
    const label = (r.classification && r.classification.key) || "unrated";
    const parts = [copy[label] || "This move could not be classified reliably."];
    if (r.bestSan && r.playedSan && r.bestSan !== r.playedSan)
      parts.push("The engine preferred " + r.bestSan + ".");
    if (Number.isFinite(r.cpl)) parts.push("Estimated centipawn loss: " + Math.round(r.cpl) + ".");
    if (Array.isArray(r.tags) && r.tags.length) parts.push("Position tags: " + r.tags.join(", ") + ".");
    return parts.join(" ");
  }
  w.PFReviewExplanation = Object.freeze({ explain });
})(window);
