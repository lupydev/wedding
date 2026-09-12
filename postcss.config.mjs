/**
 * Tailwind CSS v4 is a PostCSS plugin, and this file is the whole
 * configuration: v4 has no `tailwind.config.js`, no `content` globs to keep in
 * sync, and no `autoprefixer` entry. Theme tokens live in `app/globals.css`
 * under `@theme inline`.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
