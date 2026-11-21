/* Conservative tactical tags. This module does not claim to solve tactics by itself. */
(function (w) {
  "use strict";
  function inspect(move, beforeEval, afterEval, bestMove) {
    const tags = [];
    if (!move) return tags;
    if (move.san && move.san.includes("#")) tags.push("Checkmate");
    else if (move.san && move.san.includes("+")) tags.push("Check");
    if (move.captured) tags.push("Capture");
    if (move.promotion) tags.push("Promotion");
    const played = String(move.from||"") + String(move.to||"");
    const best = String(bestMove||"").slice(0,4);
    const isBest = best && played === best;
    const loss = (Number.isFinite(beforeEval) && Number.isFinite(afterEval))
      ? Math.max(0, beforeEval-afterEval) : null;
    if (move.captured && loss !== null && loss <= 0.10 && isBest) tags.push("Tactically sound capture");
    return tags;
  }
  function brilliantCandidate(move, cpl, evalAfter, bestMove) {
    if (!move || !bestMove || !Number.isFinite(cpl) || !Number.isFinite(evalAfter)) return false;
    const played = String(move.from||"") + String(move.to||"");
    const best = String(bestMove).slice(0,4);
    // Deliberately conservative: only flag candidate sacrifices for human/engine verification.
    const isSacrifice = !!move.piece && !move.captured && ["q","r","b","n"].includes(move.piece);
    return isSacrifice && played === best && cpl <= 10 && evalAfter >= -0.30;
  }
  w.PFReviewTactics = Object.freeze({ inspect, brilliantCandidate });
})(window);
