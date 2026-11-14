// Game-wide constants.
export const GAME_ID = 'pixel-game';   // localStorage key prefix (itch.io shares one origin)
export const WIDTH = 320;              // game pixels. 320 x 6 = 1920 and 180 x 6 = 1080: full HD at exact 6x
export const HEIGHT = 180;
export const FRAME = 4;                // thickness of the pixel frame, in game pixels (24 px on full HD)

// The area inside the frame. Gameplay, bounds and HUD text use this, never the raw WIDTH/HEIGHT.
export const PLAY = { x: FRAME, y: FRAME, width: WIDTH - 2 * FRAME, height: HEIGHT - 2 * FRAME };
