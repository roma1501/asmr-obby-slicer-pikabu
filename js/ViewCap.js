// ViewCap.js — поле игры на десктопе не шире 2:1: на ультрашироком или очень низком окне по бокам поля,
// а не растянутая полоса (требование Playgama). На телефоне не действует — там игра на весь экран.
// Как: класс vcap на <html> сужает <body> до 2:1 по центру; transform на body делает его опорным
// блоком для position: fixed, поэтому холст, HUD и экран загрузки ужимаются вместе. Код, который
// ставит элементы по координатам окна (clientX, getBoundingClientRect), переводит их в координаты
// поля через ViewCap.x(); ширина поля — ViewCap.width().
/** @satisfies {Record<string, any>} */
const ViewCap = {
    MAX: 2,          // ширина / высота поля, не больше
    on: false,
    left: 0,         // px окна слева от поля
    w: 0,

    apply() {
        const W = window.innerWidth || 1, H = window.innerHeight || 1;
        this.on = !IS_MOBILE && W > H * this.MAX + 2;
        this.w = this.on ? Math.round(H * this.MAX) : W;
        this.left = this.on ? Math.floor((W - this.w) / 2) : 0;
        const de = document.documentElement;
        de.classList.toggle('vcap', this.on);
        de.style.setProperty('--vcap-w', this.w + 'px');
    },

    // Ширина поля игры (px).
    width() { return this.on ? this.w : (window.innerWidth || 1); },

    // X окна (clientX, rect.left) -> X внутри поля.
    x(v) { return this.on ? v - this.left : v; },
};

ViewCap.apply();
window.addEventListener('resize', () => ViewCap.apply());   // раньше обработчиков движка: скрипт идёт вторым
