// Evaluated in the page by N64Recomp-browser's tools/record_shaders.mjs (tools/shader_plan.json): finds the shader
// survey struct of patches/shader_survey.c in RDRAM by its magic words and offers, each resolving once the game has
// taken the request:
//
//   surveyWarp(entrance, form, day, hour)  the debug save (every item and mask) in that form (0 Fierce Deity, 1 Goron,
//                                          2 Zora, 3 Deku, 4 human), on that day (1-3) at that hour, at that entrance
//                                          (scene_table.cpp's index << 8 | spawn << 4)
//   surveyRewarp(entrance, form)           the save as it is, in that form (-1 keeps it), at that entrance
//   surveyNewGame()                        a new file's save at the intro, as file select starts one
//
// and surveyScene(), the scene the game plays (-1 before the first). For what only playing draws (an item or mask in
// use, a boss's fight, Deku Link's bubble, a minigame), with the keyboard's buttons (WASD the stick, Space A, Shift B,
// Q Z, R R, the arrows the C buttons) and the save in gSaveContext (0x801EF670 in the US build, the decompilation's
// variables.txt):
//
//   surveyEquip(cl, cd, cr)                puts items (z64item.h's ids) on human Link's C buttons
//   surveyMoney(n)                         sets the rupees
//   surveySkip(n)                          presses A n times, 600 ms apart (a boss's intro, a minigame's talk)
//   surveyFight(ms, kind)                  for ms, sways forward and back about where Link is, turning, targeting,
//                                          swinging B and shielding, his health filled each time, and uses the C
//                                          buttons: kind 'aim' holds each and lets go (bow, hookshot, bombs thrown),
//                                          'tap' presses each twice (masks, the Pictograph Box), 'none' never
//   surveyBubble(ms)                       for ms, Deku Link's bubble, B held and let go, while swaying
(() => {
  if (!window.__survey) {
    for (let a = 0x80801000; a < 0x81000000; a += 4) {
      if (n64r(a) === 0x53484452 && n64r(a + 4) === 0x53525659) { window.__survey = a; break; }
    }
  }
  const s = window.__survey;
  const request = async (kind, entrance = 0, form = -1, day = -1, time = -1) => {
    const before = n64r(s + 8);
    n64w(s + 16, entrance);
    n64w(s + 20, form);
    n64w(s + 24, day);
    n64w(s + 28, time);
    n64w(s + 12, kind);
    for (let i = 0; i < 200 && n64r(s + 8) === before; i++) await new Promise((resolve) => setTimeout(resolve, 50));
    return n64r(s + 8) !== before;
  };
  // CLOCK_TIME(hour, 0) in the game's units, a day being 0x10000.
  const clock = (hour) => Math.floor((hour * 60) * 0x10000 / (24 * 60)) & 0xFFFF;
  window.surveyWarp = (entrance, form = 4, day = 1, hour = 8) => request(0, entrance, form, day, clock(hour));
  window.surveyRewarp = (entrance, form = -1) => request(2, entrance, form);
  window.surveyNewGame = () => request(1);
  window.surveyScene = () => n64r(s + 32) | 0;

  const keys = {
    A: ['Space', ' ', 32], B: ['ShiftLeft', 'Shift', 16], Z: ['KeyQ', 'q', 81], R: ['KeyR', 'r', 82],
    W: ['KeyW', 'w', 87], S: ['KeyS', 's', 83], LT: ['KeyA', 'a', 65], RT: ['KeyD', 'd', 68],
    CL: ['ArrowLeft', 'ArrowLeft', 37], CD: ['ArrowDown', 'ArrowDown', 40], CR: ['ArrowRight', 'ArrowRight', 39],
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const send = (type, [code, key, keyCode]) =>
    window.dispatchEvent(new KeyboardEvent(type, { code, key, keyCode, which: keyCode, bubbles: true }));
  const hold = async (name, ms = 150) => { send('keydown', keys[name]); await sleep(ms); send('keyup', keys[name]); };
  // The debug save leaves its "ZELDA3" unset, so gSaveContext is taken at its address rather than looked for (the
  // first "ZELDA3" in RDRAM is another copy).
  const save = 0x801EF670;
  const heal = () => n64w(save + 0x34, (0x140 << 16) | 0x140); // healthCapacity, health
  window.surveyEquip = (cl, cd, cr) => {
    const a = save + 0x4C; // human Link's buttonItems: B, C-left, C-down, C-right
    n64w(a, (n64r(a) & 0xFF000000) | (cl << 16) | (cd << 8) | cr);
    return 'equipped ' + n64r(a).toString(16);
  };
  window.surveyMoney = (n) => {
    const a = save + 0x38; // magicLevel, magic, rupees
    n64w(a, (n64r(a) & 0xFFFF0000) | n);
    return 'rupees ' + (n64r(a) & 0xFFFF);
  };
  window.surveySkip = async (n) => { for (let i = 0; i < n; i++) { await hold('A'); await sleep(600); } return 'skipped'; };
  window.surveyFight = async (ms, kind = 'aim') => {
    const cs = ['CL', 'CD', 'CR'];
    for (let t = 0, i = 0; t < ms; i++) {
      const start = performance.now();
      heal();
      await hold('Z', 150);
      await hold('W', 900);
      await hold('B', 150); await sleep(250); await hold('B', 150); await sleep(250);
      await hold(i % 2 ? 'LT' : 'RT', 400);
      await hold('S', 900);
      if (kind === 'aim') { await hold(cs[i % 3], 1400); await sleep(700); }
      else if (kind === 'tap') { await hold(cs[i % 3]); await sleep(1200); await hold(cs[i % 3]); await sleep(900); }
      await hold('R', 500);
      await hold('A', 150); await sleep(300);
      t += performance.now() - start;
    }
    return 'fought';
  };
  window.surveyBubble = async (ms) => {
    for (let t = 0, i = 0; t < ms; i++) {
      const start = performance.now();
      await hold('W', 700);
      await hold('B', 1500); await sleep(800);
      await hold(i % 2 ? 'LT' : 'RT', 400);
      await hold('S', 700);
      await hold('A', 150); await sleep(600);
      t += performance.now() - start;
    }
    return 'bubbled';
  };
  return s ? 'survey at ' + s.toString(16) : 'no survey struct: a page built without patches/shader_survey.c';
})()
