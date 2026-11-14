import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { buildManifest } from './tools/media-manifest';

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

/**
 * Media orchestration: scans public/media and serves media/manifest.json (dev: fresh on every
 * request, so a dropped-in file shows up after a reload; build: written into dist/media).
 */
function mediaManifest(): Plugin {
  const manifest = () => {
    const m = buildManifest(walk(MEDIA));
    if (m.skipped.length) console.warn(`[media] ignored (check the names, see public/media/README.md): ${m.skipped.join(', ')}`);
    return JSON.stringify(m, null, 2);
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
        res.end(manifest());
      });
    },
    closeBundle() {
      const dir = join(__dirname, outDir, 'media');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'manifest.json'), manifest());
    },
  };
}

// base './' = relative asset paths, required for itch.io's subfolder hosting.
// Phaser in its own file: it never changes, so players' browsers keep it cached when the game updates.
// It is ~1.2 MB on its own (390 kB gzipped), hence the higher size warning limit.
export default defineConfig({
  base: './',
  plugins: [mediaManifest()],
  build: { chunkSizeWarningLimit: 1500, rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } } },
});
