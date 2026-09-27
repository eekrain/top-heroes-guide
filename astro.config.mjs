// @ts-check
import { defineConfig } from 'astro/config';

import solidJs from '@astrojs/solid-js';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import pagefind from 'astro-pagefind';

// https://astro.build/config
export default defineConfig({
	integrations: [solidJs(), mdx(), pagefind()],
	vite: {
		plugins: [tailwindcss()],
	},
});
