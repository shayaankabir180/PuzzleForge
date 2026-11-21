/* PuzzleForge review orchestrator.
   Requires chess.js 0.10.x (global Chess), PFReviewClassifier, PFReviewAccuracy,
   PFReviewBook, PFReviewTactics, PFReviewExplanation and an async evaluateFen(fen) callback.
*/
(function (w) {
  "use strict";
  function sanHistory(game){ return game.history(); }
  async function analysePgn(pgn, evaluateFen, options) {
    if (typeof w.Chess !== "function") throw new Error("Load chess.js before PuzzleForge review modules.");
    if (typeof evaluateFen !== "function") throw new Error("Provide an async evaluateFen(fen) function backed by Stockfish.");
    const game = new w.Chess();
    if (!game.load_pgn(pgn)) throw new Error("The supplied PGN could not be parsed.");
    const verbose = game.history({verbose:true});
    const sans = sanHistory(game);
    const opening = w.PFReviewBook ? w.PFReviewBook.identify(sans) : null;
    const replay = new w.Chess();
    const results = [];
    const depth = (options && options.depth) || 14;

    for (let i=0;i<verbose.length;i++) {
      const move = verbose[i];
      const beforeFen = replay.fen();
      const before = await evaluateFen(beforeFen, {depth});
      const played = replay.move(move);
      const afterFen = replay.fen();
      const after = await evaluateFen(afterFen, {depth});

      // Evaluators should return score from the side-to-move perspective.
      // Convert to mover's perspective for before/after comparison.
      const moverSign = (i % 2 === 0) ? 1 : -1;
      const beforeCp = Number.isFinite(before.cp) ? before.cp * moverSign : null;
      const afterCp = Number.isFinite(after.cp) ? after.cp * -moverSign : null;
      const cpl = (beforeCp !== null && afterCp !== null)
        ? Math.max(0, beforeCp-afterCp) : null;
      const classification = w.PFReviewClassifier.classify(cpl, options && options.thresholds);
      const tags = w.PFReviewTactics.inspect(played, beforeCp/100, afterCp/100, before.bestMove);
      const item = {
        ply:i+1, moveNumber:Math.floor(i/2)+1, color:i%2===0?"white":"black",
        san:played.san, from:played.from, to:played.to, fenBefore:beforeFen, fenAfter:afterFen,
        bestMove:before.bestMove || null, cpl, classification, tags,
        beforeEval:beforeCp, afterEval:afterCp
      };
      item.explanation = w.PFReviewExplanation.explain({
        classification, cpl, bestSan:before.bestSan, playedSan:played.san, tags
      });
      results.push(item);
    }
    const white=results.filter(r=>r.color==="white");
    const black=results.filter(r=>r.color==="black");
    return {
      opening, moves:results,
      white:w.PFReviewAccuracy.summary(white),
      black:w.PFReviewAccuracy.summary(black),
      overall:w.PFReviewAccuracy.summary(results),
      note:"PuzzleForge estimates based on the selected Stockfish depth; not official Chess.com or Lichess accuracy."
    };
  }
  w.PFGameAnalyzer = Object.freeze({ analysePgn });
})(window);
