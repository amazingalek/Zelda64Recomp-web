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
// and surveyScene(), the scene the game plays (-1 before the first).
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
  return s ? 'survey at ' + s.toString(16) : 'no survey struct: a page built without patches/shader_survey.c';
})()
