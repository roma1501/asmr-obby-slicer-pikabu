// GameShopUI.js — интерфейс магазина, Daily Gift и колеса фортуны Paint Blade (DOM поверх #world3d).
// Логика — Shop.js / DailyGift.js / Wheel.js (не правятся), данные — GameShopData.js; здесь только вид.
// Образ: «лавка красок». Окна — кремовые «холсты» с чернильной обводкой, шапка окна окрашена в цвет вкладки
// и с подтёками краски; вкладки магазина — цветные «тюбики» сбоку (в портрете — сверху); карточки — рамка
// цвета редкости. В магазине персонаж остаётся виден в 3D-сцене: панель справа (альбом) или снизу ~60% (портрет).
//
// Внешний API (его зовёт Game.js):
//   GameShopUI.init({ save, persist, onLook })  Shop/DailyGift/Wheel.init; save.shop|daily|wheel — их состояние;
//                                               onLook(cosm) — надетое или примерка изменились
//   GameShopUI.equipped(withPreview?)           { skin, hat, sword, paint, trail, victory } — объекты каталогов
//   GameShopUI.open('shop'|'daily'|'wheel') / close() / isOpen / badges() / maybeOfferDaily() / layout()
// В Game: onShopOpen(kind) при открытии, onShopClose() при закрытии, refreshCoins() после смены монет.

/** @satisfies {Record<string, any>} */
const GameShopUI = {
    isOpen: false,
    /** Какое окно показано: shop | daily | wheel. */
    kind: '',
    /** Текущая вкладка магазина. */
    tab: 'skins',
    _ready: false,
    /** @type {any} */ cfg: null,
    /** @type {HTMLElement | null} */ root: null,
    /** @type {Record<string, any>} */ el: {},
    _busy: false,
    _spinning: false,
    _wAngle: 0,
    _lookQueued: false,
    _refreshQueued: false,
    _timer: 0,
    _toastT: 0,
    _anim: 0,
    _lastTick: 0,
    _gridFresh: true,
    _winKey: '',
    /** @type {any} */ _recovered: null,
    /** @type {any} */ _popupFn: null,

    // Иконки (файлы — белые силуэты, цвет даёт маска). Пути литералами: сканер сборки.
    ICON: {
        coin: 'assets/ui/kenney/coin.webp', video: 'assets/ui/kenney/video.webp', cross: 'assets/ui/kenney/cross.webp',
        check: 'assets/ui/kenney/check.webp', lock: 'assets/ui/kenney/lock.webp', gift: 'assets/ui/kenney/gift.webp',
        wheel: 'assets/ui/kenney/wheel.webp', cart: 'assets/ui/kenney/cart.webp', trophy: 'assets/ui/kenney/trophy.webp',
        sword: 'assets/ui/kenney/sword.webp', play: 'assets/ui/kenney/play.webp', heart: 'assets/ui/kenney/heart.webp',
    },
    SPLATS: ['assets/fx/splat_01.webp', 'assets/fx/splat_02.webp', 'assets/fx/splat_03.webp', 'assets/fx/splat_04.webp',
        'assets/fx/splat_05.webp', 'assets/fx/splat_06.webp', 'assets/fx/splat_07.webp', 'assets/fx/splat_08.webp'],
    SFX: { reward: 'assets/sounds/reward.ogg', coin: 'assets/sounds/coin.ogg', tick: 'assets/sounds/wheel_tick.ogg' },

    CSS: `
#sh-root { position: fixed; inset: 0; z-index: 30; display: none; pointer-events: none; color: #fff; user-select: none; -webkit-user-select: none;
  font-family: var(--pb-font, 'PaintFont', 'Arial Black', system-ui, sans-serif); -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  --ink: var(--pb-ink, #1b1530); --cream: var(--pb-cream, #fff8ec); --tc1: #2f9bff; --tc2: #1667d9; }
#sh-root.show { display: block; }
#sh-root *, #sh-root *::before, #sh-root *::after { box-sizing: border-box; }
#sh-root button { font-family: inherit; }
#sh-root * { scrollbar-width: none; }
#sh-root *::-webkit-scrollbar { display: none; width: 0; height: 0; }
.sh-shade { position: absolute; inset: 0; display: none; pointer-events: auto; background: radial-gradient(ellipse at center, rgba(27,21,48,0.38), rgba(27,21,48,0.84)); }
#sh-root[data-mode=daily] .sh-shade, #sh-root[data-mode=wheel] .sh-shade { display: block; }
.sh-win { position: absolute; display: none; flex-direction: column; pointer-events: auto; overflow: hidden; color: var(--ink);
  background: radial-gradient(circle at 8% 92%, rgba(255,138,31,0.13) 0 11%, transparent 12%), radial-gradient(circle at 95% 22%, rgba(155,77,255,0.12) 0 9%, transparent 10%), var(--cream);
  border-radius: 22px; outline: 4px solid var(--ink); box-shadow: 0 7px 0 var(--ink); }
#sh-root[data-mode=shop] .sh-shop, #sh-root[data-mode=daily] .sh-daily, #sh-root[data-mode=wheel] .sh-wheelwin { display: flex; }
#sh-root[data-mode=daily] .sh-shade, #sh-root[data-mode=wheel] .sh-shade { animation: sh-fade 0.3s ease-out; }
.sh-win.in { transform-origin: 62% 58%; animation: sh-win-in 0.55s cubic-bezier(0.2, 0.9, 0.3, 1) both; }
/* ---- шапка окна: цвет вкладки + подтёки ---- */
.sh-head { position: relative; z-index: 3; flex: none; display: flex; align-items: center; gap: 8px; min-height: 56px; padding: 8px 10px 10px 16px;
  background: linear-gradient(180deg, var(--tc1) 0 56%, var(--tc2) 56%); border-bottom: 4px solid var(--ink); }
.sh-head::after { content: ''; position: absolute; left: 14px; right: 14px; top: calc(100% - 4px); height: 26px; pointer-events: none;
  background:
    radial-gradient(ellipse 6px 18px at 7px 0, var(--tc2) 96%, transparent 100%) 0 0 / 77px 100% repeat-x,
    radial-gradient(ellipse 5px 11px at 5px 0, var(--tc2) 96%, transparent 100%) 29px 0 / 53px 100% repeat-x,
    radial-gradient(ellipse 7px 24px at 8px 0, var(--tc2) 96%, transparent 100%) 11px 0 / 139px 100% repeat-x;
  filter: drop-shadow(2px 0 0 var(--ink)) drop-shadow(-2px 0 0 var(--ink)) drop-shadow(0 2px 0 var(--ink)); }
.sh-title { margin: 0 auto 0 0; font: italic 900 clamp(22px, 4.4vmin, 34px)/1 var(--pb-font, 'Arial Black', sans-serif); text-transform: uppercase; color: #fff; white-space: nowrap;
  -webkit-text-stroke: 0.11em var(--ink); paint-order: stroke fill; text-shadow: 0 0.07em 0 var(--ink); transform: rotate(-2.5deg); transform-origin: left center; }
.sh-coins { display: flex; align-items: center; gap: 0.3em; font: 900 20px/1 var(--pb-font, 'Arial Black', sans-serif); padding: 0.3em 0.75em 0.3em 0.4em; color: #fff;
  background: rgba(27,21,48,0.8); border-radius: 2em; outline: 3px solid var(--ink); white-space: nowrap; }
.sh-coins.bump { animation: sh-bump 0.45s ease-out; }
.sh-win .pb-btn { min-height: 44px; font-size: 15px; white-space: nowrap; }
.sh-win .pb-btn.small { font-size: 15px; padding: 0.5em 0.95em 0.58em; }
.sh-x::after, .sh-btn::after, .sh-wbtn::after { display: none; }
/* ---- иконки-маски: внешний span даёт чернильную обводку, внутренний — форму и цвет ---- */
.sh-ic { display: inline-block; flex: none; width: 1.25em; height: 1.25em; vertical-align: middle;
  filter: drop-shadow(0 0.07em 0 var(--ink)) drop-shadow(0 -0.05em 0 var(--ink)) drop-shadow(0.06em 0 0 var(--ink)) drop-shadow(-0.06em 0 0 var(--ink)); }
.sh-ic > i { display: block; width: 100%; height: 100%; background: var(--ic, #fff); -webkit-mask: var(--m) center / contain no-repeat; mask: var(--m) center / contain no-repeat; }
.sh-ic.gold { --ic: #ffd23f; }
.sh-tx { color: #fff; -webkit-text-stroke: 0.17em var(--ink); paint-order: stroke fill; }
/* ---- редкость ---- */
.r-common { --rc: #8e9bb4; --rs: rgba(142,155,180,0.26); }
.r-uncommon { --rc: #3fd16b; --rs: rgba(63,209,107,0.26); }
.r-rare { --rc: #2f9bff; --rs: rgba(47,155,255,0.26); }
.r-epic { --rc: #a45bff; --rs: rgba(164,91,255,0.3); }
.r-legendary { --rc: #ffb52e; --rs: rgba(255,181,46,0.38); }
/* ---- магазин ---- */
.sh-shop { right: calc(var(--hl-safe-r, 0px) + 8px); top: calc(var(--hl-safe-t, 0px) + 8px); bottom: calc(var(--hl-safe-b, 0px) + 8px); width: clamp(340px, 52vw, 740px); }
.sh-body { position: relative; z-index: 1; flex: 1; min-height: 0; display: flex; gap: 6px; padding: 22px 8px 8px 6px; }
.sh-tabs { flex: none; display: flex; flex-direction: column; gap: 9px; padding: 6px 8px 8px 6px; overflow-y: auto; scrollbar-width: none; }
.sh-tabs::-webkit-scrollbar { display: none; }
.sh-tab { position: relative; flex: none; width: 62px; min-height: 58px; padding: 5px 2px 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  border: 0; border-radius: 14px; cursor: pointer; color: #fff; text-transform: uppercase; font: 900 11.5px/1 var(--pb-font, 'Arial Black', sans-serif);
  background: linear-gradient(180deg, var(--tc1) 0 58%, var(--tc2) 58%); outline: 3px solid var(--ink); box-shadow: 0 4px 0 var(--ink), inset 0 3px 0 rgba(255,255,255,0.4);
  opacity: 0.8; filter: saturate(0.82); transition: transform 0.1s; }
.sh-tab .sh-tl { -webkit-text-stroke: 0.2em var(--ink); paint-order: stroke fill; letter-spacing: 0.01em; }
.sh-tab.on { opacity: 1; filter: none; transform: translateX(-2px) scale(1.07); z-index: 2; box-shadow: 0 0 0 3px #fff, 0 0 0 6px var(--ink), 0 6px 0 6px var(--ink), inset 0 3px 0 rgba(255,255,255,0.4); }
.sh-tab:active { transform: translateY(2px); }
.sh-tab.on .sh-tg { animation: sh-wiggle 0.55s ease-out; }
.sh-tg { width: 30px; height: 30px; display: grid; place-items: center; font-size: 26px; }
.sh-tg svg { width: 100%; height: 100%; display: block; overflow: visible; }
.sh-main { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.sh-sub { flex: none; display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 0 4px 5px 4px; font: 900 13px/1.1 var(--pb-font, 'Arial Black', sans-serif); color: var(--ink); }
.sh-sub .try { font-weight: 800; font-size: 12px; opacity: 0.62; text-align: right; }
.sh-tip { flex: none; display: none; margin: 0 6px 2px 4px; padding: 5px 9px 6px; border-radius: 11px; background: #fff; border: 3px solid var(--ink); color: var(--ink);
  font: 800 12.5px/1.25 var(--pb-font, 'Arial Black', sans-serif); text-align: left; overflow-wrap: anywhere; }
.sh-tip.on { display: block; min-height: 52px; animation: sh-tip-in 0.22s ease-out; }
.sh-tip.pv { border-color: var(--rc, var(--ink)); background: linear-gradient(#fff 40%, var(--rs, #fff)); }
.sh-tip b { font-weight: 900; }
.sh-tip .dim { opacity: 0.66; font-weight: 800; }
.sh-tip .ab { font-weight: 900; }
.sh-tip .ab.r-rare, .sh-tip .ab.r-common { color: #1f78d6; } .sh-tip .ab.r-epic { color: #8a3df0; } .sh-tip .ab.r-legendary { color: #b87400; }
.sh-tip .nm { display: block; }
@media (max-aspect-ratio: 1/1), (max-height: 460px) { .sh-tip .dim.sm { display: none; } }
.sh-grid { --cw: 116px; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; -webkit-overflow-scrolling: touch;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--cw), 1fr)); gap: 24px 16px; align-content: start; padding: 24px 14px 16px 14px; overflow-x: hidden;
  /* метка «Примерка» (−17 px) и рамка выбора (−11 px) живут в зазорах; край прокрутки — мягкий */
  -webkit-mask: linear-gradient(transparent, #000 8px, #000 calc(100% - 8px), transparent); mask: linear-gradient(transparent, #000 8px, #000 calc(100% - 8px), transparent); }
.sh-empty { grid-column: 1 / -1; padding: 24px 8px; text-align: center; font: 900 16px/1.3 var(--pb-font, 'Arial Black', sans-serif); color: var(--ink); opacity: 0.6; }
.sh-card { container-type: inline-size; position: relative; min-width: 0; display: flex; flex-direction: column; align-items: stretch; gap: 4px; padding: 6px 6px 7px; cursor: pointer; background: #fff;
  border: 4px solid var(--rc, #8e9bb4); border-radius: 15px; box-shadow: 0 0 0 3px var(--ink), 0 6px 0 3px var(--ink); transition: transform 0.1s; }
.sh-card:active { transform: translateY(2px) scale(0.97) rotate(0.8deg); }
@media (hover: hover) { .sh-card:hover { transform: translateY(-4px) rotate(-1.2deg); } .sh-card.sel:hover { transform: translateY(-5px) rotate(1deg); } }
.sh-card.in { animation: sh-card-in 0.42s cubic-bezier(0.2, 0.9, 0.3, 1.2) backwards; animation-delay: calc(var(--i, 0) * 26ms); }
.sh-card.r-epic::after, .sh-card.r-legendary::after { content: ''; position: absolute; inset: -4px; padding: 4px; border-radius: 15px; pointer-events: none; z-index: 1;
  background: linear-gradient(110deg, transparent 38%, rgba(255,255,255,0.95) 50%, transparent 62%) no-repeat 0 0 / 260% 100%;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude;
  animation: sh-shine 4.2s ease-in-out infinite; animation-delay: calc(var(--i, 0) * 170ms + 0.8s); }
.sh-card.r-legendary::after { animation-duration: 3.2s; }
.sh-card.r-epic { box-shadow: 0 0 0 3px var(--ink), 0 6px 0 3px var(--ink), 0 0 12px 4px rgba(164,91,255,0.4); }
.sh-card.r-legendary { box-shadow: 0 0 0 3px var(--ink), 0 6px 0 3px var(--ink), 0 0 16px 5px rgba(255,181,46,0.6); }
.sh-card.sel { transform: translateY(-3px); background: linear-gradient(#fff 30%, var(--rs)); }
.sh-card.sel::before { content: ''; position: absolute; inset: -11px; border: 3px dashed var(--ink); border-radius: 21px; pointer-events: none; }
.sh-card.pop { animation: sh-buy 0.6s ease-out; }
.sh-art { position: absolute; inset: 0; display: block; overflow: hidden; pointer-events: none; }
.sh-art > svg, .sh-art > img, .sh-art > .sh-splw { position: absolute; left: 10%; top: 10%; width: 80%; height: 80%; display: block; object-fit: contain; }
.sh-art > .sh-splw { width: auto; max-width: 80%; aspect-ratio: 1; left: 50%; transform: translateX(-50%); }
.sh-pic { position: relative; flex: none; height: var(--pic, 88px); border-radius: 10px; overflow: hidden;
  background: radial-gradient(circle at 50% 38%, #fff 0 22%, var(--rs) 23% 100%); }
.sh-pic > .sh-art { inset: 0 0 17px 0; }
.sh-stars { position: absolute; left: 0; right: 0; bottom: 0; height: 17px; display: flex; align-items: center; justify-content: center; font-size: 11px; line-height: 1; letter-spacing: -1px; color: var(--rc);
  -webkit-text-stroke: 0.26em var(--ink); paint-order: stroke fill; pointer-events: none; }
.sh-bd { position: absolute; top: -10px; width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; outline: 3px solid var(--ink); z-index: 2; font-size: 14px; }
.sh-bd.eq { right: -10px; background: var(--pb-green, #2fd36b); animation: sh-beat 1.5s ease-in-out infinite; }
.sh-bd.eq::after { content: ''; position: absolute; inset: -3px; border-radius: 50%; border: 3px solid var(--pb-green, #2fd36b); pointer-events: none; animation: sh-ripple 1.5s ease-out infinite; }
.sh-bd.lk { left: -10px; background: #fff; --ic: var(--ink); }
.sh-bd.lk .sh-ic { filter: none; }
.sh-bd.gf { left: -10px; background: #ffd23f; --ic: var(--ink); }
.sh-bd.gf .sh-ic { filter: none; }
.sh-tryon { position: absolute; left: 50%; top: -17px; transform: translateX(-50%); padding: 3px 8px 4px; border-radius: 9px; background: var(--ink); color: #fff; z-index: 3;
  font: 900 11px/1 var(--pb-font, 'Arial Black', sans-serif); text-transform: uppercase; white-space: nowrap; }
.sh-name { min-height: 2.3em; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; text-align: center; overflow-wrap: break-word;
  font: 900 13px/1.15 var(--pb-font, 'Arial Black', sans-serif); color: var(--ink); font-size: clamp(10px, calc(96cqw / (var(--len, 8) * 0.7)), 13px); }
.sh-cap { margin-top: -2px; text-align: center; font: 800 11px/1.1 var(--pb-font, 'Arial Black', sans-serif); color: var(--ink); opacity: 0.6; }
.sh-stats { display: flex; flex-direction: column; gap: 2px; padding: 0 2px; }
.sh-st { display: flex; align-items: center; gap: 4px; height: 11px; }
.sh-sti { flex: none; width: 11px; height: 11px; }
.sh-sti svg { display: block; width: 100%; height: 100%; overflow: visible; }
.sh-stl { flex: none; min-width: 5.1em; font: 800 10px/1 var(--pb-font, 'Arial Black', sans-serif); color: var(--ink); opacity: 0.8; white-space: nowrap; }
.sh-bar { position: relative; flex: 1; min-width: 14px; height: 6px; border-radius: 3px; background: #e6e1f4; outline: 1.5px solid var(--ink); overflow: hidden; }
.sh-bar i { display: block; height: 100%; border-radius: 3px; background: var(--bc, #ff5d1f); }
.sh-abil { align-self: center; max-width: 100%; margin-top: -1px; padding: 2px 8px 3px; border-radius: 9px; outline: 2px solid var(--ink); color: #fff; text-align: center;
  font: 900 10.5px/1.1 var(--pb-font, 'Arial Black', sans-serif); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; -webkit-text-stroke: 0.18em var(--ink); paint-order: stroke fill; }
.sh-abil.a-rare, .sh-abil.a-common, .sh-abil.a-uncommon { background: linear-gradient(#58b2ff, #2f8cf0); }
.sh-abil.a-epic { background: linear-gradient(#b87cff, #8a3df0); }
.sh-abil.a-legendary { background: linear-gradient(100deg, #ffb52e 0%, #fff0a0 30%, #ffb52e 50%, #ffd23f 70%, #e8960c 100%) 0 0 / 220% 100%; animation: sh-gold 2.6s linear infinite; color: #fff; }
.sh-abdot { display: none; }
.sh-sk { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 1px 8px; font: 900 12px/1.15 var(--pb-font, 'Arial Black', sans-serif); color: var(--ink); }
.sh-sk .sh-ic { font-size: 13px; }
.sh-sk span { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
.sh-sk .rn { font-size: 11px; opacity: 0.85; }
.sh-price { min-height: 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; text-align: center; color: var(--ink);
  font: 900 13px/1.1 var(--pb-font, 'Arial Black', sans-serif); }
.sh-pr { display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 15px; }
.sh-pr.ad { font-size: 12px; color: var(--pb-purple2, #6c22e0); }
.sh-pr.poor b { color: #d62c86; }
.sh-pr .sh-ic { font-size: 15px; }
.sh-state { font-size: 13px; color: #0e8a3f; }
.st-owned .sh-state { color: var(--ink); opacity: 0.7; }
.sh-pips { display: flex; gap: 3px; justify-content: center; }
.sh-pips i { width: 9px; height: 9px; border-radius: 50%; background: #dcd6ee; outline: 2px solid var(--ink); }
.sh-pips i.on { background: var(--pb-purple, #9b4dff); }
.sh-btn { width: 100%; padding: 0.4em 0.3em 0.46em; font-size: 14px; gap: 0.3em; }
.sh-win .pb-btn.sh-btn { font-size: 14px; padding: 0.4em 0.3em 0.46em; }
.sh-win .pb-btn.off { filter: grayscale(0.9) brightness(0.86); }
.sh-win .pb-btn.busy { pointer-events: none; }
.sh-btn .sh-ic { font-size: 16px; }
/* ---- подарок дня ---- */
.sh-daily, .sh-wheelwin { left: 50%; top: 50%; translate: -50% -50%; width: min(94vw, 780px); max-height: calc(100% - 16px); }
.sh-daily { --tc1: #2fd36b; --tc2: #11a84e; }
.sh-wheelwin { --tc1: #9b4dff; --tc2: #6c22e0; width: min(94vw, 900px); }
.sh-dbody { position: relative; z-index: 1; flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 24px 16px 16px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 0.64fr); gap: 12px 16px; align-items: stretch; }
.sh-dsub { grid-row: 1; grid-column: 1 / -1; margin: 0 0 -2px; text-align: center; font: 800 14px/1.2 var(--pb-font, 'Arial Black', sans-serif); color: var(--ink); opacity: 0.7; }
.sh-days { grid-row: 2; grid-column: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 10px; }
.sh-day { position: relative; min-width: 0; min-height: 104px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 2px; padding: 6px 4px 7px;
  background: #fff; border: 4px solid #c4bde0; border-radius: 15px; box-shadow: 0 0 0 3px var(--ink), 0 5px 0 3px var(--ink); color: var(--ink); }
.sh-dn { font: 900 12px/1 var(--pb-font, 'Arial Black', sans-serif); text-transform: uppercase; opacity: 0.75; }
.sh-dpic { position: relative; flex: 1; min-height: 36px; width: 100%; display: flex; align-items: center; justify-content: center; }
.sh-dlab { display: flex; align-items: center; justify-content: center; gap: 3px; font: 900 16px/1 var(--pb-font, 'Arial Black', sans-serif); }
.sh-dlab .sh-ic { font-size: 17px; }
.sh-dnm { font: 800 11px/1.05 var(--pb-font, 'Arial Black', sans-serif); text-align: center; opacity: 0.65; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sh-pile { position: relative; width: 56px; height: 36px; }
.sh-pile .sh-ic { position: absolute; font-size: 28px; }
.sh-day.st-today { border-color: #ffb52e; background: linear-gradient(#fff, #fff1c4); animation: sh-pulse 1.3s ease-in-out infinite; }
.sh-day.in { animation: sh-card-in 0.42s cubic-bezier(0.2, 0.9, 0.3, 1.2) backwards; animation-delay: calc(var(--i, 0) * 45ms + 0.15s); }
.sh-day.in.st-today { animation: sh-card-in 0.42s cubic-bezier(0.2, 0.9, 0.3, 1.2) calc(var(--i, 0) * 45ms + 0.15s) backwards, sh-pulse 1.3s ease-in-out calc(var(--i, 0) * 45ms + 0.7s) infinite; }
.sh-hero.in { animation: sh-card-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) 0.4s backwards; }
.sh-raywrap { position: absolute; inset: 0; border-radius: 14px; overflow: hidden; pointer-events: none; }
.sh-rays { position: absolute; left: 50%; top: 42%; width: 230%; aspect-ratio: 1; translate: -50% -50%; pointer-events: none;
  background: repeating-conic-gradient(from 0deg, rgba(255,255,255,0.75) 0 6deg, transparent 6deg 18deg);
  -webkit-mask: radial-gradient(circle, #000 0 8%, transparent 30%); mask: radial-gradient(circle, #000 0 8%, transparent 30%); animation: sh-rays 16s linear infinite; }
.sh-hero > .sh-hfig, .sh-hero > .sh-hinfo { position: relative; z-index: 1; }
.sh-day.st-claimed { border-color: var(--pb-green2, #11a84e); background: #e6fbe9; }
.sh-day.st-claimed > :not(.sh-stamp) { opacity: 0.55; }
.sh-day.st-locked, .sh-day.st-tomorrow { background: #f3f0fb; }
.sh-day.st-locked > :not(.sh-tag) { opacity: 0.8; }
.sh-tag { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); padding: 3px 8px 4px; border-radius: 9px; background: var(--ink); color: #fff; z-index: 3;
  font: 900 11px/1 var(--pb-font, 'Arial Black', sans-serif); text-transform: uppercase; white-space: nowrap; }
.st-today > .sh-tag { background: #ff5d1f; }
.sh-stamp { position: absolute; right: -9px; top: -9px; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--pb-green, #2fd36b); outline: 3px solid var(--ink); transform: rotate(10deg); z-index: 3; font-size: 16px; }
.sh-hero { grid-column: 2; grid-row: 2; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 14px 10px 10px; min-height: 0;
  background: radial-gradient(circle at 50% 38%, #fffbe0, #ffd86a 62%, #ffb52e); border: 4px solid #ffb52e; border-radius: 18px; box-shadow: 0 0 0 3px var(--ink), 0 6px 0 3px var(--ink), 0 0 22px 4px rgba(255,181,46,0.55); color: var(--ink); text-align: center; }
.sh-hero.st-claimed { filter: saturate(0.7); }
.sh-hfig { position: relative; flex: 1; min-height: clamp(96px, 28vh, 190px); width: 100%; }
.sh-hfig .sh-art > svg, .sh-hfig .sh-art > img { animation: sh-bob 2.2s ease-in-out infinite; }
.sh-hname { font: italic 900 20px/1 var(--pb-font, 'Arial Black', sans-serif); text-transform: uppercase; color: #fff; -webkit-text-stroke: 0.14em var(--ink); paint-order: stroke fill; }
.sh-hnote { font: 800 12px/1.15 var(--pb-font, 'Arial Black', sans-serif); opacity: 0.75; }
.sh-hero .sh-tag { background: #ff5d1f; }
.sh-dfoot { grid-row: 3; grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px 14px; }
.sh-dfoot .pb-btn { font-size: 18px; padding: 0.55em 1.3em 0.62em; }
.sh-dfoot .pb-btn.big { font-size: 22px; }
.sh-x2chip { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px 3px; border-radius: 8px; background: #fff; color: var(--ink); -webkit-text-stroke: 0; text-shadow: none; font-size: 0.8em; }
.sh-x2chip .sh-ic { font-size: 1em; }
.sh-note { flex: 1 1 100%; text-align: center; font: 800 13px/1.25 var(--pb-font, 'Arial Black', sans-serif); color: var(--ink); opacity: 0.75; }
.sh-wait { flex: 1 1 100%; text-align: center; font: 900 17px/1.25 var(--pb-font, 'Arial Black', sans-serif); color: var(--ink); }
/* ---- колесо ---- */
.sh-wbody { --ws: min(calc(100vh - 150px), 46vw, 500px); position: relative; z-index: 1; flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 38px 18px 18px; display: flex; align-items: center; justify-content: center; gap: 26px; }
.sh-wbox { position: relative; flex: none; width: var(--ws); height: var(--ws); margin-top: 6px; }
.sh-wclip { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; }
.sh-wdisc { position: absolute; inset: 0; border-radius: 50%; will-change: transform; }
.sh-wdisc > svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.sh-wdisc .bulb { animation: sh-blink 0.9s steps(1) infinite; }
.sh-wdisc .bulb.b { animation-delay: 0.45s; }
.sh-wbox.go .sh-wdisc .bulb, .sh-wbox.won .sh-wdisc .bulb { animation-duration: 0.2s; }
.sh-wbox.go .sh-wdisc .bulb.b, .sh-wbox.won .sh-wdisc .bulb.b { animation-delay: 0.1s; }
.sh-wdisc path.win { stroke: #fff; stroke-width: 3; animation: sh-flash 0.5s ease-in-out 6; }
.sh-pzw { position: absolute; inset: 0; pointer-events: none; }
.sh-pz { position: absolute; left: 50%; top: 11%; width: 26%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: calc(var(--ws) * 0.006);
  font: 900 calc(var(--ws) * 0.074)/1 var(--pb-font, 'Arial Black', sans-serif); color: #fff; -webkit-text-stroke: 0.17em var(--ink); paint-order: stroke fill; }
.sh-pz .sh-ic { font-size: calc(var(--ws) * 0.095); }
.sh-pz.jp { font-size: calc(var(--ws) * 0.085); }
.sh-pz.win { animation: sh-throb 0.5s ease-in-out 5; }
.sh-pz .sh-box { position: relative; width: calc(var(--ws) * 0.17); height: calc(var(--ws) * 0.17); border-radius: 50%; overflow: hidden; background: radial-gradient(circle, rgba(255,255,255,0.75) 0 50%, rgba(255,255,255,0.15) 72%, transparent 73%); }
.sh-hub { position: absolute; left: 50%; top: 50%; width: 17%; height: 17%; transform: translate(-50%, -50%); border-radius: 50%; z-index: 2; pointer-events: none;
  background: radial-gradient(circle at 35% 30%, #fff, #ffe9a8 45%, #ffb52e); outline: calc(var(--ws) * 0.012) solid var(--ink); box-shadow: 0 calc(var(--ws) * 0.015) 0 var(--ink); display: grid; place-items: center; }
.sh-hub .sh-ic { font-size: calc(var(--ws) * 0.075); --ic: #ff5d1f; filter: none; }
.sh-pointer { position: absolute; left: 50%; top: calc(var(--ws) * -0.075); width: calc(var(--ws) * 0.13); height: calc(var(--ws) * 0.16); transform: translateX(-50%); transform-origin: 50% 18%; z-index: 3; pointer-events: none; }
.sh-pointer svg { width: 100%; height: 100%; display: block; overflow: visible; }
.sh-pointer.tk { animation: sh-flick 0.16s ease-out; }
.sh-wctl { flex: 1 1 auto; min-width: 0; max-width: 330px; display: flex; flex-direction: column; gap: 12px; align-items: stretch; }
.sh-wsub { text-align: center; font: 800 14px/1.25 var(--pb-font, 'Arial Black', sans-serif); color: var(--ink); opacity: 0.75; }
.sh-wbtn { width: 100%; white-space: normal; text-align: center; line-height: 1.1; font-size: 17px; padding: 0.6em 0.8em 0.66em; }
.sh-win .pb-btn.sh-wbtn { font-size: 17px; white-space: normal; }
.sh-wbtn .sh-ic { font-size: 20px; }
.sh-whint { text-align: center; min-height: 1.3em; font: 800 13px/1.25 var(--pb-font, 'Arial Black', sans-serif); color: var(--ink); opacity: 0.8; }
/* ---- окно награды ---- */
.sh-pop { position: absolute; inset: 0; z-index: 10; overflow: hidden; display: none; align-items: center; justify-content: center; pointer-events: auto; background: rgba(27,21,48,0.76); }
.sh-pop.on { display: flex; }
.sh-popc { position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 18px 22px 20px; max-width: min(92vw, 440px); text-align: center; }
.sh-popc::before { content: ''; position: absolute; z-index: -1; pointer-events: none; left: 50%; top: 42%; width: 150%; aspect-ratio: 1; transform: translate(-50%, -50%) rotate(-8deg); max-width: 640px;
  background: var(--sp, #ff8a1f); -webkit-mask: var(--m) center / contain no-repeat; mask: var(--m) center / contain no-repeat; opacity: 0.95; animation: sh-splash 0.7s cubic-bezier(0.2, 1.5, 0.4, 1) both, sh-sway 7s ease-in-out 0.7s infinite alternate; }
.sh-pop-t { font: italic 900 clamp(34px, 8vmin, 60px)/0.95 var(--pb-font, 'Arial Black', sans-serif); text-transform: uppercase; color: #fff; -webkit-text-stroke: 0.1em var(--ink); paint-order: stroke fill; text-shadow: 0 0.07em 0 var(--ink); transform: rotate(-3deg); animation: sh-pop 0.5s ease-out; }
.sh-pop-big { display: flex; align-items: center; justify-content: center; gap: 0.25em; font: 900 clamp(34px, 9vmin, 58px)/1 var(--pb-font, 'Arial Black', sans-serif); color: #ffd23f; -webkit-text-stroke: 0.12em var(--ink); paint-order: stroke fill; }
.sh-pop-big .sh-ic { font-size: 1.1em; }
.sh-pop-items { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; align-items: flex-start; }
.sh-pop-item { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 132px; padding: 8px 6px 10px; background: #fff; color: var(--ink); border: 4px solid var(--rc, #8e9bb4); border-radius: 15px; box-shadow: 0 0 0 3px var(--ink), 0 5px 0 3px var(--ink); }
.sh-pop-item .sh-pic { width: 100%; height: 92px; }
.sh-pop-item .sh-pic > .sh-art { inset: 0; }
.sh-pop-note { font: 800 13px/1.2 var(--pb-font, 'Arial Black', sans-serif); color: #fff; -webkit-text-stroke: 0.14em var(--ink); paint-order: stroke fill; }
.sh-pop .pb-btn { font-size: 20px; padding: 0.55em 1.4em 0.62em; }
.sh-pop .pb-btn.small { font-size: 15px; padding: 0.45em 0.9em 0.52em; min-height: 44px; }
.sh-pop .pb-btn { min-height: 48px; }
.sh-fx { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 11; }
.sh-rc { position: absolute; top: -34px; font-size: 26px; animation: sh-rain 1.5s cubic-bezier(0.4, 0, 0.9, 0.6) both; }
.sh-drop { position: absolute; width: var(--sz, 10px); height: calc(var(--sz, 10px) * 1.25); background: var(--c); border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%; outline: 2px solid var(--ink);
  animation: sh-drop 0.95s cubic-bezier(0.2, 0.7, 0.4, 1) forwards; }
.sh-sp { position: absolute; left: 50%; top: 42%; width: 12px; height: 12px; border-radius: 3px; background: var(--c); pointer-events: none; z-index: 11; animation: sh-fly 1s ease-out forwards; }
.sh-toast { position: absolute; z-index: 12; left: 50%; top: 50%; transform: translate(-50%, -100%); max-width: min(86vw, 380px); padding: 10px 16px; border-radius: 14px;
  background: rgba(27,21,48,0.94); outline: 3px solid #fff; font: 900 15px/1.25 var(--pb-font, 'Arial Black', sans-serif); text-align: center; opacity: 0; transition: opacity 0.2s; pointer-events: none; }
.sh-toast.on { opacity: 1; }
@keyframes sh-pop { 0% { transform: scale(0.6) rotate(-3deg); } 60% { transform: scale(1.12) rotate(-3deg); } 100% { transform: scale(1) rotate(-3deg); } }
@keyframes sh-pulse { 50% { transform: scale(1.045); box-shadow: 0 0 0 3px var(--ink), 0 5px 0 3px var(--ink), 0 0 16px 4px rgba(255,181,46,0.9); } }
@keyframes sh-bob { 50% { transform: translateY(-5px) rotate(1.5deg); } }
@keyframes sh-blink { 50% { opacity: 0.35; } }
@keyframes sh-flash { 50% { fill-opacity: 0.45; } }
@keyframes sh-throb { 50% { transform: translateX(-50%) scale(1.22); } }
@keyframes sh-flick { 0% { transform: translateX(-50%) rotate(-26deg); } 100% { transform: translateX(-50%) rotate(0); } }
@keyframes sh-fade { from { opacity: 0; } }
@keyframes sh-tip-in { from { opacity: 0; transform: translateY(-4px); } }
@keyframes sh-gold { to { background-position: -220% 0; } }
@keyframes sh-win-in { 0% { opacity: 0; transform: scale(0.85) rotate(-2.2deg); } 55% { opacity: 1; transform: scale(1.04) rotate(0.7deg); } 100% { opacity: 1; transform: scale(1) rotate(0); } }
@keyframes sh-card-in { 0% { opacity: 0; transform: translateY(18px) scale(0.86) rotate(-2deg); } 100% { opacity: 1; transform: none; } }
@keyframes sh-shine { 0%, 45% { background-position: 0 0; } 100% { background-position: 100% 0; } }
@keyframes sh-buy { 0% { transform: scale(1); filter: brightness(1); } 25% { transform: scale(1.1) rotate(-2deg); filter: brightness(1.7) saturate(1.3); box-shadow: 0 0 0 3px var(--ink), 0 6px 0 3px var(--ink), 0 0 26px 10px #fff; } 60% { transform: scale(0.97) rotate(1deg); } 100% { transform: scale(1); filter: brightness(1); } }
@keyframes sh-beat { 50% { transform: scale(1.14); } }
@keyframes sh-ripple { 0% { transform: scale(0.9); opacity: 0.9; } 100% { transform: scale(1.55); opacity: 0; } }
@keyframes sh-wiggle { 0% { transform: rotate(-14deg) scale(0.8); } 40% { transform: rotate(10deg) scale(1.15); } 70% { transform: rotate(-4deg); } 100% { transform: none; } }
@keyframes sh-bump { 0% { transform: scale(1); } 35% { transform: scale(1.28) rotate(-2deg); filter: brightness(1.4); } 70% { transform: scale(0.96); } 100% { transform: scale(1); } }
@keyframes sh-rays { to { transform: rotate(360deg); } }
@keyframes sh-splash { 0% { opacity: 0; transform: translate(-50%, -50%) rotate(-40deg) scale(0.15); } 60% { opacity: 1; transform: translate(-50%, -50%) rotate(-4deg) scale(1.16); } 100% { opacity: 0.95; transform: translate(-50%, -50%) rotate(-8deg) scale(1); } }
@keyframes sh-sway { from { transform: translate(-50%, -50%) rotate(-8deg) scale(1); } to { transform: translate(-50%, -50%) rotate(-2deg) scale(1.03); } }
@keyframes sh-rain { 0% { transform: translateY(0) rotate(0); opacity: 1; } 100% { transform: translateY(var(--fall, 700px)) rotate(var(--rot, 360deg)); opacity: 1; } }
@keyframes sh-drop { 0% { opacity: 1; transform: translate(-50%, -50%) scale(0.3); } 18% { transform: translate(calc(-50% + var(--dx) * 0.4), calc(-50% + var(--dy))) scale(1); } 100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy) + 110px)) scale(0.6); } }
@keyframes sh-fly { 0% { transform: translate(0, 0) rotate(0) scale(1); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(0.5); opacity: 0; } }
.sh-nomask .sh-splat { -webkit-mask: none !important; mask: none !important; border-radius: 50%; }
.sh-splw { position: relative; display: block; filter: drop-shadow(0 2px 0 var(--ink)) drop-shadow(0 -2px 0 var(--ink)) drop-shadow(2px 0 0 var(--ink)) drop-shadow(-2px 0 0 var(--ink)); }
.sh-splw.glow { filter: drop-shadow(0 2px 0 var(--ink)) drop-shadow(0 -2px 0 var(--ink)) drop-shadow(2px 0 0 var(--ink)) drop-shadow(-2px 0 0 var(--ink)) drop-shadow(0 0 4px var(--gl)); }
.sh-splat { position: absolute; inset: 0; -webkit-mask: var(--m) center / contain no-repeat; mask: var(--m) center / contain no-repeat; }
.sh-splw .gl { position: absolute; width: 20%; aspect-ratio: 1; }
.sh-splw .gl svg { width: 100%; height: 100%; display: block; }
/* ---- портрет: панель снизу ~60% экрана, вкладки сверху ---- */
@media (max-aspect-ratio: 1/1) {
  .sh-shop { left: 50%; right: auto; top: auto; bottom: calc(var(--hl-safe-b, 0px) + 8px); translate: -50% 0; width: min(calc(100% - 12px), 720px); height: 60vh; height: 60dvh; }
  .sh-body { flex-direction: column; padding: 20px 6px 6px; gap: 2px; }
  .sh-tabs { flex-direction: row; overflow-x: auto; overflow-y: hidden; padding: 8px 10px 9px; gap: 7px; justify-content: center; }
  .sh-tab { flex: 1 1 0; width: auto; min-width: 0; max-width: 96px; min-height: 54px; }
  .sh-tab.on { transform: translateY(-2px) scale(1.06); }
  .sh-sub .try { display: none; }
  .sh-dbody { grid-template-columns: 1fr; padding: 22px 12px 14px; }
  .sh-hero { grid-column: 1; grid-row: 3; flex-direction: row; text-align: left; gap: 12px; padding: 12px; }
  .sh-hfig { flex: none; width: 36%; min-height: 120px; height: 130px; }
  .sh-dfoot { grid-row: 4; }
  .sh-hinfo { flex: 1; display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
  .sh-wbody { --ws: min(88vw, calc(100vh - 400px), 470px); flex-direction: column; gap: 16px; padding: 34px 14px 16px; }
  .sh-wctl { width: 100%; max-width: 380px; }
}
@media (max-aspect-ratio: 1/1) and (max-width: 420px) {
  .sh-tab { font-size: 10.5px; }
  .sh-tabs { gap: 5px; padding: 8px 6px 9px; }
  .sh-title { font-size: 24px; }
  .sh-head { padding-left: 12px; gap: 6px; }
  .sh-coins { font-size: 17px; }
  .sh-win .pb-btn.small { padding: 0.5em 0.7em 0.58em; }
  .sh-x .t { display: none; }
}
/* ---- низкий альбом (640x360, 568x320): список вместо сетки, шапка и отступы компактнее ---- */
@media (max-height: 460px) and (min-aspect-ratio: 1/1) {
  .sh-shop { top: calc(var(--hl-safe-t, 0px) + 4px); bottom: calc(var(--hl-safe-b, 0px) + 6px); right: calc(var(--hl-safe-r, 0px) + 6px); width: clamp(360px, 60vw, 740px); border-radius: 18px; }
  .sh-head { min-height: 42px; padding: 4px 8px 7px 12px; gap: 6px; }
  .sh-title { font-size: 21px; }
  .sh-coins { font-size: 16px; }
  .sh-win .pb-btn.small { font-size: 14px; padding: 0.4em 0.8em 0.48em; }
  .sh-body { padding: 18px 6px 6px 4px; gap: 4px; }
  .sh-tabs { gap: 4px; padding: 3px 6px 3px 4px; }
  .sh-tab { width: 46px; min-height: 38px; padding: 2px; }
  .sh-tab .sh-tl { display: none; }
  .sh-tg { width: 28px; height: 28px; }
  .sh-sub { padding-bottom: 2px; font-size: 12px; }
  .sh-sub .try { display: none; }
  .sh-grid { --cw: 250px; gap: 20px 12px; padding: 20px 10px 14px 10px; }
  .sh-card { display: grid; grid-template-columns: 56px minmax(0, 1fr) 94px; grid-template-areas: 'pic name btn' 'pic price btn'; align-items: center; gap: 1px 8px; padding: 5px 6px; }
  .sh-card.hs { grid-template-areas: 'pic name btn' 'pic stats btn' 'pic price btn'; }
  .sh-stats, .sh-sk { grid-area: stats; flex-direction: row; gap: 5px; align-self: center; padding: 0; justify-content: flex-start; }
  .sh-st { gap: 2px; height: 10px; }
  .sh-stl { display: none; }
  .sh-bar { flex: none; width: 18px; }
  .sh-sk { font-size: 11px; gap: 0 6px; }
  .sh-abil { display: none; }
  .sh-abdot { position: absolute; right: 2px; bottom: 2px; width: 16px; height: 16px; display: grid; place-items: center; border-radius: 50%; outline: 2px solid var(--ink); font-size: 10px; line-height: 1; color: #fff; z-index: 2; }
  .sh-abdot.a-rare, .sh-abdot.a-common { background: #2f8cf0; } .sh-abdot.a-epic { background: #8a3df0; } .sh-abdot.a-legendary { background: #ffb52e; }
  .sh-tip { font-size: 11.5px; padding: 3px 7px 4px; margin-bottom: 4px; } .sh-tip.on { min-height: 38px; }
  .sh-pic { grid-area: pic; width: 56px; height: 54px; }
  .sh-pic > .sh-art { inset: 0; }
  .sh-name { grid-area: name; min-height: 0; -webkit-line-clamp: 2; text-align: left; font-size: 12.5px; align-self: end; }
  .sh-cap { display: none; }
  .sh-price { grid-area: price; align-items: flex-start; min-height: 0; text-align: left; align-self: start; }
  .sh-pr { justify-content: flex-start; }
  .sh-btn { grid-area: btn; width: 94px; align-self: center; padding-left: 0.15em; padding-right: 0.15em; font-size: 12.5px; }
  .sh-win .pb-btn.sh-btn { font-size: 12.5px; }
  .sh-btn .sh-ic { display: none; }
  .sh-card.sel::before { inset: -8px; }
  .sh-stars { display: none; }
  .sh-bd { width: 22px; height: 22px; top: -8px; font-size: 12px; }
  .sh-bd.eq { right: -8px; }
  .sh-bd.lk, .sh-bd.gf { left: -8px; }
  .sh-tryon { top: -14px; }
  .sh-daily, .sh-wheelwin { max-height: calc(100% - 8px); }
  .sh-dbody { padding: 20px 12px 10px; gap: 8px 12px; }
  .sh-days, .sh-hero { grid-row: 1; }
  .sh-dfoot { grid-row: 2; }
  .sh-days { gap: 10px 8px; }
  .sh-day { min-height: 76px; padding: 4px 3px 5px; }
  .sh-dnm, .sh-dsub { display: none; }
  .sh-dlab { font-size: 14px; }
  .sh-pile { transform: scale(0.8); }
  .sh-hnote { display: none; }
  .sh-hname { font-size: 17px; }
  .sh-hfig { min-height: 90px; height: 110px; }
  .sh-dfoot .pb-btn { font-size: 15px; padding: 0.45em 1em 0.5em; }
  .sh-dfoot .pb-btn.big { font-size: 17px; }
  .sh-note { font-size: 12px; }
  .sh-wbody { --ws: min(calc(100vh - 114px), 44vw, 500px); padding: 28px 14px 12px; gap: 18px; }
  .sh-wbtn, .sh-win .pb-btn.sh-wbtn { font-size: 15px; }
  .sh-wctl { gap: 8px; }
}
@media (max-height: 340px) and (min-aspect-ratio: 1/1) {
  .sh-sub { display: none; }
  .sh-tip.on { min-height: 0; }
  .sh-body { flex-direction: column; padding-top: 16px; gap: 0; }
  .sh-tabs { flex-direction: row; overflow-x: auto; overflow-y: hidden; justify-content: center; padding: 6px 6px 7px; gap: 7px; }
  .sh-tab { flex: none; width: 46px; min-height: 40px; }
  .sh-tab.on { transform: translateY(-2px) scale(1.05); }
}
@media (max-height: 460px) and (max-width: 620px) and (min-aspect-ratio: 1/1) { .sh-x .t { display: none; } .sh-x { padding-left: 0.8em; padding-right: 0.8em; } }
@media (prefers-reduced-motion: reduce) {
  #sh-root *, #sh-root *::before, #sh-root *::after { animation-duration: 0.01ms !important; animation-delay: 0s !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
  .sh-rays, .sh-fx { display: none; }
}
`,

    // =============================================================================================
    // Запуск
    // =============================================================================================

    /**
     * @param {{ save?: any, persist?: () => any, onLook?: (cosm: any) => void }} [cfg]
     * Shop -> DailyGift -> Wheel: состояние каждого лежит в единой записи save (save.shop|daily|wheel).
     */
    init(cfg) {
        const c = cfg || {};
        this.cfg = c;
        const save = c.save || {};
        const persist = typeof c.persist === 'function' ? c.persist : () => {};
        Shop.init({ tabs: GameShopData.tabs(), items: GameShopData.items(), state: save.shop, persist });
        save.shop = Shop.state;
        DailyGift.init({ rewards: GameShopData.daily(), rewardsSink: Shop, state: save.daily, persist });
        save.daily = DailyGift.state;
        Wheel.init({ sectors: GameShopData.wheel(), rewardsSink: Shop, state: save.wheel, persist, onChange: (e) => { if (e.type === 'prize' && e.recovered) this._recovered = e; } });
        save.wheel = Wheel.state;
        Shop.on((e) => this._onShop(e));
        this._ready = true;
        if (!this.root) this._mount();
        const first = Shop.tabs().find((t) => t.count > 0);
        if (first) this.tab = first.id;
        return this;
    },

    /** @returns {any} */
    _game() { return typeof Game !== 'undefined' ? Game : null; },

    _onShop(e) {
        if (e.type === 'coins') { const g = this._game(); if (g && g.refreshCoins) g.refreshCoins(); this._bump(); }
        if (e.type === 'equip' || e.type === 'unequip' || e.type === 'preview') this._queueLook();
        this._queueRefresh();
    },

    // Несколько событий подряд (покупка: grant, coins, equip) — одно обновление вида и один вызов onLook.
    _queueLook() {
        if (this._lookQueued) return;
        this._lookQueued = true;
        Promise.resolve().then(() => {
            this._lookQueued = false;
            const f = this.cfg && this.cfg.onLook;
            if (typeof f === 'function') { try { f(this.equipped()); } catch (err) { console.warn('GameShopUI: onLook:', err); } }
        });
    },

    _queueRefresh() {
        if (this._refreshQueued || !this.isOpen) return;
        this._refreshQueued = true;
        Promise.resolve().then(() => { this._refreshQueued = false; if (this.isOpen) this._refresh(); });
    },

    /** Надетое (и примеряемое) — объекты каталогов. withPreview: false — только надетое. */
    equipped(withPreview) {
        const look = withPreview === false ? Shop.state.equipped : Shop.look();
        const pick = (list, id) => (id ? list.find((e) => e && e.id === id) || null : null);
        return {
            skin: GameData.skin(look.skin),
            hat: pick(GameShopData.catalog('hats'), look.hat),
            sword: pick(GameShopData.catalog('swords'), look.sword),
            paint: GameData.paint(look.paint),
            trail: GameData.trail(look.trail),
            victory: GameData.victory(look.victory),
        };
    },

    /** Красные точки на плитках меню: есть что купить за монеты / подарок доступен / бесплатное вращение. */
    badges() {
        if (!this._ready) return { shop: false, daily: false, wheel: false };
        let shop = false;
        for (const it of Shop.items()) {
            const price = it.price && it.price.coins;
            if (!it.exclusive && !it.default && price && !Shop.owns(it.id) && Shop.coins >= price) { shop = true; break; }
        }
        return { shop, daily: DailyGift.canClaim(), wheel: !!Wheel.badge() };
    },

    /** Автопоказ подарка дня в меню (не во время туториала и не повторно в тот же день). */
    maybeOfferDaily() {
        if (!this._ready || this.isOpen) return false;
        if (typeof Tutorial !== 'undefined' && Tutorial.active) return false;
        if (!DailyGift.shouldOffer()) return false;
        this.open('daily');
        DailyGift.markOffered();
        return true;
    },

    /** Где панель магазина и свободная зона для персонажа (px окна): камера может сместить кадр в free. */
    layout() {
        const w = ViewCap.width(), h = window.innerHeight;   // px поля игры (ViewCap.js)
        const tall = window.matchMedia('(max-aspect-ratio: 1/1)').matches;
        const sh = this.el.shop;
        if (sh && this.isOpen && this.kind === 'shop') {
            const r = sh.getBoundingClientRect(), left = ViewCap.x(r.left);
            return { mode: tall ? 'tall' : 'land', panel: { x: left, y: r.top, w: r.width, h: r.height },
                free: tall ? { x: 0, y: 0, w, h: Math.max(0, r.top) } : { x: 0, y: 0, w: Math.max(0, left), h } };
        }
        if (tall) { const ph = Math.round(h * 0.6); return { mode: 'tall', panel: { x: 0, y: h - ph, w, h: ph }, free: { x: 0, y: 0, w, h: h - ph } }; }
        const pw = Math.min(740, Math.max(340, Math.round(w * (h <= 460 ? 0.54 : 0.52))));
        return { mode: 'land', panel: { x: w - pw, y: 0, w: pw, h }, free: { x: 0, y: 0, w: w - pw, h } };
    },

    // =============================================================================================
    // Окно: открыть / закрыть
    // =============================================================================================

    open(kind) {
        if (!this._ready) return;
        const k = kind === 'daily' || kind === 'wheel' ? kind : 'shop';
        const wasOpen = this.isOpen;
        this.kind = k;
        this.isOpen = true;
        this._busy = false;
        const root = /** @type {HTMLElement} */ (this.root);
        root.classList.add('show');
        root.dataset.mode = k;
        this._popupClose(true);
        this._gridFresh = true;
        this._winIn(k === 'daily' ? this.el.daily : k === 'wheel' ? this.el.wheelwin : this.el.shop);
        if (k === 'shop') this._renderShop(true);
        else if (k === 'daily') this._renderDaily(true);
        else this._openWheel();
        if (!this._timer) this._timer = window.setInterval(() => this._tick(), 1000);
        if (!wasOpen) { const g = this._game(); if (g && g.onShopOpen) g.onShopOpen(k); }
    },

    close() {
        if (!this.isOpen) return;
        if (this._spinning) this._finishSpin(true);
        this._popupClose(true);
        Shop.clearPreview();
        this.isOpen = false;
        this.kind = '';
        this._busy = false;
        const root = /** @type {HTMLElement} */ (this.root);
        root.classList.remove('show');
        root.dataset.mode = '';
        if (this._timer) { window.clearInterval(this._timer); this._timer = 0; }
        const g = this._game();
        if (g && g.onShopClose) g.onShopClose();
    },

    _tick() {
        if (!this.isOpen) return;
        if (this.kind === 'shop') { if (this._needsTick()) this._renderGrid(); }
        else if (this.kind === 'daily') this._renderDailyFoot();
        else if (this.kind === 'wheel' && !this._spinning) this._renderWheelCtl();
    },

    _needsTick() {
        return Shop.cards(this.tab).some((c) => c.adWait > 0 || (c.action === 'watch' && !c.enabled));
    },

    _refresh() {
        const n = this.el.coinsN;
        if (n) for (const e of this.root.querySelectorAll('.sh-cn')) e.textContent = String(Shop.coins);
        if (this.kind === 'shop') this._renderShop(false);
        else if (this.kind === 'daily') this._renderDaily();
    },

    // =============================================================================================
    // Сборка DOM
    // =============================================================================================

    _mount() {
        const style = document.createElement('style');
        style.textContent = this.CSS;
        document.head.appendChild(style);
        const root = document.createElement('div');
        root.id = 'sh-root';
        const x = this.ico('cross');
        root.innerHTML = `
<div class="sh-shade"></div>
<section class="sh-win sh-shop" data-win="shop">
  <header class="sh-head">
    <h2 class="sh-title">${this.t('shop')}</h2>
    <div class="sh-coins">${this.ico('coin', 'gold')}<span class="sh-cn">0</span></div>
    <button class="pb-btn red small sh-x" data-act="close" aria-label="${this.t('close')}">${x}<span class="t">${this.t('close')}</span></button>
  </header>
  <div class="sh-body">
    <nav class="sh-tabs"></nav>
    <div class="sh-main"><div class="sh-sub"></div><div class="sh-tip"></div><div class="sh-grid"></div></div>
  </div>
</section>
<section class="sh-win sh-daily" data-win="daily">
  <header class="sh-head">
    <h2 class="sh-title">${this.t('sh.daily.title')}</h2>
    <div class="sh-coins">${this.ico('coin', 'gold')}<span class="sh-cn">0</span></div>
    <button class="pb-btn red small sh-x" data-act="close" aria-label="${this.t('close')}">${x}<span class="t">${this.t('close')}</span></button>
  </header>
  <div class="sh-dbody"></div>
</section>
<section class="sh-win sh-wheelwin" data-win="wheel">
  <header class="sh-head">
    <h2 class="sh-title">${this.t('sh.wheel.title')}</h2>
    <div class="sh-coins">${this.ico('coin', 'gold')}<span class="sh-cn">0</span></div>
    <button class="pb-btn red small sh-x" data-act="close" aria-label="${this.t('close')}">${x}<span class="t">${this.t('close')}</span></button>
  </header>
  <div class="sh-wbody">
    <div class="sh-wbox"><div class="sh-wclip"><div class="sh-wdisc"></div></div><div class="sh-hub">${this.ico('wheel')}</div>
      <div class="sh-pointer"><svg viewBox="0 0 100 120"><path d="M50 116 L13 60 A42 42 0 1 1 87 60 Z" fill="#ff4d5e" stroke="#1b1530" stroke-width="8" stroke-linejoin="round"/><circle cx="50" cy="42" r="13" fill="#fff" stroke="#1b1530" stroke-width="6"/></svg></div></div>
    <div class="sh-wctl"></div>
  </div>
</section>
<div class="sh-pop"><div class="sh-popc"></div></div>
<div class="sh-fx"></div>
<div class="sh-toast"></div>`;
        document.body.appendChild(root);
        this.root = root;
        const q = (s) => root.querySelector(s);
        this.el = {
            shop: q('.sh-shop'), daily: q('.sh-daily'), wheelwin: q('.sh-wheelwin'), tabs: q('.sh-tabs'), sub: q('.sh-sub'), tip: q('.sh-tip'), grid: q('.sh-grid'),
            dbody: q('.sh-dbody'), wdisc: q('.sh-wdisc'), wctl: q('.sh-wctl'), pointer: q('.sh-pointer'), pop: q('.sh-pop'), popc: q('.sh-popc'), toast: q('.sh-toast'), fx: q('.sh-fx'),
            coinsN: q('.sh-cn'),
        };
        root.addEventListener('click', (e) => this._onClick(e));
        // Иконки-картинки (шапки, мечи): нет файла — запасной значок, текст карточки остаётся.
        root.addEventListener('error', (e) => this._imgFail(e), true);
        window.addEventListener('keydown', (e) => {
            if (!this.isOpen || e.code !== 'Escape') return;
            if (this.el.pop.classList.contains('on')) this._popupClose(false);
            else if (!this._spinning && !this._busy) this.close();
        });
        window.addEventListener('lory-language', () => { if (this.isOpen) { this._refresh(); } });
        // Маска «клякса» — если файла нет, краска рисуется кругом.
        const probe = new Image();
        probe.onerror = () => root.classList.add('sh-nomask');
        probe.src = this.SPLATS[0];
    },

    t(key, params) { return typeof Lang !== 'undefined' ? Lang.t(key, params) : key; },

    esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => /** @type {any} */ ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]); },

    /** Значок-маска из assets/ui/kenney. color: gold | '#hex' | '' (белый). */
    ico(name, color) {
        const file = this.ICON[name] || '';
        const col = color === 'gold' ? ' gold' : '';
        const st = color && color !== 'gold' ? ';--ic:' + color : '';
        return '<span class="sh-ic' + col + '" style="font-size:inherit' + st + '"><i style="--m:url(' + file + ')"></i></span>';
    },

    click() { if (typeof GameUI !== 'undefined' && GameUI.click) GameUI.click(); },

    sfx(url, vol) { if (typeof Sound !== 'undefined' && Sound.play) Sound.play(url, { volume: vol == null ? 0.7 : vol }); },

    // ---- события ----

    _onClick(e) {
        const target = /** @type {HTMLElement} */ (e.target);
        const actEl = /** @type {HTMLElement | null} */ (target.closest('[data-act]'));
        const act = actEl ? actEl.dataset.act : '';
        const card = /** @type {HTMLElement | null} */ (target.closest('.sh-card'));
        if (act === 'close') { this.click(); if (!this._spinning && !this._busy) this.close(); return; }
        if (act === 'pop-close') { this.click(); this._popupClose(false); return; }
        if (act === 'pop-equip' && actEl) { this.click(); const r = Shop.equip(String(actEl.dataset.id)); if (r.ok) actEl.classList.add('off'); return; }
        if (act === 'tab' && actEl) { this.click(); this.tab = String(actEl.dataset.tab); this._renderShop(true); return; }
        if (act === 'buy' && card) { this._cardAction(String(card.dataset.id)); return; }
        if (act === 'claim') { this._claim(false); return; }
        if (act === 'claim2') { this._claim(true); return; }
        if (act === 'spin-free') { this._spin('free'); return; }
        if (act === 'spin-ad') { this._spin('ad'); return; }
        if (card && target.closest('.sh-grid')) this._togglePreview(String(card.dataset.id));
    },

    _imgFail(e) {
        const img = /** @type {HTMLElement} */ (e.target);
        if (!img || img.tagName !== 'IMG' || !img.classList.contains('sh-img')) return;
        const span = document.createElement('span');
        span.innerHTML = this._glyphSvg(img.dataset.g || 'hat', 'sh-fb');
        const svg = span.firstElementChild;
        if (svg) img.replaceWith(svg);
    },

    // =============================================================================================
    // Магазин
    // =============================================================================================

    _renderShop(full) {
        const tabs = Shop.tabs().filter((t) => t.count > 0);
        if (!tabs.some((t) => t.id === this.tab)) this.tab = tabs[0] ? tabs[0].id : '';
        const cur = tabs.find((t) => t.id === this.tab);
        const sh = /** @type {HTMLElement} */ (this.el.shop);
        if (cur) { sh.style.setProperty('--tc1', cur.data.color); sh.style.setProperty('--tc2', cur.data.color2); }
        for (const e of this.root.querySelectorAll('.sh-cn')) e.textContent = String(Shop.coins);
        // вкладки
        const nav = this.el.tabs;
        if (full || nav.children.length !== tabs.length) {
            nav.innerHTML = tabs.map((t) => `<button class="sh-tab${t.id === this.tab ? ' on' : ''}" data-act="tab" data-tab="${t.id}" style="--tc1:${t.data.color};--tc2:${t.data.color2}" aria-label="${this.esc(t.name)}" title="${this.esc(t.name)}">`
                + `<span class="sh-tg">${this._glyphSvg(t.data.glyph)}</span><span class="sh-tl">${this.esc(t.name)}</span></button>`).join('');
        } else {
            nav.querySelectorAll('.sh-tab').forEach((b) => b.classList.toggle('on', /** @type {HTMLElement} */ (b).dataset.tab === this.tab));
        }
        this.el.sub.innerHTML = cur ? `<span>${this.esc(this.t('sh.tab.count', { a: cur.owned, b: cur.count }))}</span><span class="try">${this.esc(this.t('sh.tryHint'))}</span>` : '';
        this._renderGrid();
        this._renderTip();
    },

    _renderGrid() {
        const host = this.el.grid;
        let fresh = this._gridFresh;
        this._gridFresh = false;
        if (host.dataset.tab !== this.tab || fresh) { host.innerHTML = ''; host.scrollTop = 0; host.dataset.tab = this.tab; fresh = true; }
        const cards = Shop.cards(this.tab);
        if (!cards.length) { host.innerHTML = `<div class="sh-empty">${this.esc(this.t('sh.empty'))}</div>`; return; }
        const look = Shop.look();
        const have = new Map();
        for (const ch of Array.from(host.children)) if (ch.dataset && ch.dataset.id) have.set(ch.dataset.id, ch);
        else ch.remove();
        let prev = null;
        let order = 0;
        for (const c of cards) {
            const previewed = look[c.slot] === c.id && !c.equipped;
            const sig = [c.state, c.progress, c.enabled ? 1 : 0, c.priceLabel, c.adWait, c.busy ? 1 : 0, previewed ? 1 : 0, this._busy ? 1 : 0, c.actionLabel, Shop.coins >= c.price ? 1 : 0, typeof Lang !== 'undefined' ? Lang.code : ''].join('|');
            let el = have.get(c.id);
            if (!el || el.dataset.sig !== sig) {
                const tpl = document.createElement('template');
                tpl.innerHTML = this._cardHtml(c, previewed, sig, fresh ? Math.min(order, 24) : -1).trim();
                const n = /** @type {HTMLElement} */ (tpl.content.firstElementChild);
                if (el) el.replaceWith(n);
                el = n;
            }
            have.delete(c.id);
            order++;
            // порядок как в каталоге
            const want = prev ? prev.nextElementSibling : host.firstElementChild;
            if (el !== want) host.insertBefore(el, want);
            prev = el;
        }
        for (const rest of have.values()) rest.remove();
    },

    /** Описание способности и статы меча / здоровье скина (из GameData). null — у вещи нет характеристик. */
    _statsOf(id) {
        const f = GameShopData.find(id);
        if (!f) return null;
        const L = typeof Lang !== 'undefined' ? Lang.code : 'ru';
        const pick = (o) => (o ? o[L] || o.en || o.ru || '' : '');
        if (f.tab === 'swords' && typeof GameData.swordStats === 'function') {
            const st = GameData.swordStats(id), mx = GameData.SWORD_STAT_MAX || { dmg: 2, speed: 1.33, reach: 1.35 };
            const spd = 1 / (st.speed || 1);
            const bars = [
                { k: 'dmg', v: st.dmg, max: mx.dmg, txt: '×' + this._num(st.dmg), color: '#ff5d1f' },
                { k: 'speed', v: spd, max: mx.speed, txt: '×' + this._num(spd), color: '#f2b705' },
                { k: 'reach', v: st.reach, max: mx.reach, txt: '×' + this._num(st.reach), color: '#2f9bff' },
            ];
            return { kind: 'sword', bars, ability: st.ability ? { name: pick(st.name), desc: pick(st.desc) } : null };
        }
        if (f.tab === 'skins' && typeof GameData.skinStats === 'function') {
            const st = GameData.skinStats(id);
            return { kind: 'skin', hp: Math.round((st.hp - 1) * 100), run: Math.round((st.speed - 1) * 100), label: pick(st.label) };
        }
        return null;
    },

    _num(v) { return String(Math.round(v * 100) / 100).replace(/(\.\d)0$/, '$1'); },

    _statIcon(k) {
        const st = 'stroke="#1b1530" stroke-width="1.3" stroke-linejoin="round"';
        if (k === 'dmg') return `<svg viewBox="0 0 16 16"><path d="M8 1L10 6L15 6L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L1 6L6 6Z" fill="#ff5d1f" ${st}/></svg>`;
        if (k === 'speed') return `<svg viewBox="0 0 16 16"><path d="M9.5 1L3 9H7.5L6.5 15L13 6.5H8.5Z" fill="#ffd23f" ${st}/></svg>`;
        return `<svg viewBox="0 0 16 16"><path d="M1 8L5 4V6.5H11V4L15 8L11 12V9.5H5V12Z" fill="#2f9bff" ${st}/></svg>`;
    },

    /** Полоски характеристик меча или «здоровье» скина — под названием карточки. */
    _statsHtml(c) {
        const s = this._statsOf(c.id);
        if (!s) return { html: '', dot: '', has: false };
        if (s.kind === 'sword') {
            const names = { dmg: this.t('sh.stat.dmg'), speed: this.t('sh.stat.speed'), reach: this.t('sh.stat.reach') };
            const rows = s.bars.map((b) => {
                const w = Math.max(8, Math.min(100, Math.round((b.v / b.max) * 100)));
                return `<span class="sh-st" title="${this.esc(names[b.k] + ' ' + b.txt)}"><span class="sh-sti">${this._statIcon(b.k)}</span><span class="sh-stl">${this.esc(names[b.k])}</span>`
                    + `<span class="sh-bar" style="--bc:${b.color}"><i style="width:${w}%"></i></span></span>`;
            }).join('');
            const rar = c.rarity || 'common';
            const chip = s.ability ? `<div class="sh-abil a-${rar}" title="${this.esc(s.ability.name + ': ' + s.ability.desc)}">${this.esc(s.ability.name)}</div>` : '';
            const dot = s.ability ? `<span class="sh-abdot a-${rar}" title="${this.esc(s.ability.name)}">✦</span>` : '';
            return { html: chip + `<div class="sh-stats">${rows}</div>`, dot, has: true };
        }
        if (!s.hp && !s.run) return { html: '', dot: '', has: false };
        let h = '';
        if (s.hp) h += `<span class="hp" title="${this.esc(s.label)}">${this.ico('heart', '#ff4d5e')}+${s.hp}%</span>`;
        if (s.run) h += `<span class="rn">${this.esc(this.t('sh.stat.run'))} ${s.run > 0 ? '+' : ''}${s.run}%</span>`;
        return { html: `<div class="sh-sk">${h}</div>`, dot: '', has: true };
    },

    /** Строка-подсказка над сеткой (мечи и скины): примерка — полное описание, иначе — надетое. */
    _renderTip() {
        const tip = this.el.tip;
        if (!tip) return;
        const tab = this.tab;
        if (tab !== 'swords' && tab !== 'skins') { tip.className = 'sh-tip'; tip.innerHTML = ''; return; }
        const slot = tab === 'swords' ? 'sword' : 'skin';
        const look = Shop.look();
        const id = look[slot];
        const preview = !!id && id !== Shop.equippedId(slot);
        if (!id) { tip.className = 'sh-tip'; tip.innerHTML = ''; return; }
        const it = Shop.item(id);
        const s = this._statsOf(id);
        const rar = (it && it.rarity) || 'common';
        let html = `<b>${this.esc(this.t(preview ? 'sh.tip.try' : 'sh.tip.worn', { name: Shop.name(id) }))}</b>`;
        if (s && s.kind === 'sword') {
            const names = { dmg: this.t('sh.stat.dmg'), speed: this.t('sh.stat.speed'), reach: this.t('sh.stat.reach') };
            html += ` <span class="dim sm">· ${s.bars.map((b) => this.esc(names[b.k]) + ' ' + b.txt).join(' · ')}</span>`;
            if (s.ability) html += `<span class="nm"><span class="ab r-${rar}">${this.esc(this.t('sh.stat.ability'))}: ${this.esc(s.ability.name)}</span> — ${this.esc(s.ability.desc)}</span>`;
        } else if (s && s.kind === 'skin') {
            html += ` <span class="dim">· ${this.esc(s.label)}</span>`;
        }
        tip.className = 'sh-tip on' + (preview ? ' pv r-' + rar : '');
        tip.innerHTML = html;
    },

    _cardHtml(c, previewed, sig, idx) {
        const rarity = c.rarity || 'common';
        const rank = Math.max(0, Shop.RARITIES.indexOf(rarity));
        const cls = ['sh-card', 'r-' + rarity, 'st-' + c.state, 'k-' + c.kind];
        if (previewed) cls.push('sel');
        if (idx >= 0 && !this._reduced()) cls.push('in');
        const st = this._statsHtml(c);
        if (st.has) cls.push('hs');
        const down = this._busy || c.busy;
        // цена / состояние
        let price = '';
        if (c.owned) price = `<span class="sh-state">${this.esc(c.priceLabel)}</span>`;
        else if (c.kind === 'coins') price = `<span class="sh-pr${c.affordable ? '' : ' poor'}">${this.ico('coin', 'gold')}<b>${c.price}</b></span>`;
        else if (c.kind === 'ads') {
            let pips = '';
            for (let i = 0; i < c.need; i++) pips += `<i class="${i < c.progress ? 'on' : ''}"></i>`;
            price = `<span class="sh-pr ad">${this.ico('video', '#9b4dff')}<span>${this.esc(c.priceLabel)}</span></span><span class="sh-pips">${pips}</span>`;
        } else if (c.kind === 'exclusive') price = `<span class="sh-pr ad">${this.ico('gift', '#ff5d1f')}<span>${this.esc(c.priceLabel)}</span></span>`;
        // кнопка
        let btn = '';
        const b = (color, enabled, inner, extra) => `<button class="pb-btn small sh-btn ${color}${enabled && !down ? '' : ' off'}${down ? ' busy' : ''}" data-act="buy" aria-disabled="${enabled && !down ? 'false' : 'true'}"${extra || ''}><span class="t">${inner}</span></button>`;
        if (c.action === 'buy') btn = b('green', c.enabled, this.esc(c.actionLabel));
        else if (c.action === 'watch') {
            const label = c.adWait > 0 ? this.esc(this.t('sh.wait', { n: c.adWait })) : this.esc(this.t('sh.watch'));
            btn = b('purple', c.enabled, this.ico('video') + label);
        } else if (c.action === 'equip') btn = b('blue', true, this.esc(c.actionLabel));
        else if (c.action === 'unequip') btn = b('white', true, this.esc(c.actionLabel));
        else if (c.kind === 'exclusive') btn = b('white', true, this.ico('gift', '#ff5d1f') + this.esc(this.t('sh.toDaily')));
        else btn = b('green', false, this.ico('check') + this.esc(c.priceLabel || c.actionLabel));
        // подпись (победа: танец и эффект)
        let cap = '';
        const found = GameShopData.find(c.id);
        if (found && found.tab === 'victory') cap = `<div class="sh-cap">${this.esc(this.t('sh.dance.' + found.data.dance))} · ${this.esc(this.t('sh.fx.' + found.data.fx))}</div>`;
        const badge = c.equipped ? `<span class="sh-bd eq">${this.ico('check')}</span>` : c.kind === 'exclusive' ? `<span class="sh-bd gf">${this.ico('gift')}</span>` : !c.owned ? `<span class="sh-bd lk">${this.ico('lock')}</span>` : '';
        const tryon = previewed ? `<span class="sh-tryon">${this.esc(this.t('sh.preview'))}</span>` : '';
        return `<div class="${cls.join(' ')}" data-id="${this.esc(c.id)}" data-sig="${this.esc(sig)}" style="--i:${Math.max(0, idx)}">${tryon}`
            + badge + `<div class="sh-pic">${this._itemIcon(c.id)}${st.dot}<span class="sh-stars" title="${this.esc(c.rarityLabel)}">${'★'.repeat(rank + 1)}</span></div>`
            + `<div class="sh-name" style="--len:${Math.max(6, ...String(c.name).split(/\s+/).map((w) => w.length))}">${this.esc(c.name)}</div>${cap}${st.html}<div class="sh-price">${price}</div>${btn}</div>`;
    },

    /** Тап по карточке: примерка на персонаже (повторный тап — снять примерку). */
    _togglePreview(id) {
        const c = Shop.card(id);
        if (!c) return;
        this.click();
        const look = Shop.look();
        if (c.equipped || look[c.slot] === id) Shop.clearPreview(c.slot);
        else Shop.preview(id);
    },

    /** Кнопка карточки: купить / посмотреть рекламу / надеть / снять. Защита от двойных нажатий. */
    async _cardAction(id) {
        if (this._busy) { this.toast(this.t('sh.busy')); return; }
        const c = Shop.card(id);
        if (!c) return;
        this.click();
        if (c.action === 'none') { if (c.kind === 'exclusive') this.open('daily'); return; }
        if (!c.enabled) { this.toast(c.hint || this.t(c.busy ? 'sh.busy' : 'shop.adUnavailable')); return; }
        this._busy = true;
        this._renderGrid();
        /** @type {any} */ let r;
        try { r = await Shop.act(id); } catch (err) { console.warn('GameShopUI:', err); r = { ok: false, reason: 'error' }; }
        this._busy = false;
        const name = Shop.name(id);
        if (r.ok) {
            if (c.action === 'buy') { this.sfx(this.SFX.coin, 0.8); this.toast(this.t('sh.bought', { name })); }
            else if (c.action === 'watch') {
                if (r.unlocked) { this.sfx(this.SFX.reward); this.toast(this.t('sh.unlocked', { name })); }
                else { this.sfx(this.SFX.coin, 0.6); this.toast(this.t('sh.adStep', { a: r.progress, b: r.need })); }
            }
        } else if (r.reason === 'noCoins') this.toast(Shop.t('shop.noCoins', { n: r.missing || 0 }));
        else if (r.reason === 'busy') this.toast(this.t('sh.busy'));
        else if (r.reason === 'adFailed' || r.reason === 'adUnavailable' || r.reason === 'cooldown') this.toast(this.t('shop.adUnavailable'));
        this._renderShop(false);
        if (r.ok && (c.action === 'buy' || (c.action === 'watch' && r.unlocked))) {
            const el = this.el.grid.querySelector('[data-id="' + id + '"]');
            if (el) {
                el.classList.add('pop');
                window.setTimeout(() => el.classList.remove('pop'), 650);
                const r = el.getBoundingClientRect();
                this._drops(ViewCap.x(r.left) + r.width / 2, r.top + r.height * 0.4, c.rarity);
            }
        }
    },

    // =============================================================================================
    // Подарок дня
    // =============================================================================================

    _renderDaily(fresh) {
        const anim = !!fresh && !this._reduced();
        for (const e of this.root.querySelectorAll('.sh-cn')) e.textContent = String(Shop.coins);
        const v = DailyGift.view();
        const days = v.days;
        const hero = days[days.length - 1];
        const coinPile = (n) => {
            const k = Math.max(1, Math.min(4, Math.round(n / 70)));
            let s = '';
            for (let i = 0; i < k; i++) s += `<span class="sh-ic gold" style="left:${i * 9}px;top:${(i % 2) * 5}px"><i style="--m:url(${this.ICON.coin})"></i></span>`;
            return `<div class="sh-pile">${s}</div>`;
        };
        const dayHtml = (d) => {
            const r = d.reward;
            const stamp = d.state === 'claimed' ? `<span class="sh-stamp">${this.ico('check')}</span>` : '';
            const tag = d.state === 'today' ? `<span class="sh-tag">${this.esc(d.stateLabel)}</span>` : d.state === 'tomorrow' ? `<span class="sh-tag">${this.esc(d.stateLabel)}</span>` : '';
            const pic = r.item ? this._itemIcon(r.item) : coinPile(r.coins);
            const lab = r.coins > 0 ? `<div class="sh-dlab">${this.ico('coin', 'gold')}<span>+${r.coins}</span></div>` : '';
            const nm = r.item ? `<div class="sh-dnm">${this.esc(Shop.name(r.item))}</div>` : '';
            return `<div class="sh-day st-${d.state}${anim ? ' in' : ''}" data-day="${d.day}" style="--i:${d.day - 1}">${tag}${stamp}<div class="sh-dn">${this.esc(d.dayLabel)}</div><div class="sh-dpic">${pic}</div>${lab}${nm}</div>`;
        };
        let heroPic, heroName, heroNote;
        if (hero.reward.exclusive) {
            heroPic = this._itemIcon(hero.reward.exclusive);
            heroName = Shop.name(hero.reward.exclusive);
            heroNote = this.t('daily.exclusive') + '. ' + this.t('daily.exclusiveHint');
        } else {
            heroPic = coinPile(hero.reward.coins || 600);
            heroName = '+' + (hero.reward.coins || 600);
            heroNote = this.t('sh.daily.big');
        }
        const heroStamp = hero.state === 'claimed' ? `<span class="sh-stamp">${this.ico('check')}</span>` : '';
        const heroTag = hero.state === 'today' ? `<span class="sh-tag">${this.esc(hero.dayLabel)}</span>` : `<span class="sh-tag">${this.esc(hero.dayLabel)}</span>`;
        this.el.dbody.innerHTML = `<div class="sh-dsub">${this.esc(this.t('sh.daily.sub'))}</div>`
            + `<div class="sh-days">${days.slice(0, days.length - 1).map(dayHtml).join('')}</div>`
            + `<div class="sh-hero st-${hero.state}${anim ? ' in' : ''}"><div class="sh-raywrap"><div class="sh-rays"></div></div>${heroTag}${heroStamp}<div class="sh-hfig">${heroPic}</div>`
            + `<div class="sh-hinfo"><div class="sh-hname">${this.esc(heroName)}</div><div class="sh-hnote">${this.esc(heroNote)}</div></div></div>`
            + `<div class="sh-dfoot"></div>`;
        this._renderDailyFoot();
    },

    _renderDailyFoot() {
        const foot = this.el.dbody.querySelector('.sh-dfoot');
        if (!foot) return;
        const v = DailyGift.view();
        const busy = this._busy;
        let html = '';
        if (!v.canClaim) {
            html = `<div class="sh-wait">${this.esc(this.t('sh.daily.done'))}<br>${this.esc(v.nextLabel)}</div>`;
        } else {
            html += `<button class="pb-btn green big${busy ? ' off busy' : ''}" data-act="claim" aria-disabled="${busy}"><span class="t">${this.esc(v.claim.label)}</span></button>`;
            if (v.x2.available) {
                const today = v.days.find((d) => d.state === 'today');
                const coins2 = today ? today.reward.coins * 2 : 0;
                const off = busy || !v.x2.enabled;
                const lab = v.x2.adWait > 0 ? this.t('sh.wait', { n: v.x2.adWait }) : v.x2.label;
                html += `<button class="pb-btn purple${off ? ' off' : ''}${busy ? ' busy' : ''}" data-act="claim2" aria-disabled="${off}">${this.ico('video')}<span class="t">${this.esc(lab)}</span>`
                    + (coins2 ? `<span class="sh-x2chip">${this.ico('coin', 'gold')}+${coins2}</span>` : '') + `</button>`;
            }
            const hint = v.x2.hint;
            if (hint) html += `<div class="sh-note">${this.esc(hint)}</div>`;
        }
        if (foot.dataset.h !== html) { foot.innerHTML = html; foot.dataset.h = html; }
    },

    /** Забрать подарок (x2 — после рекламы). */
    async _claim(x2) {
        if (this._busy) { this.toast(this.t('sh.busy')); return; }
        const v = DailyGift.view();
        if (!v.canClaim) { this._renderDaily(); return; }
        if (x2 && !v.x2.enabled) { this.toast(v.x2.hint || this.t('daily.adUnavailable')); return; }
        this.click();
        this._busy = true;
        this._renderDailyFoot();
        /** @type {any} */ let r;
        try { r = x2 ? await DailyGift.claimX2() : DailyGift.claim(); } catch (err) { console.warn('GameShopUI:', err); r = { ok: false, reason: 'error' }; }
        this._busy = false;
        const g = this._game();
        if (g && g.refreshCoins) g.refreshCoins();
        if (r.ok) {
            this._renderDaily();
            this.sfx(this.SFX.reward);
            this._popup({ title: this.t('sh.got'), got: r.got, sub: DailyGift.t('daily.day', { n: r.day }), splat: 0, color: '#2fd36b' });
            return;
        }
        if (r.reason === 'adFailed' || r.reason === 'adUnavailable' || r.reason === 'cooldown') this.toast(this.t('daily.adUnavailable'));
        else if (r.reason === 'noX2') this.toast(this.t('daily.noX2'));
        else if (r.reason === 'busy') this.toast(this.t('sh.busy'));
        this._renderDaily();
    },

    // =============================================================================================
    // Колесо фортуны
    // =============================================================================================

    _openWheel() {
        for (const e of this.root.querySelectorAll('.sh-cn')) e.textContent = String(Shop.coins);
        this._wAngle = ((this._wAngle % 360) + 360) % 360;
        this._buildWheel();
        this._renderWheelCtl();
        if (this._recovered) {
            const e = this._recovered;
            this._recovered = null;
            this.toast(this.t('sh.wheel.late', { label: e.label }));
        }
    },

    _buildWheel() {
        const secs = Wheel.sectors();
        const n = secs.length;
        const step = 360 / n;
        const R = 84;
        const pt = (deg, r) => { const a = (deg * Math.PI) / 180; return [(r * Math.sin(a)).toFixed(2), (-r * Math.cos(a)).toFixed(2)]; };
        let defs = '', wedges = '', bulbs = '', prizes = '';
        secs.forEach((s, i) => {
            const col = (s.data && s.data.color) || '#ff8a1f', col2 = (s.data && s.data.color2) || col;
            const [x0, y0] = pt((i - 0.5) * step, R), [x1, y1] = pt((i + 0.5) * step, R);
            defs += `<radialGradient id="shg${i}" cx="0" cy="0" r="${R}" gradientUnits="userSpaceOnUse"><stop offset="0.25" stop-color="${col}"/><stop offset="1" stop-color="${col2}"/></radialGradient>`;
            wedges += `<path data-i="${i}" d="M0 0L${x0} ${y0}A${R} ${R} 0 0 1 ${x1} ${y1}Z" fill="url(#shg${i})" stroke="#1b1530" stroke-width="1.6" stroke-linejoin="round"/>`;
            let inner;
            if (s.kind === 'item') inner = `<div class="sh-box">${this._itemIcon(s.itemId)}</div>`;
            else inner = `${this.ico('coin', 'gold')}<span>${s.coins}</span>`;
            prizes += `<div class="sh-pzw" data-i="${i}" style="transform: rotate(${(i * step).toFixed(3)}deg)"><div class="sh-pz${s.data && s.data.jackpot ? ' jp' : ''}" title="${this.esc(s.label)}">${inner}</div></div>`;
        });
        for (let k = 0; k < n * 2; k++) {
            const [bx, by] = pt((k + 0.5) * (step / 2) - step / 2 + 0, 91);
            bulbs += `<circle class="bulb ${k % 2 ? 'b' : ''}" cx="${bx}" cy="${by}" r="2.5" fill="#fff6c2" stroke="#1b1530" stroke-width="0.9"/>`;
        }
        const svg = `<svg viewBox="-100 -100 200 200" aria-hidden="true"><defs>${defs}</defs>`
            + `<circle r="99" fill="#1b1530"/><circle r="95.5" fill="#7a3cff"/><circle r="86.5" fill="#1b1530"/>${wedges}${bulbs}</svg>`;
        const disc = this.el.wdisc;
        disc.innerHTML = svg + prizes;
        disc.style.transform = 'rotate(' + this._wAngle + 'deg)';
    },

    _renderWheelCtl() {
        const st = Wheel.status();
        const busy = this._busy || this._spinning;
        const freeOn = st.canSpinFree && !busy;
        const adOn = st.canSpinAd && !busy;
        const n = st.adLeft + st.banked;
        const free = st.freeAvailable
            ? `<button class="pb-btn green big sh-wbtn${freeOn ? '' : ' off'}${busy ? ' busy' : ''}" data-act="spin-free" aria-disabled="${!freeOn}"><span class="t">${this.esc(this.t('wheel.free'))}</span></button>`
            : `<button class="pb-btn green sh-wbtn off" data-act="spin-free" aria-disabled="true"><span class="t">${this.esc(st.freeLabel)}</span></button>`;
        const adLabel = st.adWait > 0 ? this.t('sh.wait', { n: st.adWait }) : this.t('sh.wheel.spinAd', { n });
        const ad = `<button class="pb-btn purple sh-wbtn${adOn ? '' : ' off'}${busy ? ' busy' : ''}" data-act="spin-ad" aria-disabled="${!adOn}">${this.ico('video')}<span class="t">${this.esc(adLabel)}</span></button>`;
        const hint = this._spinning ? this.t('wheel.spinning') : st.hint || '';
        const html = `<div class="sh-wsub">${this.esc(this.t('sh.wheel.sub'))}</div>${free}${ad}<div class="sh-whint">${this.esc(hint)}</div>`;
        if (this.el.wctl.dataset.h !== html) { this.el.wctl.innerHTML = html; this.el.wctl.dataset.h = html; }
    },

    /** Вращение: результат выбирает Wheel ДО анимации; диск точно останавливается на выпавшем секторе. */
    async _spin(kind) {
        if (this._busy || this._spinning) { this.toast(this.t('sh.busy')); return; }
        const st = Wheel.status();
        if (kind === 'free' && !st.canSpinFree) { this.toast(st.hint || st.freeLabel); return; }
        if (kind === 'ad' && !st.canSpinAd) { this.toast(st.hint || this.t('wheel.adUnavailable')); return; }
        this.click();
        this._busy = true;
        this._renderWheelCtl();
        /** @type {any} */ let res;
        try { res = kind === 'free' ? Wheel.spinFree() : await Wheel.spinAd(); } catch (err) { console.warn('GameShopUI:', err); res = { ok: false, reason: 'error' }; }
        this._busy = false;
        if (!res.ok) {
            if (res.reason === 'adFailed' || res.reason === 'adUnavailable' || res.reason === 'cooldown') this.toast(this.t('wheel.adUnavailable'));
            else if (res.reason === 'limit') this.toast(this.t('wheel.noSpins'));
            else if (res.reason === 'pending') this.toast(this.t('wheel.spinning'));
            else if (res.reason === 'noFree') this.toast(this.t('wheel.freeIn', { t: Wheel.formatTime(res.nextFreeMs || 0) }));
            this._renderWheelCtl();
            return;
        }
        this._spinning = true;
        this._spinRes = res;
        const wbox = this.el.wdisc.closest('.sh-wbox');
        if (wbox) { wbox.classList.remove('won'); wbox.classList.add('go'); }
        this._renderWheelCtl();
        await this._animate(res);
        this._finishSpin(false);
    },

    /** @type {any} */ _spinRes: null,
    _resolveAnim: /** @type {(() => void) | null} */ (null),

    _animate(res) {
        return new Promise((resolve) => {
            const disc = this.el.wdisc;
            const from = this._wAngle;
            const to = Wheel.angleFrom(from, res);
            const dur = Math.max(1200, res.durationMs || 5500);
            const t0 = performance.now();
            let last = Wheel.sectorAt(from);
            this._resolveAnim = resolve;
            const frame = (now) => {
                if (!this._resolveAnim) return;   // принудительно завершено (окно закрыто)
                const p = Math.min(1, (now - t0) / dur);
                const e = 1 - Math.pow(1 - p, 3);
                const a = from + (to - from) * e;
                this._wAngle = a;
                disc.style.transform = 'rotate(' + a.toFixed(3) + 'deg)';
                const sec = Wheel.sectorAt(a);
                if (sec !== last) {
                    last = sec;
                    if (now - this._lastTick > 50) { this._lastTick = now; this.sfx(this.SFX.tick, 0.45); }
                    const ptr = this.el.pointer;
                    ptr.classList.remove('tk'); void ptr.offsetWidth; ptr.classList.add('tk');
                }
                if (p < 1) this._anim = requestAnimationFrame(frame);
                else { this._wAngle = to; disc.style.transform = 'rotate(' + to + 'deg)'; const f = this._resolveAnim; this._resolveAnim = null; if (f) f(); }
            };
            this._anim = requestAnimationFrame(frame);
        });
    },

    /** Анимация закончена (или окно закрыли во время вращения): приз начисляется один раз. */
    _finishSpin(forced) {
        if (!this._spinning) return;
        this._spinning = false;
        const res = this._spinRes;
        this._spinRes = null;
        if (this._resolveAnim) {
            const f = this._resolveAnim;
            this._resolveAnim = null;
            cancelAnimationFrame(this._anim);
            if (res) { this._wAngle = Wheel.angleFrom(this._wAngle, res); }
            f();
        }
        const fin = Wheel.finish();
        const g = this._game();
        if (g && g.refreshCoins) g.refreshCoins();
        const wbox = this.el.wdisc.closest('.sh-wbox');
        if (wbox) wbox.classList.remove('go');
        if (!fin.ok) { this._renderWheelCtl(); return; }
        const disc = this.el.wdisc;
        if (forced || !this.isOpen) { this.toast(fin.label); return; }
        const i = fin.sector;
        const w = disc.querySelector('.sh-pzw[data-i="' + i + '"] .sh-pz');
        const path = disc.querySelector('path[data-i="' + i + '"]');
        if (w) w.classList.add('win');
        if (path) path.classList.add('win');
        if (wbox) { wbox.classList.add('won'); window.setTimeout(() => wbox.classList.remove('won'), 3500); }
        this.sfx(this.SFX.reward);
        this._renderWheelCtl();
        window.setTimeout(() => {
            if (!this.isOpen || this.kind !== 'wheel') return;
            this._popup({ title: this.t('wheel.win'), got: fin.got, sub: '', splat: 3, color: '#9b4dff', after: () => { this._wAngle = ((this._wAngle % 360) + 360) % 360; this._buildWheel(); this._renderWheelCtl(); } });
        }, 650);
    },

    // =============================================================================================
    // Окно награды и подсказки
    // =============================================================================================

    /**
     * Окно «получено»: got — список из DailyGift/Wheel ({ type: coins|item|exclusive, amount, id, converted }).
     * @param {{ title: string, got: any[], sub?: string, splat?: number, color?: string, after?: () => void }} o
     */
    _popup(o) {
        let coins = 0, dup = false;
        const items = [];
        for (const g of o.got || []) {
            if (g.type === 'coins') { coins += g.amount; if (g.converted) dup = true; }
            else if (g.id) items.push(g);
        }
        const rar = (id) => { const it = Shop.item(id); return 'r-' + ((it && it.rarity) || 'common'); };
        let html = `<div class="sh-pop-t">${this.esc(o.title)}</div>`;
        if (o.sub) html += `<div class="sh-pop-note">${this.esc(o.sub)}</div>`;
        if (coins > 0) html += `<div class="sh-pop-big">${this.ico('coin', 'gold')}<span class="sh-n" data-n="${coins}">+${this._reduced() ? coins : 0}</span></div>`;
        if (dup) html += `<div class="sh-pop-note">${this.esc(DailyGift.t('reward.dup', { n: coins }))}</div>`;
        if (items.length) {
            html += '<div class="sh-pop-items">' + items.map((g) => `<div class="sh-pop-item ${rar(g.id)}"><div class="sh-pic">${this._itemIcon(g.id)}</div>`
                + `<div class="sh-name">${this.esc(Shop.name(g.id))}</div>`
                + `<button class="pb-btn small blue sh-btn" data-act="pop-equip" data-id="${this.esc(g.id)}"><span class="t">${this.esc(Shop.t('shop.equip'))}</span></button></div>`).join('') + '</div>';
        }
        html += `<button class="pb-btn green" data-act="pop-close"><span class="t">${this.esc(this.t('sh.nice'))}</span></button>`;
        const popc = this.el.popc;
        popc.innerHTML = html;
        popc.style.setProperty('--m', 'url(' + this.SPLATS[o.splat || 0] + ')');
        popc.style.setProperty('--sp', o.color || '#ff8a1f');
        this.el.pop.classList.add('on');
        this._popupFn = o.after || null;
        this._burst();
        const num = popc.querySelector('.sh-n');
        if (num) { this._countUp(num, Number(num.dataset.n) || 0); this._coinRain(Math.min(18, 6 + Math.round(coins / 12))); }
    },

    _popupClose(silent) {
        const pop = this.el.pop;
        if (!pop) return;
        const was = pop.classList.contains('on');
        pop.classList.remove('on');
        const f = this._popupFn;
        this._popupFn = null;
        if (was && f && !silent) f();
    },

    _reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); },

    /** Вылет окна: упругий масштаб 0.85 -> 1.04 -> 1 с лёгким поворотом. */
    _winIn(win) {
        if (!win || this._reduced()) return;
        win.classList.remove('in');
        void win.offsetWidth;
        win.classList.add('in');
        window.setTimeout(() => win.classList.remove('in'), 700);
    },

    /** «Бамп» счётчиков монет. */
    _bump() {
        if (!this.isOpen || this._reduced()) return;
        for (const e of this.root.querySelectorAll('.sh-coins')) { e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }
    },

    /** Разлёт капель краски (цвет редкости и яркие краски) из точки экрана. */
    _drops(x, y, rarity) {
        if (this._reduced() || !this.el.fx) return;
        const rc = { common: '#9fb0cc', uncommon: '#3fd16b', rare: '#2f9bff', epic: '#a45bff', legendary: '#ffc21f' }[rarity] || '#ffd23f';
        const colors = [rc, rc, '#ffd23f', '#ff5fa2', '#2fd36b', '#ff8a1f', '#ffffff'];
        const fx = this.el.fx;
        for (let i = 0; i < 16; i++) {
            const d = document.createElement('i');
            d.className = 'sh-drop';
            const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5, v = 50 + Math.random() * 110;
            d.style.left = Math.round(x) + 'px';
            d.style.top = Math.round(y) + 'px';
            d.style.setProperty('--dx', Math.round(Math.cos(a) * v) + 'px');
            d.style.setProperty('--dy', Math.round(Math.sin(a) * v) + 'px');
            d.style.setProperty('--c', colors[i % colors.length]);
            d.style.setProperty('--sz', Math.round(7 + Math.random() * 9) + 'px');
            d.style.animationDelay = Math.round(Math.random() * 90) + 'ms';
            fx.appendChild(d);
            window.setTimeout(() => d.remove(), 1200);
        }
    },

    /** Монеты сыплются сверху окна награды. */
    _coinRain(n) {
        if (this._reduced() || !this.el.fx) return;
        const fx = this.el.fx;
        const fall = window.innerHeight + 60;
        for (let i = 0; i < n; i++) {
            const c = document.createElement('span');
            c.className = 'sh-rc sh-ic gold';
            c.innerHTML = '<i style="--m:url(' + this.ICON.coin + ')"></i>';
            c.style.left = Math.round(4 + Math.random() * 92) + '%';
            c.style.setProperty('--fall', fall + 'px');
            c.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');
            c.style.fontSize = Math.round(18 + Math.random() * 14) + 'px';
            c.style.animationDelay = Math.round(150 + Math.random() * 700) + 'ms';
            fx.appendChild(c);
            window.setTimeout(() => c.remove(), 2600);
        }
    },

    /** Число набегает от 0 до target. */
    _countUp(el, target) {
        if (this._reduced() || target <= 0) { el.textContent = '+' + target; return; }
        const t0 = performance.now(), dur = 850;
        const step = (now) => {
            const p = Math.min(1, (now - t0) / dur);
            el.textContent = '+' + Math.round(target * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        window.setTimeout(() => { el.textContent = '+' + target; }, dur + 120);
    },

    /** Брызги краски-конфетти над окном награды. */
    _burst() {
        const colors = ['#ff4d5e', '#ffd23f', '#2f9bff', '#2fd36b', '#ff8a1f', '#9b4dff', '#ff5fa2'];
        const root = this.root;
        for (let i = 0; i < 22; i++) {
            const s = document.createElement('i');
            s.className = 'sh-sp';
            const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 190;
            s.style.setProperty('--dx', Math.round(Math.cos(a) * d) + 'px');
            s.style.setProperty('--dy', Math.round(Math.sin(a) * d - 30) + 'px');
            s.style.setProperty('--rot', Math.round(Math.random() * 540 - 270) + 'deg');
            s.style.setProperty('--c', colors[i % colors.length]);
            s.style.animationDelay = Math.round(Math.random() * 120) + 'ms';
            root.appendChild(s);
            window.setTimeout(() => s.remove(), 1300);
        }
    },

    /** Короткая подсказка над окном (у нижнего края активного окна). */
    toast(text) {
        const t = this.el.toast;
        if (!t) return;
        const win = this.kind === 'daily' ? this.el.daily : this.kind === 'wheel' ? this.el.wheelwin : this.el.shop;
        const r = win.getBoundingClientRect();
        t.textContent = text;
        t.style.left = Math.round(ViewCap.x(r.left) + r.width / 2) + 'px';
        t.style.top = Math.round(r.bottom - 14) + 'px';
        t.classList.add('on');
        window.clearTimeout(this._toastT);
        this._toastT = window.setTimeout(() => t.classList.remove('on'), 2300);
    },

    // =============================================================================================
    // Иконки предметов (скины — мини-фигурка R6, шапки и мечи — иконки каталога, остальное — рисунок)
    // =============================================================================================

    /** HTML иконки предмета по id. */
    _itemIcon(id) {
        const f = GameShopData.find(id);
        if (!f) return '';
        const d = f.data;
        let art = '';
        switch (f.tab) {
            case 'skins': art = this._figure(d.look); break;
            case 'hats': case 'swords': {
                const g = f.tab === 'hats' ? 'hat' : 'sword';
                art = d.icon ? `<img class="sh-img" data-g="${g}" src="${this.esc(d.icon)}" alt="" draggable="false">` : this._glyphSvg(g, 'sh-fb');
                break;
            }
            case 'paints': art = this._splat(d); break;
            case 'trails': art = this._swoosh(d); break;
            case 'victory': art = this._victory(d); break;
            default: return '';
        }
        // .sh-art — рамка превью: рисунок вписан с полями 10% и обрезан по краю, ничего не выходит наружу
        return '<span class="sh-art">' + art + '</span>';
    },

    _hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return Math.abs(h); },

    _hex(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) || 0); },
    _mix(a, b, t) { const A = this._hex(a), B = this._hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); },
    _lum(h) { const [r, g, b] = this._hex(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; },

    /** Палитра краски -> фон клякс (hex-цвета). */
    _paintBg(d) {
        const cs = d.colors && d.colors.length ? d.colors : ['#ffd400'];
        if (cs.length === 1) return cs[0];
        if (d.perDrop || cs.length >= 4) {
            const n = cs.length;
            return 'conic-gradient(' + cs.map((c, i) => c + ' ' + Math.round((i / n) * 100) + '% ' + Math.round(((i + 1) / n) * 100) + '%').join(',') + ')';
        }
        return 'linear-gradient(135deg,' + cs.join(',') + ')';
    },

    /** Клякса цвета палитры: маска assets/fx/splat_0N.webp (нет файла — круг). */
    _splat(d) {
        const url = this.SPLATS[this._hash(d.id) % this.SPLATS.length];
        const glow = d.glow ? ` glow" style="--gl:${(d.colors && d.colors[0]) || '#fff'}` : '';
        const spark = d.sparkle ? '<span class="gl" style="left:6%;top:8%"><svg viewBox="0 0 20 20"><path d="M10 0L12 8L20 10L12 12L10 20L8 12L0 10L8 8Z" fill="#fff" stroke="#1b1530" stroke-width="1.4"/></svg></span>'
            + '<span class="gl" style="left:70%;top:60%;width:16%"><svg viewBox="0 0 20 20"><path d="M10 0L12 8L20 10L12 12L10 20L8 12L0 10L8 8Z" fill="#fff" stroke="#1b1530" stroke-width="1.4"/></svg></span>' : '';
        return `<span class="sh-splw${glow}"><span class="sh-splat" style="--m:url(${url});background:${this._paintBg(d)}"></span>${spark}</span>`;
    },

    /** След клинка: изогнутая лента from -> to (толщина — width из каталога). */
    _swoosh(d) {
        const w = Math.max(14, Math.min(52, d.width || 30)) / 52;
        const T = 8 + w * 22;
        const id = 'sg' + this._hash(d.id);
        const stops = d.rainbow
            ? ['#ff4fa3', '#ff8a00', '#ffe600', '#22e55e', '#00b4ff', '#b000ff'].map((c, i, a) => `<stop offset="${(i / (a.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')
            : `<stop offset="0" stop-color="${d.to}" stop-opacity="0.8"/><stop offset="1" stop-color="${d.from}"/>`;
        const star = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -6L1.8 -1.8L6 0L1.8 1.8L0 6L-1.8 1.8L-6 0L-1.8 -1.8Z" fill="#fff" stroke="#1b1530" stroke-width="1"/>`;
        let fx = '';
        if (d.fx === 'star') fx = star(26, 18, 1.2) + star(78, 58, 0.9) + star(98, 10, 0.8);
        else if (d.fx === 'spark') fx = [[30, 22], [58, 10], [90, 54], [102, 8], [16, 36]].map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="2.6" fill="${d.from}" stroke="#1b1530" stroke-width="1"/>`).join('');
        else if (d.fx === 'smoke') fx = [[30, 20, 7], [70, 56, 9], [96, 30, 6]].map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="${p[2]}" fill="${d.to}" fill-opacity="0.45"/>`).join('');
        else if (d.fx === 'soft') fx = [[28, 24, 4], [74, 58, 5], [100, 12, 3.5]].map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="${p[2]}" fill="#fff" fill-opacity="0.8"/>`).join('');
        const glow = d.glow ? ` style="filter:drop-shadow(0 0 5px ${d.from})"` : '';
        const path = `M6 66 Q42 2 114 14 L108 ${(14 + T).toFixed(1)} Q54 ${(20 + T * 0.55).toFixed(1)} 6 66 Z`;
        return `<svg class="sh-sw" viewBox="0 0 120 80" aria-hidden="true"${glow}><defs><linearGradient id="${id}" x1="6" y1="0" x2="114" y2="0" gradientUnits="userSpaceOnUse">${stops}</linearGradient></defs>`
            + `${fx}<path d="${path}" fill="url(#${id})" stroke="#1b1530" stroke-width="5" stroke-linejoin="round"/></svg>`;
    },

    /** Победа: танцующий человечек (поза по dance) и эффект салюта вокруг него (по fx, в цветах эффекта). */
    _victory(d) {
        const cs = d.colors && d.colors.length ? d.colors : ['#ff4d5e', '#ffd23f', '#2f9bff', '#2fd36b', '#ff8a1f'];
        const c = (i) => cs[i % cs.length];
        const ink = '#1b1530';
        // точки вокруг фигурки: слева, справа и по углам
        const at = [[12, 14], [68, 12], [9, 42], [71, 40], [13, 66], [67, 66], [40, 5]];
        const one = (i, x, y) => {
            const col = c(i);
            switch (d.fx) {
                case 'fireworks': {
                    let g = '';
                    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g += `<line x1="${(x + Math.cos(a) * 3).toFixed(1)}" y1="${(y + Math.sin(a) * 3).toFixed(1)}" x2="${(x + Math.cos(a) * 9).toFixed(1)}" y2="${(y + Math.sin(a) * 9).toFixed(1)}" stroke="${c(i + k)}" stroke-width="3" stroke-linecap="round"/>`; }
                    return g;
                }
                case 'paintRain': return `<path d="M${x} ${y - 8}Q${x + 7} ${y + 1} ${x} ${y + 6}Q${x - 7} ${y + 1} ${x} ${y - 8}Z" fill="${col}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>`;
                case 'stars': return `<path transform="translate(${x} ${y}) scale(0.95)" d="M0 -9L2.6 -2.8L9 -2.8L3.8 1.4L5.6 8L0 4L-5.6 8L-3.8 1.4L-9 -2.8L-2.6 -2.8Z" fill="${col}" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round"/>`;
                case 'coins': return `<circle cx="${x}" cy="${y}" r="7.5" fill="#ffd23f" stroke="${ink}" stroke-width="2.6"/><circle cx="${x}" cy="${y}" r="3.8" fill="none" stroke="#e8a400" stroke-width="2"/>`;
                case 'hearts': return `<path transform="translate(${x} ${y}) scale(0.62)" d="M0 10C-18 -2 -10 -16 0 -6C10 -16 18 -2 0 10Z" fill="${i % 2 ? '#ff5fa2' : '#ff4d5e'}" stroke="${ink}" stroke-width="3.4" stroke-linejoin="round"/>`;
                case 'bubbles': return `<circle cx="${x}" cy="${y}" r="${6 + (i % 3) * 1.5}" fill="#bfe9ff" fill-opacity="0.85" stroke="${ink}" stroke-width="2.4"/><circle cx="${x - 2}" cy="${y - 2}" r="1.4" fill="#fff"/>`;
                case 'sparkles': return `<path transform="translate(${x} ${y}) scale(0.7)" d="M0 -12L3 -3L12 0L3 3L0 12L-3 3L-12 0L-3 -3Z" fill="${col}" stroke="${ink}" stroke-width="2.6" stroke-linejoin="round"/>`;
                default: return `<rect x="${x - 5}" y="${y - 3}" width="10" height="6" rx="1.4" transform="rotate(${(i * 47) % 80 - 40} ${x} ${y})" fill="${col}" stroke="${ink}" stroke-width="2.2"/>`;
            }
        };
        const fx = at.map((p, i) => one(i, p[0], p[1])).join('');
        // человечек: поза танца
        const arm = (pts) => `<polyline points="${pts}" fill="none" stroke="${ink}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${pts}" fill="none" stroke="#ffd23f" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>`;
        let arms;
        switch (d.dance) {
            case 'dance_2': arms = arm('31,33 17,29 12,19') + arm('49,33 36,47 25,47'); break;
            case 'dance_3': arms = arm('49,31 58,17 60,9') + `<line x1="60" y1="9" x2="64" y2="-2" stroke="${ink}" stroke-width="5" stroke-linecap="round"/><line x1="60" y1="9" x2="64" y2="-2" stroke="#e8eef5" stroke-width="2.2" stroke-linecap="round"/>` + arm('31,33 17,38') + `<path d="M22 60A22 9 0 0 0 58 60" fill="none" stroke="${ink}" stroke-width="4.5" stroke-linecap="round"/><path d="M22 60A22 9 0 0 0 58 60" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 4"/>`; break;
            case 'dance_4': arms = arm('31,32 18,32 18,20') + arm('49,32 62,32 62,44'); break;
            default: arms = arm('31,31 21,15') + arm('49,31 59,15');
        }
        const man = arms
            + `<rect x="32" y="48" width="7" height="15" rx="2" fill="#27a345" stroke="${ink}" stroke-width="2.6"/><rect x="41" y="48" width="7" height="15" rx="2" fill="#27a345" stroke="${ink}" stroke-width="2.6"/>`
            + `<rect x="30" y="29" width="20" height="20" rx="2" fill="#0d69ac" stroke="${ink}" stroke-width="2.8"/><rect x="33" y="15" width="14" height="14" rx="5" fill="#ffd23f" stroke="${ink}" stroke-width="2.8"/>`
            + `<circle cx="37.4" cy="21" r="1.4" fill="${ink}"/><circle cx="42.6" cy="21" r="1.4" fill="${ink}"/><path d="M37 25Q40 27.5 43 25" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>`;
        return `<svg class="sh-vf" viewBox="0 -4 80 74" aria-hidden="true">${fx}${man}</svg>`;
    },

    // ---- мини-фигурка R6 (цвета частей — по правилам PbCharacter.applyLook) ----

    _face(style) {
        const ink = '#16161c';
        const eye = (x, y, rx, ry, f) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f || ink}" stroke="none"/>`;
        const line = (d, w, fill) => `<path d="${d}" fill="${fill || 'none'}" stroke="${ink}" stroke-width="${w || 3.6}" stroke-linecap="round" stroke-linejoin="round"/>`;
        const shine = (x, y) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#fff" stroke="none"/>`;
        switch (style) {
            case 'grin': return eye(70, 20, 3.4, 6) + eye(90, 20, 3.4, 6) + line('M66 31Q80 49 94 31Z', 2.6, ink) + '<rect x="70" y="32" width="20" height="3.6" fill="#fff" stroke="none"/>';
            case 'cool': return `<rect x="58" y="14" width="44" height="11" rx="3" fill="${ink}" stroke="none"/>` + line('M70 35Q80 43 90 35', 3.4);
            case 'happy': return line('M63 24Q70 14 77 24', 3.4) + line('M83 24Q90 14 97 24', 3.4) + line('M68 31Q80 47 92 31Z', 2.4, ink);
            case 'wink': return eye(70, 20, 3.4, 6) + line('M84 21L96 19', 3.6) + line('M68 32Q80 45 92 32', 3.4);
            case 'cute': return eye(69, 21, 4.4, 7) + eye(91, 21, 4.4, 7) + shine(70.5, 18) + shine(92.5, 18) + `<ellipse cx="60" cy="33" rx="5" ry="3" fill="#ff6e8c" fill-opacity="0.6" stroke="none"/><ellipse cx="100" cy="33" rx="5" ry="3" fill="#ff6e8c" fill-opacity="0.6" stroke="none"/>` + line('M75 34Q80 39 85 34', 3);
            case 'surprised': return eye(70, 18, 4, 6.5) + eye(90, 18, 4, 6.5) + eye(80, 35, 4, 5);
            case 'robot': return `<rect x="57" y="11" width="46" height="17" rx="2" fill="${ink}" stroke="none"/><rect x="62" y="16" width="14" height="8" fill="#3df2ff" stroke="none"/><rect x="84" y="16" width="14" height="8" fill="#3df2ff" stroke="none"/><rect x="66" y="35" width="28" height="5" fill="#9aa4ad" stroke="none"/>`;
            case 'ninja': return `<rect x="54" y="11" width="52" height="17" fill="${ink}" stroke="none"/><ellipse cx="68" cy="19.5" rx="6" ry="3.6" fill="#fff" stroke="none"/><ellipse cx="92" cy="19.5" rx="6" ry="3.6" fill="#fff" stroke="none"/>` + eye(69, 19.5, 2.2, 2.6) + eye(91, 19.5, 2.2, 2.6);
            case 'zombie': return eye(69, 21, 4.4, 4.4) + '<circle cx="91" cy="21" r="5" fill="#fff" stroke="none"/>' + eye(92, 22, 1.8, 1.8) + line('M64 35L71 31L78 36L85 31L91 36L97 32', 3.2);
            case 'angry': return eye(70, 23, 3.4, 5) + eye(90, 23, 3.4, 5) + line('M62 12L77 19', 4) + line('M98 12L83 19', 4) + line('M70 38Q80 31 90 38', 3.4);
            case 'mad': return eye(70, 23, 3.8, 3.8) + eye(90, 23, 3.8, 3.8) + line('M61 14L77 21', 4) + line('M99 14L83 21', 4) + `<path d="M66 33H94L90 42H70Z" fill="${ink}" stroke="none"/><rect x="71" y="34" width="18" height="3.4" fill="#fff" stroke="none"/>`;
            case 'evil': return `<path d="M60 14L77 20L64 26Z" fill="${ink}" stroke="none"/><path d="M100 14L83 20L96 26Z" fill="${ink}" stroke="none"/>` + line('M65 32Q80 48 95 32Q80 38 65 32Z', 2.4, ink);
            case 'king': return eye(70, 19, 3.4, 5.4) + eye(90, 19, 3.4, 5.4) + shine(71.5, 16.6) + shine(91.5, 16.6) + line('M70 30Q75 25 80 30Q85 25 90 30', 3) + line('M72 36Q80 41 88 36', 3);
            default: return eye(70, 20, 3.4, 6.2) + eye(90, 20, 3.4, 6.2) + line('M68 32Q80 44 92 32', 3.6);
        }
    },

    /** Мини-фигурка R6 в цветах скина. */
    _figure(look) {
        const L = look || {};
        const ink = '#1b1530';
        const sleeves = !!L.armsLower;
        const c = {
            head: L.head || L.skin, tu: L.shirt, tl: L.waist || L.shirt,
            au: L.armsUpper || (sleeves ? L.shirt : L.skin), al: L.armsLower || L.skin,
            lu: L.legsUpper || L.pants, ll: L.legsLower || L.pants,
        };
        const r = (x, y, w, h, fill, rx) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx || 0}" fill="${fill}"/>`;
        const det = new Set(L.details || []);
        let back = '', front = '';
        const lighten = (hx, t) => this._mix(hx, '#ffffff', t), darken = (hx, t) => this._mix(hx, '#000000', t);
        if (det.has('cape')) {
            const cc = L.legsLower || (this._lum(L.shirt) < 0.28 ? lighten(L.shirt, 0.28) : darken(L.shirt, 0.3));
            back += `<path d="M30 50L130 50L148 166L12 166Z" fill="${cc}"/>`;
        }
        if (det.has('wings')) {
            const wc = this._lum(L.shirt) > 0.8 ? L.shirt : darken(L.skin, 0.4);
            const wing = `<path d="M46 56C6 -6 -22 52 -12 104C-2 94 12 100 28 114Z" fill="${wc}"/>`;
            back += wing + `<g transform="translate(160 0) scale(-1 1)">${wing}</g>`;
        }
        if (det.has('backpack')) back += r(28, 54, 104, 62, darken(L.pants, 0.15), 8);
        if (det.has('jetpack')) back += r(22, 50, 24, 68, '#9aa4ad', 6) + r(114, 50, 24, 68, '#9aa4ad', 6) + r(22, 112, 24, 9, '#ff8a1f', 2) + r(114, 112, 24, 9, '#ff8a1f', 2);
        if (det.has('quiver')) back += `<path d="M106 40L124 34L148 100L130 108Z" fill="#8b5a2b"/>`;
        const body = r(55, 0, 50, 48, c.head, 15) + r(40, 48, 80, 40, c.tu) + r(40, 88, 80, 40, c.tl)
            + r(0, 48, 40, 40, c.au) + r(0, 88, 40, 40, c.al) + r(120, 48, 40, 40, c.au) + r(120, 88, 40, 40, c.al)
            + r(40, 128, 40, 40, c.lu) + r(40, 168, 40, 40, c.ll) + r(80, 128, 40, 40, c.lu) + r(80, 168, 40, 40, c.ll);
        if (det.has('armor')) front += r(47, 53, 66, 30, lighten(L.shirt, 0.28), 5);
        if (det.has('shoulder')) front += r(-6, 40, 50, 18, lighten(L.shirt, 0.2), 9) + r(116, 40, 50, 18, lighten(L.shirt, 0.2), 9);
        if (det.has('vest')) front += r(40, 48, 22, 80, darken(L.shirt, 0.3)) + r(98, 48, 22, 80, darken(L.shirt, 0.3));
        if (det.has('tie')) front += `<path d="M80 50L72 63L80 98L88 63Z" fill="#7a3dd6"/>`;
        if (det.has('belt')) front += r(40, 118, 80, 11, '#3b2a1a') + r(73, 116, 14, 15, '#f2c21f', 2);
        if (det.has('scarf')) front += r(45, 46, 70, 13, '#2f9bff', 6) + r(86, 52, 15, 34, '#2f9bff', 4);
        if (det.has('bandana')) front += r(53, 5, 54, 12, '#7a3dd6', 3);
        const glow = L.glow ? ` style="filter:drop-shadow(0 0 5px ${L.glow})"` : '';
        return `<svg class="sh-fig" viewBox="-20 -6 200 220" aria-hidden="true"${glow}><g stroke="${ink}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">${back}${body}${front}</g>`
            + `<g stroke-linejoin="round">${this._face(L.face)}</g></svg>`;
    },

    // ---- значки вкладок ----

    /** Значок вкладки / запасной значок предмета (белое с чернильной обводкой). */
    _glyphSvg(name, cls) {
        const st = 'fill="#fff" stroke="#1b1530" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"';
        const wrap = (inner) => `<svg class="${cls || ''}" viewBox="0 0 48 48" aria-hidden="true">${inner}</svg>`;
        switch (name) {
            case 'skin': return this._figure(GameData.SKINS[0] ? GameData.SKINS[0].look : {});
            case 'hat': return wrap(`<path d="M7 36H41V41H7Z" ${st}/><path d="M13 36V11H35V36Z" ${st}/><path d="M13 27H35V33H13Z" fill="#ff5d1f" stroke="#1b1530" stroke-width="2.6"/>`);
            case 'sword': return wrap(`<g transform="rotate(45 24 25)"><path d="M24 2L29 9V30H19V9Z" ${st}/><path d="M11 30H37V36H11Z" ${st}/><path d="M21 36H27V44H21Z" ${st}/></g>`);
            case 'trail': return wrap(`<path d="M3 40Q18 4 45 8L41 18Q22 18 3 40Z" ${st}/><path transform="translate(35 32)" d="M0 -6L1.8 -1.8L6 0L1.8 1.8L0 6L-1.8 1.8L-6 0L-1.8 -1.8Z" ${st}/>`);
            case 'paint': return `<span class="sh-ic" style="font-size:28px"><i style="--m:url(${this.SPLATS[0]})"></i></span>`;
            case 'victory': return `<span class="sh-ic" style="font-size:28px"><i style="--m:url(${this.ICON.trophy})"></i></span>`;
            default: return wrap(`<circle cx="24" cy="24" r="16" ${st}/>`);
        }
    },
};
