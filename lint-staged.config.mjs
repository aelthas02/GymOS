export default {
  '*.{ts,mts,cts,js,mjs,cjs}': ['eslint --fix --no-warn-ignored', 'prettier --write'],
  '*.{json,md,yml,yaml,css,html}': 'prettier --write',
};
