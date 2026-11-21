
/*
 * PuzzleForge — Player Intelligence
 * Version: 1.0
 *
 * Lightweight player-pattern analysis.
 * This is a rule-based foundation, not a trained ML model.
 */

(function (window) {
  "use strict";

  const PlayerIntelligence = {

    version: "1.0",

    analyze(moves) {
      if (!Array.isArray(moves)) {
        return {
          success: false,
          error: "Invalid move data",
          insights: []
        };
      }

      const stats = {
        total: moves.length,
        blunders: 0,
        mistakes: 0,
        inaccuracies: 0,
        best: 0,
        good: 0,
        missedTactics: 0,
        repeatedErrors: 0
      };

      const insights = [];
      const patterns = {};

      moves.forEach((move, index) => {
        const classification = String(
          move.classification ||
          move.type ||
          move.category ||
          ""
        ).toLowerCase();

        if (classification.includes("blunder")) {
          stats.blunders++;
        } else if (classification.includes("mistake")) {
          stats.mistakes++;
        } else if (classification.includes("inaccuracy")) {
          stats.inaccuracies++;
        } else if (classification.includes("best")) {
          stats.best++;
        } else if (classification.includes("good")) {
          stats.good++;
        }

        if (move.missedTactic || move.missed_tactic) {
          stats.missedTactics++;
        }

        const pattern = move.errorType ||
          move.reason ||
          move.theme ||
          classification;

        if (pattern) {
          patterns[pattern] = (patterns[pattern] || 0) + 1;
        }
      });

      const repeated = Object.entries(patterns)
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1]);

      stats.repeatedErrors = repeated.reduce(
        (total, [, count]) => total + count,
        0
      );

      if (stats.blunders > 0) {
        insights.push({
          type: "blunder_pattern",
          title: "Blunder tendency",
          description:
            `${stats.blunders} blunder(s) detected. Review the positions where major evaluation changes occurred.`,
          priority: "high"
        });
      }

      if (stats.missedTactics > 0) {
        insights.push({
          type: "tactical_awareness",
          title: "Tactical awareness",
          description:
            `${stats.missedTactics} missed tactical opportunity/opportunities detected.`,
          priority: "medium"
        });
      }

      if (repeated.length > 0) {
        insights.push({
          type: "repeated_pattern",
          title: "Recurring weakness",
          description:
            `A recurring pattern was detected: ${repeated[0][0]}.`,
          priority: "high"
        });
      }

      if (
        stats.total > 0 &&
        (stats.best + stats.good) / stats.total >= 0.7
      ) {
        insights.push({
          type: "consistency",
          title: "Move consistency",
          description:
            "A strong proportion of your moves were classified as best or good.",
          priority: "low"
        });
      }

      if (insights.length === 0) {
        insights.push({
          type: "general",
          title: "Keep analyzing",
          description:
            "More games will help identify meaningful playing patterns.",
          priority: "low"
        });
      }

      return {
        success: true,
        version: this.version,
        statistics: stats,
        repeatedPatterns: repeated.map(([pattern, count]) => ({
          pattern,
          count
        })),
        insights
      };
    }
  };

  window.PlayerIntelligence = PlayerIntelligence;

})(window);

