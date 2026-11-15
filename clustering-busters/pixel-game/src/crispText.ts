import Phaser from 'phaser';
import { snapAlpha } from './snap';

export function installCrispText(): void {
  const proto = Phaser.GameObjects.Text.prototype as unknown as { updateText: () => Phaser.GameObjects.Text; __crisp?: boolean };
  if (proto.__crisp) return;
  proto.__crisp = true;
  const draw = proto.updateText;
  proto.updateText = function (this: Phaser.GameObjects.Text) {
    const result = draw.call(this);
    const { canvas, context } = this;
    if (!canvas.width || !canvas.height) return result;
    const img = context.getImageData(0, 0, canvas.width, canvas.height);
    snapAlpha(img.data);
    context.putImageData(img, 0, 0);
    const renderer = this.renderer as Phaser.Renderer.WebGL.WebGLRenderer | null;
    if (renderer && 'gl' in renderer && renderer.gl) {
      this.frame.source.glTexture = renderer.canvasToTexture(canvas, this.frame.source.glTexture ?? undefined, true);
    }
    return result;
  };
}
