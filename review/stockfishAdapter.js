/* Minimal UCI adapter for a Stockfish single-thread worker file. */
(function (w) {
  "use strict";
  class StockfishAdapter {
    constructor(workerUrl) {
      this.worker = new Worker(workerUrl);
      this.lines = [];
      this.waiters = [];
      this.worker.onmessage = e => {
        const line = typeof e.data === "string" ? e.data : "";
        this.lines.push(line);
        this.waiters.splice(0).forEach(fn=>fn(line));
      };
      this.worker.postMessage("uci");
    }
    send(command){ this.worker.postMessage(command); }
    waitFor(predicate, timeoutMs) {
      return new Promise((resolve,reject)=>{
        let done=false;
        const timer=setTimeout(()=>{if(!done){done=true;reject(new Error("Stockfish timed out waiting for engine response."));}},timeoutMs||20000);
        const check=line=>{if(!done && predicate(line)){done=true;clearTimeout(timer);resolve(line);}};
        this.lines.forEach(check);
        this.waiters.push(check);
      });
    }
    async ready() {
      await this.waitFor(line=>line==="uciok",15000);
      this.send("isready");
      await this.waitFor(line=>line==="readyok",15000);
      return true;
    }
    async analyse(fen, depth) {
      this.send("position fen "+fen);
      this.send("go depth "+(depth||14));
      const bestLine=await this.waitFor(line=>/^bestmove /.test(line),45000);
      const info=this.lines.slice().reverse().find(line=>/^info .* score /.test(line))||"";
      const bm=bestLine.split(/\s+/)[1];
      const cpMatch=info.match(/\bscore cp (-?\d+)/);
      const mateMatch=info.match(/\bscore mate (-?\d+)/);
      return { bestMove:bm, cp:cpMatch?Number(cpMatch[1]):null,
        mate:mateMatch?Number(mateMatch[1]):null, info };
    }
    terminate(){ if(this.worker) this.worker.terminate(); }
  }
  w.PFStockfishAdapter = StockfishAdapter;
})(window);
