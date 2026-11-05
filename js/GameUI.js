// GameUI.js — интерфейс Paint Blade (DOM поверх #world3d): HUD с прогрессом главы (1–5 и сундук),
// экранный джойстик, главное меню, победа / поражение / пауза / настройки / сундук, всплывающие монеты.
// Стиль — «краска»: жирные кнопки с подтёками, кляксы, рукописная энергия. Тексты — Lang (data-t).
// Логику ход игры держит Game.js; здесь только вид и кнопки (колбэки на Game).

// Название игры — GAME_TITLE (сборка площадки может дать своё, tools/platforms.mjs: title): экран загрузки и
// текстовый логотип берут его из ключа Lang 'title'. Скрипт идёт до main.js — раньше экрана загрузки.
if (typeof GAME_TITLE !== 'undefined' && typeof LANG_STRINGS !== 'undefined') for (const code in LANG_STRINGS) LANG_STRINGS[code].title = GAME_TITLE;

/** @satisfies {Record<string, any>} */
const GameUI = {
    /** @type {HTMLElement | null} */ root: null,
    mode: 'menu',                 // menu | play | result | shop
    /** @type {Record<string, HTMLElement>} */ el: {},
    _stick: /** @type {{ id: number, x0: number, y0: number } | null} */ (null),

    CSS: `
:root { --pb-font: 'PaintFont', 'Arial Black', system-ui, sans-serif; --pb-ink: #1b1530; --pb-cream: #fff8ec;
  --pb-orange: #ff8a1f; --pb-orange2: #ff5d1f; --pb-green: #2fd36b; --pb-green2: #11a84e; --pb-purple: #9b4dff; --pb-purple2: #6c22e0;
  --pb-red: #ff5ca8; --pb-red2: #d62c86; --pb-blue: #2f9bff; --pb-blue2: #1667d9; --pb-gold: #ffd23f; }
#pb-ui { position: fixed; inset: 0; pointer-events: none; z-index: 20; font-family: var(--pb-font); color: #fff;
  -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
#pb-ui * { box-sizing: border-box; }
#pb-ui .on { pointer-events: auto; }
.pb-layer { position: absolute; inset: 0; pointer-events: none; }
.pb-screen { position: absolute; inset: 0; display: none; pointer-events: auto; }
.pb-screen.show { display: flex; }
.pb-txt { font-weight: 900; color: #fff; paint-order: stroke fill; -webkit-text-stroke: 0.16em var(--pb-ink); letter-spacing: 0.01em; }
.pb-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 0.45em; border: 0;
  font: italic 900 clamp(17px, calc(var(--hl-k, 1) * 22px), 30px)/1 var(--pb-font); text-transform: uppercase; color: #fff;
  padding: 0.62em 1.25em 0.7em; border-radius: 0.55em; cursor: pointer; pointer-events: auto; white-space: nowrap;
  background: linear-gradient(180deg, var(--b1, var(--pb-orange)) 0 58%, var(--b2, var(--pb-orange2)) 58%);
  box-shadow: 0 0.22em 0 var(--pb-ink), inset 0 -0.18em 0 rgba(0,0,0,0.18), inset 0 0.16em 0 rgba(255,255,255,0.45);
  outline: 0.14em solid var(--pb-ink); transition: transform .08s; isolation: isolate; }
.pb-btn .t { paint-order: stroke fill; -webkit-text-stroke: 0.2em var(--pb-ink); }
.pb-btn:active { transform: translateY(0.12em) scale(0.98); box-shadow: 0 0.1em 0 var(--pb-ink), inset 0 -0.18em 0 rgba(0,0,0,0.18); }
.pb-btn { overflow: hidden; }
.pb-btn::after { content: ''; position: absolute; top: -20%; bottom: -20%; left: -60%; width: 38%; transform: skewX(-22deg);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent); pointer-events: none; animation: pb-shine 3.6s ease-in-out infinite; }
.pb-btn.white::after, .pb-btn.small::after { animation-duration: 5.2s; opacity: 0.6; }
@keyframes pb-shine { 0%, 62% { left: -60%; } 100% { left: 130%; } }
.pb-btn.green { --b1: var(--pb-green); --b2: var(--pb-green2); }
.pb-btn.purple { --b1: var(--pb-purple); --b2: var(--pb-purple2); }
.pb-btn.red { --b1: var(--pb-red); --b2: var(--pb-red2); }
.pb-btn.blue { --b1: var(--pb-blue); --b2: var(--pb-blue2); }
.pb-btn.white { --b1: #ffffff; --b2: #dfe3ee; color: var(--pb-ink); }
.pb-btn.white .t { -webkit-text-stroke: 0; }
.pb-btn.small { font-size: clamp(13px, calc(var(--hl-k, 1) * 16px), 20px); padding: 0.55em 0.9em 0.6em; }
.pb-btn.big { font-size: clamp(24px, calc(var(--hl-k, 1) * 36px), 46px); padding: 0.55em 1.6em 0.62em; }
.pb-btn[disabled] { filter: grayscale(0.9) brightness(0.85); cursor: default; }
.pb-btn.icon { padding: 0.45em; width: 2.3em; height: 2.3em; border-radius: 0.6em; }
.pb-btn.icon::after { display: none; }

/* прокачка */
#pb-up .pb-panel { width: min(94vw, 560px); max-height: 92vh; overflow: hidden; display: flex; flex-direction: column; padding: clamp(10px, 2.4vmin, 20px); }
.pb-up-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
.pb-up-head h3 { margin: 0; }
.pb-up-coins { display: flex; align-items: center; gap: .35em; font: 900 clamp(15px, 3vmin, 22px)/1 var(--pb-font); color: #fff; padding: .3em .8em .3em .35em; background: var(--pb-ink); border-radius: 2em; }
.pb-up-list { display: flex; flex-direction: column; gap: clamp(6px, 1.4vmin, 10px); overflow-y: auto; scrollbar-width: none; min-height: 0; }
.pb-up-list::-webkit-scrollbar { display: none; }
.pb-up-row { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: clamp(8px, 2vmin, 14px); background: #fff; border-radius: 16px; outline: 3px solid var(--pb-ink);
  box-shadow: 0 4px 0 var(--pb-ink); padding: clamp(6px, 1.4vmin, 10px) clamp(8px, 1.8vmin, 12px); }
.pb-up-list.enter .pb-up-row { animation: pb-in .4s cubic-bezier(.2,1.6,.4,1) backwards; }
.pb-up-list.enter .pb-up-row:nth-child(2) { animation-delay: .05s; } .pb-up-list.enter .pb-up-row:nth-child(3) { animation-delay: .1s; } .pb-up-list.enter .pb-up-row:nth-child(4) { animation-delay: .15s; }
.pb-up-list.enter .pb-up-row:nth-child(5) { animation-delay: .2s; } .pb-up-list.enter .pb-up-row:nth-child(6) { animation-delay: .25s; } .pb-up-list.enter .pb-up-row:nth-child(7) { animation-delay: .3s; }
.pb-up-ic { width: clamp(38px, 8vmin, 54px); height: clamp(38px, 8vmin, 54px); border-radius: 14px; display: grid; place-items: center; background: var(--c); outline: 3px solid var(--pb-ink); }
.pb-up-ic svg { width: 66%; height: 66%; }
.pb-up-mid { min-width: 0; }
.pb-up-name { font: 900 clamp(14px, 3vmin, 19px)/1.1 var(--pb-font); color: var(--pb-ink); }
.pb-up-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pb-up-val { font: 900 clamp(11px, 2.3vmin, 14px)/1.15 var(--pb-font); color: var(--c); filter: brightness(0.8); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 480px) {
  .pb-up-row { grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; padding: 6px 8px; }
  .pb-up-ic { width: 36px; height: 36px; border-radius: 10px; }
  .pb-up-desc { display: none; }
  .pb-up-buy { min-width: 74px !important; }
  .pb-up-pips i { height: 6px; }
}
.pb-up-list { padding: 5px 6px 8px; margin: 0 -6px; }
.pb-up-list.more { mask-image: linear-gradient(#000 calc(100% - 22px), transparent); -webkit-mask-image: linear-gradient(#000 calc(100% - 22px), transparent); }
#pb-up-legend { flex: none; padding: 6px 0 2px; }   /* «Вихрь» — всегда виден, вне прокрутки */
/* широкий низкий экран (телефон в альбоме, iframe площадки): две колонки — всё видно без прокрутки */
@media (min-width: 600px) and (max-height: 520px) {
  #pb-up .pb-panel { width: min(96vw, 900px); }
  .pb-up-list { display: grid; grid-template-columns: 1fr 1fr; align-content: start; }
  .pb-up-row.legend { grid-column: 1 / -1; }
  .pb-up-desc { display: none; }
}
.pb-up-desc { font: 700 clamp(11px, 2.2vmin, 13px)/1.2 var(--pb-font); color: #6b6580; margin-top: 2px; }
.pb-up-pips { display: flex; gap: 3px; margin-top: 5px; }
.pb-up-pips i { flex: 1; max-width: 18px; height: 8px; border-radius: 4px; background: #e3e0ec; outline: 2px solid var(--pb-ink); }
.pb-up-pips i.on { background: var(--c); }
.pb-up-buy { min-width: clamp(84px, 18vmin, 120px); font-size: clamp(13px, 2.6vmin, 17px) !important; padding: .55em .7em .6em !important; }
.pb-up-buy .pb-coin { width: 1.1em; height: 1.1em; }
.pb-up-row.legend { background: linear-gradient(135deg, #fff3c4, #ffe08a 45%, #ffd0f0); position: relative; overflow: hidden; }
.pb-up-row.legend::after { content: ''; position: absolute; inset: -40% auto -40% -30%; width: 30%; transform: skewX(-20deg); background: linear-gradient(90deg, transparent, rgba(255,255,255,.75), transparent);
  animation: pb-shine 3s ease-in-out infinite; pointer-events: none; }
.pb-up-tag { display: inline-block; font: 900 clamp(9px, 1.8vmin, 11px)/1 var(--pb-font); color: #fff; background: linear-gradient(90deg, #ff8a1f, #ff3d7f); padding: 3px 7px; border-radius: 8px; margin-bottom: 3px; }
.pb-up-row.bought { animation: pb-bump .4s cubic-bezier(.2,1.8,.4,1); }
/* --- живость интерфейса --- */
.pb-screen.show .pb-col > *, .pb-screen.show .pb-panel { animation: pb-in 0.42s cubic-bezier(.2,1.6,.4,1) both; }
.pb-screen.show .pb-col > *:nth-child(2) { animation-delay: .07s; } .pb-screen.show .pb-col > *:nth-child(3) { animation-delay: .14s; }
.pb-screen.show .pb-col > *:nth-child(4) { animation-delay: .21s; } .pb-screen.show .pb-col > *:nth-child(5) { animation-delay: .28s; }
@keyframes pb-in { 0% { opacity: 0; transform: scale(0.6) translateY(24px); } 100% { opacity: 1; transform: none; } }
#pb-win.show .pb-h1, #pb-lose.show .pb-h1, #pb-chest.show .pb-h1 { animation: pb-slam 0.55s cubic-bezier(.2,1.8,.4,1) both; }
@keyframes pb-slam { 0% { opacity: 0; transform: rotate(-3deg) scale(2.6); } 60% { opacity: 1; transform: rotate(-6deg) scale(0.92); } 100% { transform: rotate(-3deg) scale(1); } }
#pb-win.show .pb-splat { animation: pb-splash 0.6s cubic-bezier(.2,1.5,.4,1) both, pb-spin 18s linear 0.6s infinite; }
@keyframes pb-splash { 0% { transform: translate(-50%, -50%) scale(0.1) rotate(-40deg); } 100% { transform: translate(-50%, -50%) scale(1) rotate(-8deg); } }
@keyframes pb-spin { from { transform: translate(-50%, -50%) scale(1) rotate(-8deg); } to { transform: translate(-50%, -50%) scale(1) rotate(352deg); } }
#pb-play { animation: pb-pulse 1.5s ease-in-out infinite; }
@keyframes pb-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06) rotate(-1deg); } }
#pb-win-next { animation: pb-pulse 1.5s ease-in-out 0.8s infinite; }
#pb-logo { animation: pb-bobLogo 3.2s ease-in-out infinite; }
@keyframes pb-bobLogo { 0%, 100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-6px) rotate(1deg); } }
.pb-tile { animation: pb-float 2.6s ease-in-out infinite; }
.pb-tile:nth-child(2) { animation-delay: -0.6s; } .pb-tile:nth-child(3) { animation-delay: -1.2s; } .pb-tile:nth-child(4) { animation-delay: -1.8s; }
@keyframes pb-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
.pb-tile:hover, .pb-btn:hover { filter: brightness(1.08); }
.pb-tile:active { transform: scale(0.92) !important; }
.pb-node.cur { animation: pb-cur 1.2s ease-in-out infinite; }
@keyframes pb-cur { 0%, 100% { transform: scale(1.22); } 50% { transform: scale(1.34); } }
.bump { animation: pb-bump 0.35s cubic-bezier(.2,1.8,.4,1); }
@keyframes pb-bump { 0% { transform: scale(1); } 40% { transform: scale(1.32); } 100% { transform: scale(1); } }
.pb-flycoin { position: absolute; width: 26px; height: 26px; margin: -13px 0 0 -13px; pointer-events: none; z-index: 5;
  transition: left 0.62s cubic-bezier(.5,-0.3,.6,1), top 0.62s cubic-bezier(.3,0,.8,0.4), transform 0.62s; }
#pb-vig { position: absolute; inset: 0; pointer-events: none; opacity: 0; box-shadow: inset 0 0 12vmin 3vmin var(--vig, #ff4fa3); }
#pb-vig.hit { animation: pb-vig 0.45s ease-out; }
@keyframes pb-vig { 0% { opacity: 0.85; } 100% { opacity: 0; } }
#pb-combo { position: absolute; left: 50%; top: 26%; transform: translate(-50%, -50%); font: italic 900 clamp(26px, 7vmin, 60px)/1 var(--pb-font);
  color: var(--pb-gold); -webkit-text-stroke: 0.1em var(--pb-ink); paint-order: stroke fill; pointer-events: none; opacity: 0; white-space: nowrap; }
#pb-combo.show { animation: pb-combo 1s cubic-bezier(.2,1.6,.4,1) forwards; }
@keyframes pb-combo { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3) rotate(-12deg); } 20% { opacity: 1; transform: translate(-50%, -50%) scale(1.15) rotate(-5deg); }
  70% { opacity: 1; transform: translate(-50%, -60%) scale(1) rotate(-5deg); } 100% { opacity: 0; transform: translate(-50%, -80%) scale(0.9) rotate(-5deg); } }
.pb-drip { position: absolute; top: -10px; width: 10px; border-radius: 0 0 6px 6px; pointer-events: none; animation: pb-drip linear forwards; }
@keyframes pb-drip { 0% { height: 0; } 60% { height: var(--h, 60px); opacity: 1; } 100% { height: var(--h, 60px); opacity: 0; transform: translateY(40px); } }
@media (prefers-reduced-motion: reduce) {
  #pb-ui *, #pb-ui *::after { animation-duration: 0.01s !important; animation-iteration-count: 1 !important; transition: none !important; }
}
.pb-btn.icon .pb-ico { width: 1.55em; height: 1.55em; }
.pb-btn.icon.small .pb-ico { width: 1.45em; height: 1.45em; }
.pb-ico { width: 1.25em; height: 1.25em; display: inline-block; background: center/contain no-repeat; filter: drop-shadow(0 0.08em 0 var(--pb-ink)) drop-shadow(0 -0.04em 0 var(--pb-ink)) drop-shadow(0.06em 0 0 var(--pb-ink)) drop-shadow(-0.06em 0 0 var(--pb-ink)); flex: none; }
.pb-coin { border-radius: 50%; filter: none; background: radial-gradient(circle at 34% 30%, #fff7c2 0 14%, #ffd23f 36%, #f2a900 74%, #c77d00 100%);
  outline: 0.11em solid var(--pb-ink); box-shadow: inset 0 0 0 0.13em rgba(255,255,255,0.35), 0 0.08em 0 var(--pb-ink); position: relative; }
.pb-coin::after { content: ''; position: absolute; inset: 26%; border-radius: 50%; border: 0.09em solid rgba(160,90,0,0.55); }
.pb-ad { display: inline-block; font-size: 0.62em; font-style: normal; background: #fff; color: var(--pb-purple2); border-radius: 0.35em; padding: 0.25em 0.4em; -webkit-text-stroke: 0; }
/* HUD */
#pb-hud { display: none; }
#pb-hud.show { display: block; }
#pb-top { display: flex; align-items: center; gap: calc(var(--hl-k, 1) * 10px); justify-content: center; }
.pb-prog { display: flex; align-items: center; position: relative; padding-bottom: calc(var(--hl-k, 1) * 26px); }
.pb-node { width: calc(var(--hl-k, 1) * 34px); height: calc(var(--hl-k, 1) * 34px); border-radius: 50%; display: grid; place-items: center;
  font: 900 calc(var(--hl-k, 1) * 17px)/1 var(--pb-font); background: #e9edf5; color: #9aa3b5; outline: 3px solid var(--pb-ink); position: relative; z-index: 1; }
.pb-node.done { background: var(--pb-green); color: #fff; }
.pb-node.cur { background: var(--pb-orange); color: #fff; transform: scale(1.22); box-shadow: 0 0 0 4px #fff, 0 0 0 7px var(--pb-ink); outline: 0; }
.pb-link { width: calc(var(--hl-k, 1) * 18px); height: calc(var(--hl-k, 1) * 8px); background: #e9edf5; outline: 3px solid var(--pb-ink); }
.pb-link.done { background: var(--pb-green); }
.pb-chest { position: absolute; right: calc(var(--hl-k, 1) * -2px); bottom: 0; width: calc(var(--hl-k, 1) * 34px); height: calc(var(--hl-k, 1) * 28px); background: center/contain no-repeat; }
.pb-chest::before { content: '▲'; position: absolute; top: calc(var(--hl-k, 1) * -10px); left: 50%; transform: translateX(-50%); font-size: calc(var(--hl-k, 1) * 10px); color: #fff; -webkit-text-stroke: 2px var(--pb-ink); paint-order: stroke fill; }
#pb-coins { display: flex; align-items: center; gap: 0.35em; font: 900 clamp(16px, calc(var(--hl-k, 1) * 24px), 30px)/1 var(--pb-font); padding: 0.3em 0.8em 0.3em 0.35em;
  background: rgba(27,21,48,0.72); border-radius: 2em; outline: 3px solid var(--pb-ink); }
#pb-coins .pb-ico { width: 1.3em; height: 1.3em; }
#pb-side { display: flex; flex-direction: column; align-items: flex-end; gap: calc(var(--hl-k, 1) * 12px); }
#pb-enemies { font: 900 clamp(13px, calc(var(--hl-k, 1) * 17px), 22px)/1 var(--pb-font); background: rgba(27,21,48,0.6); padding: 0.4em 0.8em; border-radius: 1em; }
#pb-boss { position: absolute; left: 50%; top: 22%; transform: translate(-50%, -50%) rotate(-6deg); font: italic 900 clamp(40px, 11vmin, 96px)/1 var(--pb-font);
  color: var(--pb-orange); -webkit-text-stroke: 0.08em var(--pb-ink); paint-order: stroke fill; opacity: 0; pointer-events: none; }
#pb-boss.show { animation: pb-pop 1.9s ease-out forwards; }
#pb-boss small { display: block; font-size: 0.42em; color: #fff; margin-top: 0.15em; }
#pb-bossbar { display: none; pointer-events: none; text-align: center; }
#pb-bossbar.show { display: block; animation: pb-in .4s cubic-bezier(.2,1.6,.4,1) both; }
#pb-bossbar .n { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font: italic 900 clamp(12px, calc(var(--hl-k, 1) * 18px), 20px)/1.1 var(--pb-font); color: #ffd23f; -webkit-text-stroke: 0.16em var(--pb-ink); paint-order: stroke fill; margin-bottom: 4px; }
#pb-bossbar .b { height: clamp(10px, calc(var(--hl-k, 1) * 16px), 18px); background: rgba(27,21,48,0.8); border-radius: 10px; outline: 3px solid var(--pb-ink); overflow: hidden; }
#pb-bossbar .b i { display: block; height: 100%; width: 100%; background: linear-gradient(#ffd27a, #ff8a1f); transition: width .15s; }
@keyframes pb-pop { 0% { opacity: 0; transform: translate(-50%, -50%) rotate(-6deg) scale(2.2); } 15% { opacity: 1; transform: translate(-50%, -50%) rotate(-6deg) scale(1); }
  80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -60%) rotate(-6deg) scale(1); } }
/* полоски здоровья */
#pb-bars { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.pb-bar { position: absolute; left: -32px; top: -6px; width: 64px; height: 9px; background: rgba(27,21,48,0.75); border-radius: 6px; outline: 2px solid var(--pb-ink); overflow: hidden; will-change: transform; }
.pb-bar i { display: block; height: 100%; width: 100%; background: linear-gradient(#ffa8d6, #ff3d9a); border-radius: 6px; transition: width .12s; }
.pb-bar.me { width: 84px; left: -42px; height: 11px; }
.pb-bar.me i { background: linear-gradient(#7dffa8, #18c45a); }
.pb-bar.boss { width: 120px; left: -60px; height: 12px; }
/* джойстик */
#pb-joy { position: absolute; width: 130px; height: 130px; margin: -65px 0 0 -65px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.95);
  box-shadow: 0 0 0 2px rgba(27,21,48,0.35); display: none; pointer-events: none; }
#pb-joy i { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%; background: #fff; box-shadow: 0 2px 0 rgba(27,21,48,0.4); }
/* всплывающие надписи */
#pb-float { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.pb-fl { position: absolute; font: italic 900 clamp(18px, 4vmin, 30px)/1 var(--pb-font); color: var(--pb-gold); -webkit-text-stroke: 0.14em var(--pb-ink); paint-order: stroke fill;
  animation: pb-rise 0.9s ease-out forwards; white-space: nowrap; }
@keyframes pb-rise { 0% { transform: translate(-50%, 0) scale(0.6); opacity: 0; } 20% { transform: translate(-50%, -14px) scale(1.15); opacity: 1; } 100% { transform: translate(-50%, -70px) scale(1); opacity: 0; } }
/* экраны */
#pb-notice .pb-panel { width: min(92vw, 500px); text-align: center; padding: clamp(14px, 3vmin, 26px); }
.pb-nt-row { display: flex; justify-content: center; gap: clamp(6px, 2vmin, 16px); margin: 2px 0 6px; }
.pb-nt-i { position: relative; width: clamp(58px, 13vmin, 92px); aspect-ratio: 1; }
.pb-nt-i::before { content: ''; position: absolute; inset: -8%; background: var(--sc); -webkit-mask: var(--sm) center/contain no-repeat; mask: var(--sm) center/contain no-repeat; }
.pb-nt-i i { position: absolute; inset: 14%; background: center/contain no-repeat; }
#pb-notice.show .pb-nt-i { animation: pb-ntpop 0.5s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes pb-ntpop { 0% { opacity: 0; transform: scale(0.2) rotate(-30deg); } 100% { opacity: 1; transform: none; } }
#pb-notice.show .pb-nt-i:nth-child(2) { animation-delay: .08s; }
#pb-notice.show .pb-nt-i:nth-child(3) { animation-delay: .16s; }
.pb-nt-t { margin: 4px auto 14px; max-width: 42ch; font: 800 clamp(15px, 3.1vmin, 21px)/1.35 var(--pb-font); color: var(--pb-ink); }
.pb-dim { background: radial-gradient(ellipse at center, rgba(27,21,48,0.25), rgba(27,21,48,0.72)); }
.pb-col { margin: auto; display: flex; flex-direction: column; align-items: center; gap: clamp(10px, 2.4vmin, 22px); padding: 16px; max-width: 100%; }
.pb-row { display: flex; gap: clamp(8px, 2vmin, 16px); align-items: center; justify-content: center; flex-wrap: wrap; }
.pb-h1 { font: italic 900 clamp(28px, min(10vmin, 9vw), 92px)/0.95 var(--pb-font); text-transform: uppercase; text-align: center; color: #fff; -webkit-text-stroke: 0.09em var(--pb-ink); paint-order: stroke fill;
  text-shadow: 0 0.08em 0 var(--pb-ink); transform: rotate(-3deg); }
.pb-h2 { font: 900 clamp(16px, 3.6vmin, 26px)/1.2 var(--pb-font); text-align: center; -webkit-text-stroke: 0.14em var(--pb-ink); paint-order: stroke fill; max-width: 90vw; }
.pb-splat { position: absolute; z-index: -1; left: 50%; top: 50%; width: 150%; aspect-ratio: 1; transform: translate(-50%, -50%) rotate(-8deg); background: var(--sc, #ff3d7f);
  -webkit-mask: var(--sm) center/contain no-repeat; mask: var(--sm) center/contain no-repeat; opacity: 0.95; pointer-events: none; }
.pb-reward { display: flex; align-items: center; gap: 0.3em; font: 900 clamp(28px, 7vmin, 54px)/1 var(--pb-font); -webkit-text-stroke: 0.12em var(--pb-ink); paint-order: stroke fill; color: var(--pb-gold); }
.pb-reward .pb-ico { width: 1.15em; height: 1.15em; }
/* меню */
#pb-menu { flex-direction: column; justify-content: flex-start; align-items: stretch; pointer-events: none; }
#pb-menu > * { pointer-events: auto; }
#pb-menu-top { display: flex; justify-content: space-between; align-items: flex-start; padding: calc(var(--hl-safe-t, 0px) + 10px) 12px 0; pointer-events: none; }
#pb-menu-top > * { pointer-events: auto; }
#pb-logo { position: relative; text-align: center; margin: clamp(0px, 1vmin, 10px) auto 0; pointer-events: none; }
#pb-logo-img[hidden] { display: none; }
#pb-logo-img { display: block; margin: 0 auto; width: min(78vw, 520px); max-height: 18vh; object-fit: contain; filter: drop-shadow(0 6px 0 rgba(27,21,48,0.5)); }
.hl-low #pb-logo-img { max-height: 15vh; }
#pb-logo.img .pb-h1 { display: none; }
#pb-logo .pb-h1 { font-size: clamp(24px, min(9vmin, 8.4vw), 88px); max-width: 94vw; margin: 0 auto; text-wrap: balance; }
#pb-logo .sub { margin-top: 0.3em; font: italic 900 clamp(14px, 2.8vmin, 24px)/1 var(--pb-font); -webkit-text-stroke: 0.15em var(--pb-ink); paint-order: stroke fill; color: var(--pb-gold); }
#pb-menu-left { position: absolute; left: calc(var(--hl-safe-l, 0px) + 12px); top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: clamp(10px, 2.2vmin, 18px); }
.pb-tile { position: relative; width: clamp(64px, 13vmin, 96px); aspect-ratio: 1; border-radius: 22%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  background: linear-gradient(180deg, var(--b1) 0 60%, var(--b2) 60%); outline: 3px solid var(--pb-ink); box-shadow: 0 4px 0 var(--pb-ink), inset 0 3px 0 rgba(255,255,255,0.4); cursor: pointer; border: 0; color: #fff; pointer-events: auto; }
.pb-tile .pb-ico { width: 52%; height: 52%; }
.pb-tile .t { font: italic 900 clamp(10px, 2.1vmin, 15px)/1 var(--pb-font); text-transform: uppercase; -webkit-text-stroke: 0.2em var(--pb-ink); paint-order: stroke fill; }
.pb-tile .dot { position: absolute; top: -6px; right: -6px; min-width: 22px; height: 22px; border-radius: 11px; background: var(--pb-red); outline: 3px solid var(--pb-ink); font: 900 13px/22px var(--pb-font); text-align: center; display: none; }
.pb-tile.alert .dot { display: block; animation: pb-bob 1s ease-in-out infinite; }
@keyframes pb-bob { 50% { transform: translateY(-4px); } }
#pb-menu-bottom { margin-top: auto; display: flex; flex-direction: column; align-items: center; gap: clamp(8px, 1.8vmin, 14px); padding: 0 12px calc(var(--hl-safe-b, 0px) + clamp(18px, 5vmin, 40px)); }
#pb-menu-level { font: italic 900 clamp(16px, 3.4vmin, 26px)/1 var(--pb-font); -webkit-text-stroke: 0.16em var(--pb-ink); paint-order: stroke fill; }
.pb-panel { position: relative; background: var(--pb-cream); color: var(--pb-ink); border-radius: 22px; outline: 4px solid var(--pb-ink); box-shadow: 0 7px 0 var(--pb-ink);
  padding: clamp(14px, 3vmin, 26px); max-width: min(92vw, 520px); max-height: 88vh; overflow: auto; }
.pb-panel h3 { margin: 0 0 12px; font: italic 900 clamp(22px, 4.6vmin, 36px)/1 var(--pb-font); text-transform: uppercase; color: #fff; -webkit-text-stroke: 0.14em var(--pb-ink); paint-order: stroke fill; text-align: center; }
.pb-set { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 10px 2px; border-bottom: 2px dashed rgba(27,21,48,0.18); font: 900 clamp(15px, 3vmin, 21px)/1 var(--pb-font); }
.pb-set:last-of-type { border-bottom: 0; }
.pb-seg { display: inline-flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.pb-seg button { font: 900 clamp(12px, 2.4vmin, 16px)/1 var(--pb-font); padding: 8px 10px; border-radius: 10px; border: 0; outline: 3px solid var(--pb-ink); background: #fff; color: var(--pb-ink); cursor: pointer; }
.pb-seg button.sel { background: var(--pb-orange); color: #fff; }
.pb-x { position: absolute; top: 10px; right: 10px; }
#pb-chest-img { width: clamp(60px, 14vmin, 110px); aspect-ratio: 1; background: center/contain no-repeat; cursor: pointer; animation: pb-wobble 0.9s ease-in-out infinite; }
#pb-chest-img.open { animation: pb-open 0.5s ease-out forwards; }
@keyframes pb-wobble { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-6deg) scale(1.04); } 75% { transform: rotate(6deg) scale(1.04); } }
@keyframes pb-open { 0% { transform: scale(1); } 40% { transform: scale(1.3); } 100% { transform: scale(1.1); } }
#pb-toast { position: absolute; left: 50%; bottom: 18%; transform: translateX(-50%); background: rgba(27,21,48,0.88); padding: 12px 18px; border-radius: 14px; font: 900 clamp(14px, 3vmin, 20px)/1.2 var(--pb-font);
  text-align: center; opacity: 0; transition: opacity .2s; max-width: 86vw; pointer-events: none; }
#pb-toast.show { opacity: 1; }
#pb-err { display: none; }
.pb-col > .pb-h1 { margin-bottom: 0.18em; }   /* наклонённый заголовок не налезает на строку под ним */
.pb-lb { display: flex; align-items: center; gap: 10px; padding: 7px 4px; border-bottom: 2px dashed rgba(27,21,48,0.15); font: 900 clamp(14px, 2.8vmin, 19px)/1.1 var(--pb-font); }
.pb-lb.me { background: rgba(255,138,31,0.18); border-radius: 10px; }
.pb-lb .r { width: 2em; text-align: center; color: var(--pb-orange2); }
.pb-lb img, .pb-lb .av { width: 34px; height: 34px; border-radius: 50%; outline: 2px solid var(--pb-ink); object-fit: cover; background: #dfe3ee; flex: none; }
.pb-lb .n { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pb-lb .s { color: var(--pb-ink); }
.pb-empty { padding: 18px 6px; text-align: center; font: 900 clamp(14px, 2.8vmin, 18px)/1.3 var(--pb-font); color: #6b6580; }
.hl-low #pb-logo .sub, .hl-low #pb-menu-level { display: none; }
.hl-low .pb-h1 { font-size: clamp(28px, 8vmin, 54px); }
.hl-tall #pb-menu-left { position: static; transform: none; flex-direction: row; flex-wrap: wrap; justify-content: center; margin: auto auto clamp(8px, 2vh, 18px); gap: clamp(8px, 2.4vw, 14px); }
.hl-tall #pb-menu-bottom { margin-top: 0; }
.hl-tall .pb-tile { width: clamp(58px, 17vw, 92px); }
`,

    // Иконки: пути литералами (сканер сборщика). Нет файла — пустой значок, текст остаётся.
    ICON: {
        home: 'assets/ui/kenney/home.webp', restart: 'assets/ui/kenney/restart.webp', gear: 'assets/ui/kenney/gear.webp',
        sound_on: 'assets/ui/kenney/sound_on.webp', sound_off: 'assets/ui/kenney/sound_off.webp', music: 'assets/ui/kenney/music.webp',
        cart: 'assets/ui/kenney/cart.webp', gift: 'assets/ui/kenney/gift.webp', wheel: 'assets/ui/kenney/wheel.webp', coin: 'assets/ui/kenney/coin.webp',
        video: 'assets/ui/kenney/video.webp', play: 'assets/ui/kenney/play.webp', pause: 'assets/ui/kenney/pause.webp', skip: 'assets/ui/kenney/skip.webp',
        question: 'assets/ui/kenney/question.webp', chest: 'assets/ui/kenney/chest.webp', cross: 'assets/ui/kenney/cross.webp', trophy: 'assets/ui/kenney/trophy.webp',
        sword: 'assets/ui/kenney/sword.webp',
    },
    SPLAT: 'assets/fx/splat_03.webp',
    // Логотип-картинка под название сборки (GAME_TITLE): Playables — «ASMR Obby Destroyer». Нет картинки — текстовый.
    LOGOS: {
        'ASMR Obby Slicer': { ru: 'assets/ui/logo_ru.webp', en: 'assets/ui/logo_en.webp' },
        'ASMR Obby Destroyer': { ru: 'assets/ui/logo_destroyer.webp', en: 'assets/ui/logo_destroyer.webp' },
    },
    // окно «Только краска»: пиньята, робот, пиньята
    FACES: ['assets/ui/faces/happy.webp', 'assets/ui/faces/robot.webp', 'assets/ui/faces/grin.webp'],

    ico(name) {
        if (name === 'coin') return '<span class="pb-ico pb-coin"></span>';
        return '<span class="pb-ico" style="background-image:url(' + (this.ICON[name] || '') + ')"></span>';
    },
    adTag() { return '<span class="pb-ico" style="background-image:url(' + this.ICON.video + ')"></span>'; },

    init() {
        const style = document.createElement('style');
        style.textContent = this.CSS;
        document.head.appendChild(style);
        const root = document.createElement('div');
        root.id = 'pb-ui';
        root.innerHTML = `
<div id="pb-bars"></div>
<div id="pb-float"></div>
<div id="pb-joy"><i></i></div>
<div id="pb-vig"></div>
<div id="pb-combo"></div>
<div id="pb-hud" class="pb-layer">
  <div id="pb-top" data-hl="top" class="on">
    <button class="pb-btn icon white small" id="pb-restart" aria-label="restart">${this.ico('restart')}</button>
    <div class="pb-prog" id="pb-prog"></div>
    <button class="pb-btn icon small" id="pb-pause" aria-label="pause">${this.ico('pause')}</button>
  </div>
  <div id="pb-coins" data-hl="coins">${this.ico('coin')}<span id="pb-coins-n">0</span></div>
  <div id="pb-side" data-hl="side" class="on">
    <div id="pb-enemies"></div>
    <button class="pb-btn purple small" id="pb-skip">${this.adTag()}<span class="t" data-t="ad.skip"></span></button>
    <button class="pb-btn icon white small" id="pb-sound" aria-label="sound">${this.ico('sound_on')}</button>
  </div>
  <div id="pb-boss" data-t="boss"></div>
  <div id="pb-bossbar"><div class="n"></div><div class="b"><i></i></div></div>
</div>
<div id="pb-menu" class="pb-screen">
  <div id="pb-menu-top">
    <div></div>
    <div class="pb-row" style="gap:10px">
      <div id="pb-coins-m" style="display:flex;align-items:center;gap:.35em;font:900 clamp(16px,3.6vmin,28px)/1 var(--pb-font);padding:.3em .8em .3em .35em;background:rgba(27,21,48,.72);border-radius:2em;outline:3px solid var(--pb-ink)">${this.ico('coin')}<span id="pb-coins-mn">0</span></div>
      <button class="pb-btn icon white small" id="pb-settings-btn" aria-label="settings">${this.ico('gear')}</button>
    </div>
  </div>
  <div id="pb-logo"><img id="pb-logo-img" alt="" hidden><div class="pb-h1" data-t="title"></div><div class="sub" data-t="title.sub"></div></div>
  <div id="pb-menu-left">
    <button class="pb-tile" id="pb-m-shop" style="--b1:var(--pb-blue);--b2:var(--pb-blue2)">${this.ico('cart')}<span class="t" data-t="shop"></span><span class="dot">!</span></button>
    <button class="pb-tile" id="pb-m-daily" style="--b1:var(--pb-green);--b2:var(--pb-green2)">${this.ico('gift')}<span class="t" data-t="daily"></span><span class="dot">!</span></button>
    <button class="pb-tile" id="pb-m-wheel" style="--b1:var(--pb-purple);--b2:var(--pb-purple2)">${this.ico('wheel')}<span class="t" data-t="wheel"></span><span class="dot">!</span></button>
    <button class="pb-tile" id="pb-m-up" style="--b1:var(--pb-red);--b2:var(--pb-red2)">${this.ico('sword')}<span class="t" data-t="up"></span><span class="dot">!</span></button>
    <button class="pb-tile" id="pb-m-top" style="--b1:var(--pb-orange);--b2:var(--pb-orange2)">${this.ico('trophy')}<span class="t" data-t="top"></span></button>
  </div>
  <div id="pb-menu-bottom">
    <div id="pb-menu-level"></div>
    <button class="pb-btn big" id="pb-play"><span class="t" data-t="play"></span></button>
    <button class="pb-btn white small" id="pb-howto">${this.ico('question')}<span class="t" data-t="howto"></span></button>
  </div>
</div>
<div id="pb-win" class="pb-screen pb-dim">
  <div class="pb-col">
    <div style="position:relative"><div class="pb-splat" style="--sm:url(${this.SPLAT});--sc:#ff8a1f"></div><div class="pb-h1" data-t="win"></div></div>
    <div class="pb-reward" id="pb-win-coins">${this.ico('coin')}<span>+0</span></div>
    <div class="pb-row">
      <button class="pb-btn purple" id="pb-win-x2">${this.adTag()}<span class="t" data-t="ad.x2"></span></button>
    </div>
    <div class="pb-row">
      <button class="pb-btn icon red big" id="pb-win-home" aria-label="menu">${this.ico('home')}</button>
      <button class="pb-btn green big" id="pb-win-next"><span class="t" data-t="continue"></span></button>
    </div>
  </div>
</div>
<div id="pb-lose" class="pb-screen pb-dim">
  <div class="pb-col">
    <div class="pb-h1" data-t="lose"></div>
    <div class="pb-h2" data-t="lose.hint"></div>
    <button class="pb-btn purple" id="pb-lose-revive">${this.adTag()}<span class="t" data-t="ad.revive"></span></button>
    <div class="pb-row">
      <button class="pb-btn icon red big" id="pb-lose-home" aria-label="menu">${this.ico('home')}</button>
      <button class="pb-btn big" id="pb-lose-again"><span class="t" data-t="again"></span></button>
    </div>
  </div>
</div>
<div id="pb-pause-s" class="pb-screen pb-dim">
  <div class="pb-col">
    <div class="pb-h1" data-t="pause"></div>
    <button class="pb-btn green big" id="pb-resume"><span class="t" data-t="continue"></span></button>
    <div class="pb-row">
      <button class="pb-btn white small" id="pb-p-restart">${this.ico('restart')}<span class="t" data-t="restart"></span></button>
      <button class="pb-btn white small" id="pb-p-howto">${this.ico('question')}<span class="t" data-t="howto"></span></button>
      <button class="pb-btn white small" id="pb-p-settings">${this.ico('gear')}<span class="t" data-t="settings"></span></button>
    </div>
    <button class="pb-btn red small" id="pb-p-menu">${this.ico('home')}<span class="t" data-t="menu"></span></button>
  </div>
</div>
<div id="pb-settings" class="pb-screen pb-dim">
  <div class="pb-col"><div class="pb-panel">
    <h3 data-t="settings"></h3>
    <div class="pb-set"><span data-t="sound"></span><span class="pb-seg" id="pb-set-sound"></span></div>
    <div class="pb-set"><span data-t="music"></span><span class="pb-seg" id="pb-set-music"></span></div>
    <div class="pb-set"><span data-t="quality"></span><span class="pb-seg" id="pb-set-quality"></span></div>
    <div class="pb-set"><span data-t="outline"></span><span class="pb-seg" id="pb-set-outline"></span></div>
    <div class="pb-row" style="margin-top:14px"><button class="pb-btn small" id="pb-set-close"><span class="t" data-t="close"></span></button></div>
  </div></div>
</div>
<div id="pb-chest" class="pb-screen" style="cursor:pointer">
  <div class="pb-col" style="margin-top:6vh;margin-bottom:auto">
    <div class="pb-h1" data-t="chest"></div>
    <div id="pb-chest-img"></div>
    <div class="pb-h2" id="pb-chest-txt" data-t="chest.tap"></div>
  </div>
</div>
<div id="pb-up" class="pb-screen pb-dim">
  <div class="pb-col"><div class="pb-panel">
    <div class="pb-up-head"><h3 data-t="up"></h3><div class="pb-up-coins">${this.ico('coin')}<span id="pb-up-coins-n">0</span></div>
      <button class="pb-btn red small icon" id="pb-up-close" aria-label="close">${this.ico('cross')}</button></div>
    <div class="pb-up-list" id="pb-up-list"></div>
    <div id="pb-up-legend"></div>
  </div></div>
</div>
<div id="pb-top-s" class="pb-screen pb-dim">
  <div class="pb-col"><div class="pb-panel" style="min-width:min(92vw,420px)">
    <h3 data-t="top"></h3>
    <div class="pb-h2" style="color:var(--pb-ink);-webkit-text-stroke:0;font-size:clamp(13px,2.6vmin,17px);margin-bottom:8px" data-t="top.what"></div>
    <div id="pb-top-list"></div>
    <div class="pb-row" style="margin-top:14px">
      <button class="pb-btn blue small" id="pb-top-login"><span class="t" data-t="top.login"></span></button>
      <button class="pb-btn small" id="pb-top-close"><span class="t" data-t="close"></span></button>
    </div>
  </div></div>
</div>
<div id="pb-err" class="pb-screen pb-dim">
  <div class="pb-col"><div class="pb-h2" data-t="saveError"></div><button class="pb-btn" id="pb-err-retry"><span class="t" data-t="saveRetry"></span></button></div>
</div>
<div id="pb-notice" class="pb-screen pb-dim">
  <div class="pb-col"><div class="pb-panel">
    <h3 data-t="notice.title"></h3>
    <div class="pb-nt-row">
      <div class="pb-nt-i" style="--sc:#ff3d7f;--sm:url(${this.SPLAT})"><i style="background-image:url(${this.FACES[0]})"></i></div>
      <div class="pb-nt-i" style="--sc:#2f9bff;--sm:url(${this.SPLAT})"><i style="background-image:url(${this.FACES[1]})"></i></div>
      <div class="pb-nt-i" style="--sc:#ffd23f;--sm:url(${this.SPLAT})"><i style="background-image:url(${this.FACES[2]})"></i></div>
    </div>
    <div class="pb-nt-t" data-t="notice.text"></div>
    <div class="pb-row"><button class="pb-btn green" id="pb-notice-ok"><span class="t" data-t="notice.ok"></span></button></div>
  </div></div>
</div>
<div id="pb-toast"></div>`;
        document.body.appendChild(root);
        this.root = root;
        for (const n of root.querySelectorAll('[id]')) this.el[n.id] = /** @type {HTMLElement} */ (n);
        this.el['pb-chest-img'].style.backgroundImage = 'url(' + this.ICON.chest + ')';
        // логотип-картинка на языке игры (assets/ui/logo_ru.webp | logo_en.webp); заглушка 1×1 — остаётся текст
        const logo = /** @type {HTMLImageElement} */ (this.el['pb-logo-img']);
        logo.onload = () => { if (logo.naturalWidth >= 64) { logo.hidden = false; this.el['pb-logo'].classList.add('img'); } };
        const logos = this.LOGOS[typeof GAME_TITLE !== 'undefined' ? GAME_TITLE : ''] || null;
        if (logos) logo.src = Lang.code === 'ru' ? logos.ru : logos.en;
        Lang.apply(root);
        this._layout();
        this._joystick();
        this._bind();
    },

    _layout() {
        if (typeof HudLayout === 'undefined') return;
        // портрет: монеты — в левом верхнем углу под панелью нет места, поэтому панель уровня — во всю ширину
        // сверху, монеты и боковой блок — колонкой справа ниже неё (mr)
        HudLayout.block('top', { dock: 'tc', w: 330, h: 64, fill: false, el: '#pb-top' });
        HudLayout.block('coins', { dock: { tall: 'mr', default: 'tr' }, w: 124, h: 44, el: '#pb-coins' });
        HudLayout.block('side', { dock: 'mr', w: 190, h: 150, el: '#pb-side', order: 1 });
        // полоса босса — под панелью уровня, между колонками; пока босса нет — места не занимает
        HudLayout.block('bossbar', { dock: 'tc', w: 400, h: 50, minW: 200, el: '#pb-bossbar', order: 0,
            visible: () => !!this.el['pb-bossbar'] && this.el['pb-bossbar'].classList.contains('show') });
    },

    // Кнопки -> Game. Защита от двойного нажатия — у Game (busy).
    _bind() {
        const on = (id, fn) => { const e = this.el[id]; if (e) e.addEventListener('click', (ev) => { ev.stopPropagation(); this.click(); fn(); }); };
        on('pb-play', () => Game.play());
        on('pb-howto', () => Game.howTo());
        on('pb-p-howto', () => Game.howTo());
        on('pb-restart', () => Game.restartLevel());
        on('pb-p-restart', () => Game.restartLevel());
        on('pb-pause', () => Game.pause(true));
        on('pb-resume', () => Game.pause(false));
        on('pb-p-menu', () => Game.toMenu());
        on('pb-p-settings', () => this.showSettings(true));
        on('pb-settings-btn', () => this.showSettings(true));
        on('pb-set-close', () => this.showSettings(false));
        on('pb-sound', () => Game.toggleSound());
        on('pb-skip', () => Game.skipLevel());
        on('pb-win-next', () => Game.nextLevel());
        on('pb-win-home', () => Game.toMenu(true));
        on('pb-win-x2', () => Game.winX2());
        on('pb-lose-again', () => Game.retry());
        on('pb-lose-home', () => Game.toMenu(true));
        on('pb-lose-revive', () => Game.revive());
        on('pb-m-shop', () => Game.openShop('shop'));
        on('pb-m-daily', () => Game.openShop('daily'));
        on('pb-m-wheel', () => Game.openShop('wheel'));
        on('pb-err-retry', () => Game.retryLoad());
        on('pb-notice-ok', () => Game.noticeOk());
        on('pb-m-top', () => Game.openTop());
        on('pb-m-up', () => Game.openUpgrades());
        on('pb-up-close', () => Game.closeUpgrades());
        this.el['pb-up-list'].addEventListener('scroll', () => this.upScrollHint(), { passive: true });
        window.addEventListener('resize', () => this.upScrollHint());
        on('pb-top-close', () => this.show('pb-top-s', false));
        on('pb-top-login', () => Game.login());
        on('pb-chest', () => Game.openChest());
    },

    click() { if (typeof Game !== 'undefined') Game.sfx('assets/sounds/click.ogg', { volume: 0.5 }); },

    // --- Экраны -----------------------------------------------------------------------------

    show(id, on) { const e = this.el[id]; if (e) e.classList.toggle('show', !!on); },

    setMode(mode) {
        this.mode = mode;
        this.show('pb-menu', mode === 'menu');
        this.el['pb-hud'].classList.toggle('show', mode === 'play');
        if (mode !== 'play') this._release();
        for (const id of ['pb-win', 'pb-lose', 'pb-pause-s', 'pb-chest']) if (mode !== 'result') this.show(id, false);
        if (typeof HudLayout !== 'undefined') HudLayout.refresh();
    },

    showSettings(on) {
        this.show('pb-settings', on);
        if (on) this.renderSettings();
    },

    renderSettings() {
        const s = Game.settings();
        const seg = (id, opts, cur, fn) => {
            const host = this.el[id];
            host.innerHTML = '';
            for (const [v, key] of opts) {
                const b = document.createElement('button');
                b.textContent = Lang.t(key);
                if (v === cur) b.className = 'sel';
                b.addEventListener('click', () => { this.click(); fn(v); this.renderSettings(); });
                host.appendChild(b);
            }
        };
        seg('pb-set-sound', [[1, 'on'], [0, 'off']], s.sfx ? 1 : 0, v => Game.setSetting('sfx', v));
        seg('pb-set-music', [[1, 'on'], [0, 'off']], s.music ? 1 : 0, v => Game.setSetting('music', v));
        seg('pb-set-outline', [[1, 'on'], [0, 'off']], s.outline ? 1 : 0, v => Game.setSetting('outline', v));
        seg('pb-set-quality', [['auto', 'quality.auto'], ['low', 'quality.low'], ['medium', 'quality.medium'], ['high', 'quality.high']], s.quality || 'auto', v => Game.setSetting('quality', v));
    },

    // Прогресс главы: 5 кружков, текущий — оранжевый, пройденные — зелёные; сундук под 5-м.
    renderProgress(n) {
        const stage = ((n - 1) % 5) + 1, host = this.el['pb-prog'];
        let h = '';
        for (let i = 1; i <= 5; i++) {
            if (i > 1) h += '<div class="pb-link' + (i <= stage ? ' done' : '') + '"></div>';
            h += '<div class="pb-node' + (i < stage ? ' done' : i === stage ? ' cur' : '') + '">' + (i < stage ? '✓' : (Math.floor((n - 1) / 5) * 5 + i)) + '</div>';
        }
        h += '<div class="pb-chest" style="background-image:url(' + this.ICON.chest + ')"></div>';
        host.innerHTML = h;
        this.el['pb-menu-level'].textContent = Lang.t('level', { n });
    },

    setCoins(n) {
        const was = this._coins;
        this._coins = n;
        this.el['pb-coins-n'].textContent = String(n);
        this.el['pb-coins-mn'].textContent = String(n);
        if (was != null && n > was) { this.bump(this.el['pb-coins']); this.bump(this.el['pb-coins-m']); }
    },
    /** @type {number | null} */ _coins: null,

    bump(el) { if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); },

    // Монетки вылетают из точки экрана и летят в счётчик.
    flyCoins(sx, sy, n) {
        const target = this.el[this.mode === 'play' ? 'pb-coins' : 'pb-coins-m'];
        if (!target) return;
        const r = target.getBoundingClientRect(), tx = ViewCap.x(r.left) + 22, ty = r.top + r.height / 2;
        for (let i = 0; i < Math.min(6, n); i++) {
            const c = document.createElement('span');
            c.className = 'pb-ico pb-coin pb-flycoin';
            c.style.left = sx + 'px'; c.style.top = sy + 'px';
            this.el['pb-float'].appendChild(c);
            setTimeout(() => {
                c.style.left = (sx + (Math.random() - 0.5) * 90) + 'px'; c.style.top = (sy - 40 - Math.random() * 50) + 'px';
                setTimeout(() => { c.style.left = tx + 'px'; c.style.top = ty + 'px'; c.style.transform = 'scale(0.6)'; }, 180);
            }, 20 + i * 60);
            setTimeout(() => { c.remove(); this.bump(target); }, 900 + i * 60);
        }
    },

    // Вспышка по краям экрана: игрока задели (цвет — краска врага).
    hurt(color) {
        const v = this.el['pb-vig'];
        if (color) v.style.setProperty('--vig', color);
        v.classList.remove('hit'); void v.offsetWidth; v.classList.add('hit');
    },

    combo(n) {
        const c = this.el['pb-combo'];
        c.textContent = Lang.t('combo', { n });
        c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
    },

    // Число набегает от 0 до n (награда).
    countUp(el, n, prefix) {
        const t0 = performance.now(), dur = 700;
        const tick = () => {
            const u = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - u, 3);
            el.textContent = (prefix || '') + Math.round(n * e);
            if (u < 1) requestAnimationFrame(tick); else this.bump(el.parentElement);
        };
        tick();
        setTimeout(() => { el.textContent = (prefix || '') + n; }, dur + 100);   // скрытая вкладка: rAF стоит
    },

    // Капли краски стекают с верхнего края (победа).
    drips(colors) {
        const host = this.el['pb-float'];
        for (let i = 0; i < 14; i++) {
            const d = document.createElement('div');
            d.className = 'pb-drip';
            d.style.left = (Math.random() * 100) + '%';
            d.style.background = colors[i % colors.length];
            d.style.setProperty('--h', (40 + Math.random() * 140) + 'px');
            d.style.width = (8 + Math.random() * 14) + 'px';
            d.style.animationDuration = (1.4 + Math.random() * 1.2) + 's';
            d.style.animationDelay = (Math.random() * 0.4) + 's';
            host.appendChild(d);
            setTimeout(() => d.remove(), 3200);
        }
    },

    setEnemies(left) { this.el['pb-enemies'].textContent = Lang.t('enemies.left', { n: left }); this.bump(this.el['pb-enemies']); },

    setSoundIcon(on) {
        const i = /** @type {HTMLElement} */ (this.el['pb-sound'].firstElementChild);
        if (i) i.style.backgroundImage = 'url(' + (on ? this.ICON.sound_on : this.ICON.sound_off) + ')';
    },

    setAdButtons(available) {
        for (const id of ['pb-skip', 'pb-win-x2', 'pb-lose-revive']) {
            const b = /** @type {HTMLButtonElement} */ (this.el[id]);
            if (b) b.style.display = available ? '' : 'none';
        }
    },

    // --- Прокачка ---------------------------------------------------------------------------------

    UP_ICONS: {
        dmg: { c: '#ff5d5d', svg: '<svg viewBox="0 0 24 24"><path d="M19 3l2 2-9.5 9.5-2-2z" fill="#fff" stroke="#1b1530" stroke-width="1.6"/><path d="M7.5 14.5l2 2-2.5 2.5 1 1-1.5 1.5-3-3L5 17l1 1z" fill="#ffd23f" stroke="#1b1530" stroke-width="1.6"/></svg>' },
        hp: { c: '#ff3d7f', svg: '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" fill="#fff" stroke="#1b1530" stroke-width="1.8"/></svg>' },
        shield: { c: '#2f9bff', svg: '<svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="#fff" stroke="#1b1530" stroke-width="1.8"/><path d="M12 6v12" stroke="#2f9bff" stroke-width="2.4"/></svg>' },
        speed: { c: '#2fd36b', svg: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-2 8 9-12h-7z" fill="#fff" stroke="#1b1530" stroke-width="1.8" stroke-linejoin="round"/></svg>' },
        vamp: { c: '#c41e5a', svg: '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" fill="#fff" stroke="#1b1530" stroke-width="1.8"/><path d="M9 9l1.3 3L11.5 9M12.5 9l1.2 3L15 9" fill="#fff" stroke="#c41e5a" stroke-width="1.4" stroke-linejoin="round"/></svg>' },
        reach: { c: '#9b4dff', svg: '<svg viewBox="0 0 24 24"><path d="M3 12h15" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M14 7l6 5-6 5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 12h15M14 7l6 5-6 5" fill="none" stroke="#1b1530" stroke-width="1.2"/></svg>' },
        spin: { c: '#ff8a1f', svg: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 1-8.5 6" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M2 5l1.6 4.4L8 8" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="#ffd23f" stroke="#1b1530" stroke-width="1.5"/></svg>' },
    },

    renderUpgrades() {
        const host = this.el['pb-up-list'];
        if (!host) return;
        const up = Game.upgrades(), coins = Game.coins(), max = GameData.UPGRADE_MAX;
        this.el['pb-up-coins-n'].textContent = String(coins);
        host.innerHTML = '';
        const legendHost = this.el['pb-up-legend'];
        legendHost.innerHTML = '';
        const row = (key, name, desc, right, extra, cls) => {
            const ic = this.UP_ICONS[key];
            const r = document.createElement('div');
            r.className = 'pb-up-row' + (cls ? ' ' + cls : '');
            r.dataset.key = key;
            r.style.setProperty('--c', ic.c);
            r.innerHTML = '<div class="pb-up-ic">' + ic.svg + '</div><div class="pb-up-mid">' + (extra || '') + '<div class="pb-up-name"></div><div class="pb-up-val"></div><div class="pb-up-desc"></div></div>';
            /** @type {HTMLElement} */ (r.querySelector('.pb-up-name')).textContent = name.split('|')[0];
            /** @type {HTMLElement} */ (r.querySelector('.pb-up-val')).textContent = name.split('|')[1] || '';
            /** @type {HTMLElement} */ (r.querySelector('.pb-up-desc')).textContent = desc;
            r.appendChild(right);
            (cls === 'legend' ? legendHost : host).appendChild(r);
            return r;
        };
        for (const key of ['dmg', 'hp', 'shield', 'speed', 'reach', 'vamp']) {
            const lvl = Math.min(max, up[key] | 0), U = GameData.UPGRADES[key];
            const val = key === 'shield' ? '+' + Math.round(U.step * lvl) : key === 'vamp' ? Lang.t('up.vamp.v', { n: Math.round(U.step * lvl) })
                : '+' + Math.round(U.step * lvl * 100) + '%';
            const btn = document.createElement('button');
            if (lvl >= max) { btn.className = 'pb-btn white small pb-up-buy'; btn.disabled = true; btn.innerHTML = '<span class="t">' + Lang.t('up.max') + '</span>'; }
            else {
                const price = GameData.upgradePrice(key, lvl);
                const byAd = coins < price && Platform.rewardedSupported();   // монет мало — уровень за рекламу
                btn.className = 'pb-btn small pb-up-buy ' + (byAd ? 'purple' : 'green');
                btn.innerHTML = byAd ? this.adTag() + '<span class="t">' + Lang.t('up.ad') + '</span>'
                    : '<span class="pb-ico pb-coin"></span><span class="t">' + price + '</span>';
                btn.addEventListener('click', (e) => { e.stopPropagation(); this.click(); if (byAd) Game.upgradeByAd(key, btn); else Game.buyUpgrade(key); });
            }
            const r = row(key, Lang.t('up.' + key) + '|' + Lang.t('up.lvl', { n: lvl, m: max }) + ' · ' + val, Lang.t('up.' + key + '.d'), btn, '');
            const pips = document.createElement('div');
            pips.className = 'pb-up-pips';
            for (let i = 0; i < max; i++) { const p = document.createElement('i'); if (i < lvl) p.className = 'on'; pips.appendChild(p); }
            /** @type {HTMLElement} */ (r.querySelector('.pb-up-mid')).appendChild(pips);
        }
        // легендарный навык «Вихрь»
        const btn = document.createElement('button');
        if (!up.spin) {
            btn.className = 'pb-btn small pb-up-buy';
            btn.innerHTML = '<span class="pb-ico pb-coin"></span><span class="t">' + GameData.SPIN_PRICE + '</span>';
            btn.addEventListener('click', (e) => { e.stopPropagation(); this.click(); Game.buyUpgrade('spin'); });
        } else {
            const on = up.spinOn !== false;
            btn.className = 'pb-btn small pb-up-buy ' + (on ? 'green' : 'white');
            btn.innerHTML = '<span class="t">' + Lang.t(on ? 'up.on' : 'up.off') + '</span>';
            btn.addEventListener('click', (e) => { e.stopPropagation(); this.click(); Game.toggleSpin(); });
        }
        const sr = row('spin', Lang.t('up.spin'), Lang.t('up.spin.d'), btn, '<span class="pb-up-tag">' + Lang.t('up.spin.tag') + '</span>', 'legend');
        /** @type {HTMLElement} */ (sr.querySelector('.pb-up-val')).textContent = Lang.t('up.spin.d');
        /** @type {HTMLElement} */ (sr.querySelector('.pb-up-val')).style.whiteSpace = 'normal';
        /** @type {HTMLElement} */ (sr.querySelector('.pb-up-desc')).remove();
    },

    // Затухание снизу — только если список можно прокрутить дальше.
    upScrollHint() {
        const l = this.el['pb-up-list'];
        if (l) l.classList.toggle('more', l.scrollHeight - l.clientHeight - l.scrollTop > 4);
    },

    flashUpgrade(key) {
        const r = /** @type {HTMLElement | null} */ (this.el['pb-up'].querySelector('[data-key="' + key + '"]'));
        if (r) { r.classList.remove('bought'); void r.offsetWidth; r.classList.add('bought'); }
    },

    // Таблица рекордов: rows — [{ rank, name, score, me, avatar? }] или null (площадка без рекордов).
    renderTop(rows, canLogin) {
        const host = this.el['pb-top-list'];
        host.innerHTML = '';
        if (!rows || !rows.length) {
            const e = document.createElement('div');
            e.className = 'pb-empty';
            e.textContent = Lang.t('top.empty');
            host.appendChild(e);
        }
        for (const r of rows || []) {
            const row = document.createElement('div');
            row.className = 'pb-lb' + (r.me ? ' me' : '');
            const rank = document.createElement('span'); rank.className = 'r'; rank.textContent = String(r.rank);
            let av;
            if (r.avatar) { av = document.createElement('img'); av.src = r.avatar; av.alt = ''; }
            else { av = document.createElement('span'); av.className = 'av'; }
            const name = document.createElement('span'); name.className = 'n'; name.textContent = r.name || '—';
            const sc = document.createElement('span'); sc.className = 's'; sc.textContent = String(r.score);
            row.append(rank, av, name, sc);
            host.appendChild(row);
        }
        this.el['pb-top-login'].style.display = canLogin ? '' : 'none';
    },

    alert(id, on) { const t = this.el[id]; if (t) t.classList.toggle('alert', !!on); },

    boss(name) {
        const b = this.el['pb-boss'];
        b.innerHTML = '';
        b.appendChild(document.createTextNode(Lang.t('boss')));
        if (name) { const s = document.createElement('small'); s.textContent = name; b.appendChild(s); }
        b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    },

    // Полоса здоровья босса сверху; null — убрать.
    bossBar(f) {
        const bar = this.el['pb-bossbar'];
        if (!bar) return;
        if (!f || !f.alive) { if (bar.classList.contains('show')) { bar.classList.remove('show'); if (typeof HudLayout !== 'undefined') HudLayout.refresh(); } return; }
        if (!bar.classList.contains('show')) {
            const bd = f.def && f.def.bossDef;
            /** @type {HTMLElement} */ (bar.firstElementChild).textContent = bd ? (Lang.code === 'ru' ? bd.name.ru : bd.name.en) : Lang.t('boss');
            bar.classList.add('show');
            if (typeof HudLayout !== 'undefined') HudLayout.refresh();
        }
        /** @type {HTMLElement} */ (bar.querySelector('i')).style.width = Math.max(0, f.hp / f.maxHp * 100) + '%';
    },

    toast(text, ms) {
        const t = this.el['pb-toast'];
        t.textContent = text;
        t.classList.add('show');
        clearTimeout(this._toastT);
        this._toastT = setTimeout(() => t.classList.remove('show'), ms || 1800);
    },
    _toastT: 0,

    // «+4» над точкой мира.
    floatText(x, y, h, text, color) {
        const v = Game.app && Game.app.location && Game.app.location.view;
        if (!v) return;
        const s = v.projectToScreen(x, y, h);
        if (!s || !s.visible) return;
        const d = document.createElement('div');
        d.className = 'pb-fl';
        d.textContent = text;
        if (color) d.style.color = color;
        d.style.left = s.x + 'px'; d.style.top = s.y + 'px';
        this.el['pb-float'].appendChild(d);
        setTimeout(() => d.remove(), 950);
    },

    // --- Джойстик: касание или ЛКМ в любом месте игрового поля ---------------------------------

    _joystick() {
        const canvas = document.getElementById('world3d');
        if (!canvas) return;
        const R = 58;
        const joy = this.el['pb-joy'], knob = /** @type {HTMLElement} */ (joy.firstElementChild);
        const set = (x, y) => {
            const st = this._stick;
            if (!st) return;
            let dx = x - st.x0, dy = y - st.y0;
            const d = Math.hypot(dx, dy);
            if (d > R) { dx = dx / d * R; dy = dy / d * R; }
            knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
            const k = d < 8 ? 0 : 1;
            GameFighters.stick.x = dx / R * k;
            GameFighters.stick.y = -dy / R * k;
        };
        canvas.addEventListener('pointerdown', (e) => {
            if (this.mode !== 'play' || this._stick || (e.pointerType === 'mouse' && e.button !== 0)) return;
            this._stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
            joy.style.left = ViewCap.x(e.clientX) + 'px'; joy.style.top = e.clientY + 'px';
            joy.style.display = 'block';
            knob.style.transform = '';
            try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* без захвата тоже работает */ }
            if (typeof Tutorial !== 'undefined' && Tutorial.active) Tutorial.setDevice(e.pointerType === 'touch' ? 'touch' : 'keyboard');
        });
        canvas.addEventListener('pointermove', (e) => { if (this._stick && e.pointerId === this._stick.id) set(e.clientX, e.clientY); });
        const end = (e) => { if (this._stick && e.pointerId === this._stick.id) this._release(); };
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', end);
        window.addEventListener('lory-release-input', () => this._release());
        window.addEventListener('blur', () => this._release());
    },

    _release() {
        this._stick = null;
        GameFighters.stick.x = 0; GameFighters.stick.y = 0;
        const joy = this.el['pb-joy'];
        if (joy) joy.style.display = 'none';
    },
};
