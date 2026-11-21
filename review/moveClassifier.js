/* PuzzleForge move labels. CPL thresholds are configurable estimates, not Chess.com labels. */
(function (w) {
  "use strict";
  const DEFAULTS = { best:10, excellent:25, good:50, inaccuracy:100, mistake:200 };
  function classify(cpl, opts) {
    const t = Object.assign({}, DEFAULTS, opts || {});
    if (cpl == null || !Number.isFinite(Number(cpl))) return { label:"Unrated", key:"unrated" };
    const n = Math.max(0, Number(cpl));
    if (n <= t.best) return {label:"Best",key:"best"};
    if (n <= t.excellent) return {label:"Excellent",key:"excellent"};
    if (n <= t.good) return {label:"Good",key:"good"};
    if (n <= t.inaccuracy) return {label:"Inaccuracy",key:"inaccuracy"};
    if (n <= t.mistake) return {label:"Mistake",key:"mistake"};
    return {label:"Blunder",key:"blunder"};
  }
  w.PFReviewClassifier = Object.freeze({ classify, defaults:DEFAULTS });
})(window);
