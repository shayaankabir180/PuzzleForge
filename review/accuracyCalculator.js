/* Game-level accuracy estimate. Not an official Chess.com/Lichess rating metric. */
(function (w) {
  "use strict";
  function fromLosses(losses) {
    const valid = (losses || []).map(Number).filter(Number.isFinite).map(x=>Math.max(0,x));
    if (!valid.length) return 0;
    const avg = valid.reduce((a,b)=>a+b,0)/valid.length;
    // Smooth diminishing-return curve; clearly presented as PuzzleForge's estimate.
    const score = 100 * Math.exp(-0.035 * avg);
    return Math.max(0, Math.min(100, Math.round(score*10)/10));
  }
  function summary(results) {
    const counts = {best:0,excellent:0,good:0,inaccuracy:0,mistake:0,blunder:0,unrated:0};
    (results||[]).forEach(r=>{
      const k = r.classification && r.classification.key;
      counts[counts[k] !== undefined ? k : "unrated"]++;
    });
    return { accuracy:fromLosses((results||[]).map(r=>r.cpl)), counts,
      total:(results||[]).length };
  }
  w.PFReviewAccuracy = Object.freeze({ fromLosses, summary });
})(window);
