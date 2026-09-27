// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'astro/config';

import solidJs from '@astrojs/solid-js';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

const pagefindDir = path.resolve('dist/pagefind');

const MIME = {
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.wasm': 'application/wasm',
	'.json': 'application/json',
};

/**
 * Serves the pagefind output from `dist/` during `astro dev`, so search works
 * in the dev server once `bun run build` has produced an index.
 */
function servePagefindInDev() {
	return {
		name: 'serve-pagefind-in-dev',
		configureServer(server) {
			server.middlewares.use('/pagefind', (req, res, next) => {
				const rel = decodeURIComponent(String(req.url ?? '').split('?')[0]).replace(/^\/+/, '');
				const file = path.join(pagefindDir, rel);
				if (
					!file.startsWith(pagefindDir + path.sep) ||
					!fs.existsSync(file) ||
					!fs.statSync(file).isFile()
				) {
					next();
					return;
				}
				res.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream');
				fs.createReadStream(file).pipe(res);
			});
		},
	};
}

// https://astro.build/config
export default defineConfig({
	integrations: [solidJs(), mdx()],
	vite: {
		plugins: [tailwindcss(), servePagefindInDev()],
	},
});
