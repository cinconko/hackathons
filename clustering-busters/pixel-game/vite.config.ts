import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { buildManifest, type MediaManifest } from './tools/media-manifest';

const MEDIA = join(__dirname, 'public', 'media');

function walk(dir: string): string[] {
  let out: string[] = [];
  let names: string[] = [];
  try { names = readdirSync(dir); } catch { return out; }
  for (const n of names) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else out.push(relative(MEDIA, p).split(sep).join('/'));
  }
  return out;
}

const fingerprint = (file: string) => createHash('sha1').update(readFileSync(join(MEDIA, file))).digest('hex').slice(0, 8);

function mediaManifest(): Plugin {
  const manifest = (): MediaManifest => {
    const m = buildManifest(walk(MEDIA), fingerprint);
    if (m.skipped.length) console.warn(`[media] ignored (check the names, see public/media/README.md): ${m.skipped.join(', ')}`);
    return m;
  };
  let outDir = 'dist';
  return {
    name: 'media-manifest',
    configResolved(c) { outDir = c.build.outDir; },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.split('?')[0].endsWith('/media/manifest.json')) return next();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(manifest()));
      });
    },
    transformIndexHtml(html) {
      const m = manifest();
      const json = JSON.stringify(m).replace(/</g, '\\u003c');
      const warm = `window.__MEDIA__=${json};window.__MEDIA_IMG__=Object.values(__MEDIA__.sprites).concat(Object.values(__MEDIA__.sheets).map(function(s){return s.url})).map(function(u){var i=new Image();i.crossOrigin='anonymous';i.src=u;return i})`;
      for (const [name, url] of Object.entries(m.fonts)) html = html.split(`'./media/fonts/${name}.ttf'`).join(`'./${url}'`);
      return html.replace('<head>', `<head>\n  <script>${warm}</script>`);
    },
    closeBundle() {
      const dir = resolve(__dirname, outDir, 'media');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest()));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [mediaManifest()],
  resolve: { alias: [{ find: /^phaser$/, replacement: 'phaser/dist/phaser-arcade-physics.min.js' }] },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: { game: join(__dirname, 'index.html') },
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});
