#include "patches.h"
#include "play_patches.h"

// The shader survey: lets a script start a new game or reach any area by itself, to record the shaders each one
// draws for the web page's prebuilt list (src/rt64_shaders.txt, made by tools/record_shaders.sh) without anyone
// playing. It does nothing unless the script asks.
//
// The script finds this struct in RDRAM by its two magic words, writes what it wants into the fields after `request`
// and then a request into `request`; `loaded` counts the requests taken, so it knows one was. Once a frame, in every
// game state (the title screen, file select and play), Graph_UpdateGame calls shader_survey_update, which takes a
// request between frames as the game's own map select does (MapSelect_LoadGame): it ends the current game state and
// starts play at `entrance`.
//
//   SURVEY_WARP      the debug save (Sram_InitDebugSave: every item and mask, the Kokiri sword), in `form`, on
//                    `day` at `time` (CLOCK_TIME units), at `entrance` (scene_table.cpp's index << 8 | spawn << 4)
//   SURVEY_NEW_GAME  a new file's save, at the intro (ENTRANCE(CUTSCENE, 0)), as file select starts one
//   SURVEY_REWARP    the save as it is, in `form` (-1 keeps it), at `entrance`, without a cutscene
//
// The save is file 1's, so an autosave writes there. Play_Main writes the scene it plays into `scene`.

void Play_Init_NORELOCATE(GameState*);

enum {
    SURVEY_NONE = -1,
    SURVEY_WARP = 0,
    SURVEY_NEW_GAME = 1,
    SURVEY_REWARP = 2,
};

struct ShaderSurvey {
    u32 magic[2];
    volatile u32 loaded;
    volatile s32 request;
    volatile s32 entrance;
    volatile s32 form;
    volatile s32 day;
    volatile s32 time;
    volatile s32 scene;
};

struct ShaderSurvey shader_survey = {
    { 0x53484452, 0x53525659 }, 0, SURVEY_NONE, 0, PLAYER_FORM_HUMAN, 1, CLOCK_TIME(8, 0), -1 }; // "SHDR" "SRVY"

static void survey_start_play(GameState* gameState) {
    s32 i;

    gSaveContext.fileNum = 0;
    gSaveContext.gameMode = GAMEMODE_NORMAL;

    gSaveContext.buttonStatus[EQUIP_SLOT_B] = BTN_ENABLED;
    gSaveContext.buttonStatus[EQUIP_SLOT_C_LEFT] = BTN_ENABLED;
    gSaveContext.buttonStatus[EQUIP_SLOT_C_DOWN] = BTN_ENABLED;
    gSaveContext.buttonStatus[EQUIP_SLOT_C_RIGHT] = BTN_ENABLED;
    gSaveContext.buttonStatus[EQUIP_SLOT_A] = BTN_ENABLED;
    gSaveContext.hudVisibilityForceButtonAlphasByStatus = false;
    gSaveContext.nextHudVisibility = HUD_VISIBILITY_IDLE;
    gSaveContext.hudVisibility = HUD_VISIBILITY_IDLE;
    gSaveContext.hudVisibilityTimer = 0;
    gSaveContext.prevHudVisibility = HUD_VISIBILITY_ALL;

    gSaveContext.respawnFlag = 0;
    gSaveContext.respawn[RESPAWN_MODE_DOWN].entrance = 0xFFFF;
    gSaveContext.respawn[RESPAWN_MODE_GORON].entrance = 0xFF;
    gSaveContext.respawn[RESPAWN_MODE_ZORA].entrance = 0xFF;
    gSaveContext.respawn[RESPAWN_MODE_DEKU].entrance = 0xFF;
    gSaveContext.respawn[RESPAWN_MODE_HUMAN].entrance = 0xFF;
    gSaveContext.seqId = (u8)NA_BGM_DISABLED;
    gSaveContext.ambienceId = AMBIENCE_ID_DISABLED;
    gSaveContext.showTitleCard = true;
    gSaveContext.dogParams = 0;
    for (i = 0; i < TIMER_ID_MAX; i++) {
        gSaveContext.timerStates[i] = TIMER_STATE_OFF;
    }
    gSaveContext.nayrusLoveTimer = 0;
    gSaveContext.healthAccumulator = 0;
    gSaveContext.magicFlag = 0;
    gSaveContext.forcedSeqId = 0;
    gSaveContext.nextTransitionType = TRANS_NEXT_TYPE_DEFAULT;
    gSaveContext.cutsceneTrigger = 0;
    gSaveContext.chamberCutsceneNum = 0;
    gSaveContext.nextDayTime = NEXT_TIME_NONE;
    gSaveContext.retainWeatherMode = false;
    gWeatherMode = WEATHER_MODE_CLEAR;

    STOP_GAMESTATE(gameState);
    SET_NEXT_GAMESTATE(gameState, Play_Init_NORELOCATE, sizeof(PlayState));
}

void shader_survey_update(GameState* gameState) {
    s32 request = shader_survey.request;

    if (request == SURVEY_NONE) {
        return;
    }
    shader_survey.request = SURVEY_NONE;

    if (request == SURVEY_NEW_GAME) {
        Sram_InitNewSave();
        gSaveContext.save.entrance = ENTRANCE(CUTSCENE, 0);
        gSaveContext.save.cutsceneIndex = 0;
        gSaveContext.nextCutsceneIndex = 0;
        gSaveContext.save.playerForm = PLAYER_FORM_HUMAN;
        gSaveContext.save.saveInfo.playerData.tatlTimer = 0;
    } else {
        if (shader_survey.form >= 0) {
            gSaveContext.save.playerForm = shader_survey.form;
        }
        if (request == SURVEY_WARP) {
            Sram_InitDebugSave();
        }
        gSaveContext.save.equippedMask = PLAYER_MASK_NONE;
        if (shader_survey.day >= 0) {
            gSaveContext.save.day = shader_survey.day;
            gSaveContext.save.eventDayCount = shader_survey.day;
        }
        if (shader_survey.time >= 0) {
            gSaveContext.save.time = shader_survey.time;
            gSaveContext.skyboxTime = shader_survey.time;
        }
        gSaveContext.save.timeSpeedOffset = 0;
        gSaveContext.save.entrance = shader_survey.entrance;
        gSaveContext.save.cutsceneIndex = 0;
        gSaveContext.nextCutsceneIndex = 0xFFEF;
    }

    survey_start_play(gameState);
    shader_survey.loaded++;
}

void shader_survey_play_update(PlayState* play) {
    shader_survey.scene = play->sceneId;
}
