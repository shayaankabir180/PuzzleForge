/*
  PuzzleForge sound effects.

  Usage (after including <script src="sound.js"></script>):
    PFSound.play("capture");                          // play a named sound
    PFSound.playMove(move.san, {opponent:true});      // pick the right sound for a move
    PFSound.nameForSan("Qxf7#")                       // -> "game-end"

  Sound names: move-self, move-opponent, capture, castle, promote, move-check,
  game-end, game-draw, illegal, incorrect, puzzle-correct.
*/
(function(){
  "use strict";

  /* Find the sounds/ folder next to this script, wherever the page is served from. */
  var BASE="sounds/";
  try{
    var cs=document.currentScript&&document.currentScript.src;
    if(cs) BASE=cs.replace(/[^\/]*(\?.*)?$/,"")+"sounds/";
  }catch(e){}

  var NAMES=["move-self","move-opponent","capture","castle","promote","move-check",
             "game-end","game-draw","illegal","incorrect","puzzle-correct"];
  var STORAGE_KEY="pf_sound_enabled";

  var enabled=true;
  try{ if(localStorage.getItem(STORAGE_KEY)==="0") enabled=false; }catch(e){}

  /* Each sound tries name.mp3 first, then name.mp3.mpeg (the original upload name). */
  var EXTS=[".mp3",".mp3.mpeg"];
  var sounds={};   /* name -> {src, status} */

  function load(name){
    var entry={src:null,status:"loading",tried:[]};
    sounds[name]=entry;
    var i=0;
    function attempt(){
      var url=BASE+name+EXTS[i];
      entry.tried.push(url);
      var a=new Audio();
      a.preload="auto";
      a.addEventListener("canplaythrough",function(){ entry.src=url; entry.status="ok"; },{once:true});
      a.addEventListener("error",function(){
        i++;
        if(i<EXTS.length) attempt();
        else{
          entry.status="missing";
          console.warn("[PFSound] Could not load sound \""+name+"\". Tried: "+entry.tried.join(", ")+
                       ". Make sure the sounds/ folder is next to sound.js.");
        }
      },{once:true});
      a.src=url;
      a.load();
    }
    attempt();
  }
  NAMES.forEach(load);

  function play(name){
    if(!enabled) return;
    var e=sounds[name];
    if(!e) return;
    /* If still loading, try the first path anyway. */
    var src=e.src||(e.status==="loading"?BASE+name+EXTS[0]:null);
    if(!src) return;
    try{
      var a=new Audio(src);
      var p=a.play();
      if(p&&typeof p.catch==="function") p.catch(function(err){
        console.warn("[PFSound] \""+name+"\" did not play:",err&&err.name,err&&err.message);
      });
    }catch(err){
      console.warn("[PFSound] \""+name+"\" failed:",err);
    }
  }

  /* Run PFSound.test() in the browser console to see the state of every sound. */
  function test(){
    var rows=NAMES.map(function(n){ var e=sounds[n]; return {sound:n,status:e.status,url:e.src||e.tried.join(" | ")}; });
    console.log("[PFSound] enabled="+enabled+"  base="+BASE);
    if(console.table) console.table(rows);
    play("move-self");
    return rows;
  }

  /* Choose a sound from a SAN string (chess.js SAN includes + and #). */
  function nameForSan(san,opts){
    opts=opts||{};
    san=String(san||"");
    if(san.indexOf("#")>-1) return "game-end";
    if(san.indexOf("+")>-1) return "move-check";
    if(san.indexOf("=")>-1) return "promote";
    if(san.indexOf("O-O")===0) return "castle";
    if(san.indexOf("x")>-1) return "capture";
    return opts.opponent?"move-opponent":"move-self";
  }

  function playMove(san,opts){ play(nameForSan(san,opts)); }

  function setEnabled(v){
    enabled=!!v;
    try{ localStorage.setItem(STORAGE_KEY,enabled?"1":"0"); }catch(e){}
    updateButton();
    if(enabled) play("move-self");
  }

  /* ---------- floating mute toggle ---------- */
  var btn=null;
  function updateButton(){
    if(!btn) return;
    btn.textContent=enabled?"🔊":"🔇";
    btn.title=enabled?"Sound on (click to mute)":"Sound off (click to unmute)";
    btn.setAttribute("aria-label",btn.title);
    btn.setAttribute("aria-pressed",enabled?"true":"false");
  }

  function mountButton(){
    if(btn||!document.body) return;
    btn=document.createElement("button");
    btn.type="button";
    btn.id="pfSoundToggle";
    btn.style.cssText=
      "position:fixed;right:14px;bottom:14px;z-index:60;width:40px;height:40px;"+
      "border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(20,22,28,.88);"+
      "color:#fff;font-size:18px;line-height:1;cursor:pointer;padding:0;"+
      "box-shadow:0 2px 8px rgba(0,0,0,.4);";
    btn.addEventListener("click",function(){ setEnabled(!enabled); });
    document.body.appendChild(btn);
    updateButton();
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",mountButton);
  else mountButton();

  window.PFSound={
    play:play,
    playMove:playMove,
    nameForSan:nameForSan,
    setEnabled:setEnabled,
    isEnabled:function(){ return enabled; },
    test:test
  };
})();
