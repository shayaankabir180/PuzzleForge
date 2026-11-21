/* PuzzleForge Opening Book — mainline recognition, not an exhaustive ECO database. */
(function (w) {
  "use strict";
  const lines = [
    ["C20","King's Pawn Game",["e4","e5"]],
    ["C50","Italian Game",["e4","e5","Nf3","Nc6","Bc4"]],
    ["C65","Ruy Lopez",["e4","e5","Nf3","Nc6","Bb5"]],
    ["B20","Sicilian Defense",["e4","c5"]],
    ["B10","Caro-Kann Defense",["e4","c6","d4","d5"]],
    ["C00","French Defense",["e4","e6","d4","d5"]],
    ["D06","Queen's Gambit",["d4","d5","c4"]],
    ["A40","Queen's Pawn Game",["d4"]],
    ["A10","English Opening",["c4"]],
    ["A04","Réti Opening",["Nf3","d5"]],
    ["D00","London System",["d4","Nf6","Bf4"]],
    ["E60","King's Indian Defense",["d4","Nf6","c4","g6"]],
    ["B01","Scandinavian Defense",["e4","d5"]],
    ["C42","Petrov's Defense",["e4","e5","Nf3","Nf6"]],
    ["C44","Scotch Game",["e4","e5","Nf3","Nc6","d4"]]
  ];
  function clean(s){ return String(s || "").replace(/[+#?!]+/g,"").trim(); }
  function identify(sans) {
    const moves = (sans || []).map(clean);
    let best = null;
    for (const line of lines) {
      if (line[2].length <= moves.length &&
          line[2].every((m,i)=>clean(m)===moves[i]) &&
          (!best || line[2].length > best.moves.length)) {
        best = { eco:line[0], name:line[1], moves:line[2].slice(), ply:line[2].length };
      }
    }
    return best ? Object.freeze(best) : null;
  }
  w.PFReviewBook = Object.freeze({ identify, lines: lines.map(x=>({eco:x[0],name:x[1],moves:x[2].slice()})) });
})(window);
