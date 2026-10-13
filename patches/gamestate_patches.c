#include "patches.h"
#include "ui_funcs.h"

void shader_survey_update(GameState* gameState);

// @recomp Patched to run UI callbacks, and the shader survey's requests (shader_survey.c).
RECOMP_PATCH void Graph_UpdateGame(GameState* gameState) {
    recomp_run_ui_callbacks();
    shader_survey_update(gameState);

    GameState_GetInput(gameState);
    GameState_IncrementFrameCount(gameState);
    if (SREG(20) < 3) {
        Audio_Update();
    }
}

