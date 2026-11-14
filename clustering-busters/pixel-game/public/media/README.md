# Media

Art and sound for Ringfall. Everything in `public/` is copied into the build as is, so a file
here is loaded by its path relative to the page, without `public/`:

| Folder | What goes here | Load it in a scene's `preload()` |
|---|---|---|
| `sprites/` | PNG sprites and sprite sheets (Aseprite exports) | `this.load.spritesheet('boss', 'media/sprites/boss.png', { frameWidth: 24, frameHeight: 24 })` |
| `audio/` | sound effects and music (`.ogg` + `.mp3` for Safari) | `this.load.audio('hit', ['media/audio/hit.ogg', 'media/audio/hit.mp3'])` |

Rules:

- Draw at the game's real size (the grid is 320x180). Do not pre-scale: the game scales by whole steps itself.
- Lowercase file names with dashes, e.g. `fisherman-idle.png`.
- Until a file exists here, `src/scenes/boot.ts` draws a placeholder in code with the same texture key,
  so replacing a placeholder means loading the file under that key and deleting its `tex(...)` call.
