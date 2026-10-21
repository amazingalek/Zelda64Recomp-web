# Building Guide

This guide will help you build the project on your local machine. The process will require you to provide a decompressed ROM of the US version of the game.

These steps cover: decompressing the ROM, running the recompiler and finally building the project.

## 1. Clone the Zelda64Recomp Repository
This project makes use of submodules so you will need to clone the repository with the `--recurse-submodules` flag.

```bash
git clone --recurse-submodules
# if you forgot to clone with --recurse-submodules
# cd /path/to/cloned/repo && git submodule update --init --recursive
```

## 2. Install Dependencies

### Linux
For Linux the instructions for Ubuntu are provided, but you can find the equivalent packages for your preferred distro.

```bash
# For Ubuntu, simply run:
sudo apt-get install cmake ninja-build libsdl2-dev libgtk-3-dev lld llvm clang
```

### Windows
You will need to install [Visual Studio 2022](https://visualstudio.microsoft.com/downloads/).
In the setup process you'll need to select the following options and tools for installation:
- Desktop development with C++
- C++ Clang Compiler for Windows
- C++ CMake tools for Windows

The other tool necessary will be `make` which can be installe via [Chocolatey](https://chocolatey.org/):
```bash
choco install make
```

## 3. Decompressing the target ROM
You will need to decompress the NTSC-U N64 Majora's Mask ROM (sha1: d6133ace5afaa0882cf214cf88daba39e266c078) before running the recompiler.

There are a few tools that can do it:
* This python script from the Majora's Mask decompilation project: https://github.com/zeldaret/mm/blob/main/tools/decompress_baserom.py
* https://github.com/z64tools/z64decompress

Regardless of which method you use, copy the decompressed ROM to the root of the Zelda64Recomp repository with this filename:
- `mm.us.rev1.rom_uncompressed.z64`

## 4. Generating the C code

Now that you have the required files, you must build [N64Recomp](https://github.com/Mr-Wiseguy/N64Recomp) and run it to generate the C code to be compiled. The building instructions can be found [here](https://github.com/Mr-Wiseguy/N64Recomp?tab=readme-ov-file#building). That will build the executables: `N64Recomp` and `RSPRecomp` which you should copy to the root of the Zelda64Recomp repository.

After that, go back to the repository root, and run the following commands:
```bash
./N64Recomp us.rev1.toml
./RSPRecomp aspMain.us.rev1.toml
./RSPRecomp njpgdspMain.us.rev1.toml
```

## 5. Building the Project

Finally, you can build the project! :rocket:

On Windows, you can open the repository folder with Visual Studio, and you'll be able to `[build / run / debug]` the project from there.

If you prefer the command line or you're on a Unix platform you can build the project using CMake:

```bash
cmake -S . -B build-cmake -DCMAKE_CXX_COMPILER=clang++ -DCMAKE_C_COMPILER=clang -G Ninja -DCMAKE_BUILD_TYPE=Release # or Debug if you want to debug
cmake --build build-cmake --target Zelda64Recompiled -j$(nproc) --config Release # or Debug
```

## 6. Success

Voilà! You should now have a `Zelda64Recompiled` executable in the build directory! If you used Visual Studio this will be `out/build/x64-[Configuration]` and if you used the provided CMake commands then this will be `build-cmake`. You will need to run the executable out of the root folder of this project or copy the assets folder to the build folder to run it.

> [!IMPORTANT]
> In the game itself, you should be using a standard ROM, not the decompressed one.

## The web page

This fork's `main` branch also builds with [Emscripten](https://emscripten.org) into a page, `Zelda64Recompiled.html`,
that draws through WebGPU. `lib/rt64`, `lib/N64ModernRuntime` and `lib/RecompFrontend` are upstream's own, at the
same commits, and [N64Recomp-browser](https://github.com/amazingalek/N64Recomp-browser) (`lib/N64Recomp-browser`)
patches their checkouts with the web support and makes the game a page. The patches change nothing in the desktop
build. Mods a player installs are off on the page (no live recompiler), but the built-in D-pad one is
recompiled to C at build time and linked in, so the D-pad takes items there as on the desktop. RT64's render to RAM
stays on, as on the desktop: the Pictograph Box reads the photo it took back on the CPU.

The page builds the shaders the game uses before it draws with them, so it never draws with RT64's slow ubershader in
the middle of play: `src/rt64_shaders.txt` lists them in sections (its header says what each one holds), and the build
specializes each one (`RT64_PREBUILT_SHADER_LIST` in `CMakeLists.txt`). In Chrome the whole list is built in the background, those above the first section (the logos, the title
screen, file select) and the attract demo's first on half the host's cores, then the rest one at a time with a region the game has
reached moved to the front, and the game waits only when a frame wants 4 or more of a section's shaders that aren't
built yet, under a small "Preparing graphics" indicator in a corner. Firefox builds a pipeline in line with the rest of
its GPU work, so there those above the first section are built before the game starts, and a region's section when the
game first draws there, the game waiting. `tools/record_shaders.sh` records the list (its header says how, about an hour): N64Recomp-browser's recorder
drives the page in headless Chrome through `tools/shader_plan.json`, and `patches/shader_survey.c` starts a new game
or warps to each area when the plan asks. `tools/play_plan.json` plays the page as a player would, for
N64Recomp-browser's `tools/play_page.mjs`, in 2-3 minutes: the boot, then Termina Field outside Clock Town's south
gate, warped to by the same survey, and Woodfall Temple, about 30 s of Link on foot in each.
`tools/play_plan_extended.json`, for when a longer play is needed, goes on to Great Bay Coast and Goron Village, in at
most 5 minutes (their headers say more).

With steps 1 to 3 done, patch the submodules:

```bash
cmake -P lib/N64Recomp-browser/patches/apply.cmake lib
```

Then step 4, with N64Recomp built from the patched `lib/N64ModernRuntime/N64Recomp` (its `funcs.h` declares every
function the recompiled code calls, its C lets a mod redirect a function at its entry, and its patches call the
runtime's own libultra functions; copy its `OfflineModRecomp` to the root as well, which turns the D-pad mod into C),
the Emscripten SDK installed and activated, and [naga](https://github.com/gfx-rs/wgpu/tree/trunk/naga) installed
(`cargo install naga-cli`):

```bash
embuilder build sdl2-mt freetype-legacysjlj      # once
emcmake cmake -S . -B build-web -G Ninja -DCMAKE_BUILD_TYPE=Release -DRT64_NAGA_EXECUTABLE=<naga> \
    -DPATCHES_C_COMPILER=<clang with a MIPS target> -DPATCHES_LD=<ld.lld>
cmake --build build-web --target Zelda64Recompiled
```

A first build compiles about 930 files and takes half an hour or more, five minutes of it the last step, the link.
Two things make later builds shorter:

- [ccache](https://ccache.dev) on `PATH` when you configure. Every compile then goes through it, so a new build dir
  compiles nothing that was compiled before, and neither does another checkout of this repo with its build dir in the
  same place. Keep the build dir inside the checkout, as `build-web` is: from one outside it, about half the files
  miss the cache. The cache is per user, so it also serves other recomps built on the same web support.
- `-DN64RECOMP_BROWSER_FAST_LINK=ON` when you only want to try something. The last step then takes seconds instead of
  minutes, because it skips Binaryen's optimization of the whole program. Leave it off for a page that people play.

`build-web` then holds `Zelda64Recompiled.html`, `.js`, `.wasm`, `.data` and `coi_serviceworker.js`. The page needs a
browser with WebGPU (Chrome or Edge 113 and up) and must be cross-origin isolated: serve the folder with
`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`, or on a host that can't
set headers, as is, and `coi_serviceworker.js` sets them after one reload. The player picks their ROM in the launcher;
it, the settings and the saves are kept in the browser's IndexedDB for that origin. The list's 961 shaders include
the 54 built before the game starts and Clock Town's 189. Firefox keeps no built pipelines
between visits, so every visit waits for a section as long as the first. A shader the list missed is built behind
the game, and the page remembers it and builds it with the rest on the next visit.

As the pause menu closes in Clock Town, the game calls osDestroyThread on a thread that waits on no queue, so the
runtime's `thread_queue_remove` does nothing for a null queue (N64ModernRuntime-web f0e0884). Without that, reading
the queue is an out-of-bounds access in the wasm, which crashes the page about 35 s into `tools/shader_plan.json`'s
`clock-town` section.

How the page plays, in which browser, on what GPU and on which build, is recorded in N64Recomp-browser's
[plays.jsonl](https://github.com/amazingalek/N64Recomp-browser/blob/main/plays.jsonl) and its
[games table](https://github.com/amazingalek/N64Recomp-browser#games).
