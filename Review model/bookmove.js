/* PuzzleForge Opening Book Recognition */
(function (w) {
  "use strict";

  const openings = [
    { eco:"C20", name:"King's Pawn Game", moves:["e4","e5"] },
    { eco:"C50", name:"Italian Game", moves:["e4","e5","Nf3","Nc6","Bc4"] },
    { eco:"C60", name:"Ruy Lopez", moves:["e4","e5","Nf3","Nc6","Bb5"] },
    { eco:"B20", name:"Sicilian Defence", moves:["e4","c5"] },
    { eco:"B10", name:"Caro-Kann Defence", moves:["e4","c6"] },
    { eco:"B01", name:"Scandinavian Defence", moves:["e4","d5"] },
    { eco:"C00", name:"French Defence", moves:["e4","e6"] },
    { eco:"D06", name:"Queen's Gambit", moves:["d4","d5","c4"] },
    { eco:"A10", name:"English Opening", moves:["c4"] },
    { eco:"A04", name:"Réti Opening", moves:["Nf3","d5"] }
  ];

  function lookup(plies, index) {
    if (!Array.isArray(plies)) return null;

    const played = plies
      .slice(0, index + 1)
      .map(move => move.san);

    let match = null;

    for (const opening of openings) {
      const count = Math.min(played.length, opening.moves.length);

      if (
        count > 0 &&
        opening.moves.slice(0, count)
          .every((move, i) => move === played[i]) &&
        (!match || count > match.matched)
      ) {
        match = {
          eco: opening.eco,
          name: opening.name,
          matched: count,
          isBook: played.length <= opening.moves.length
        };
      }
    }

    return match && match.isBook ? match : null;
  }

  w.PFReviewBook = { lookup, openings };

})(window);
