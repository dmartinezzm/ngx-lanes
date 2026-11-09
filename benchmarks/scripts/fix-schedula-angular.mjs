// schedula-core-angular 1.4.0 is published without "module"/"typings" fields: its build output
// lives in dist/ but package.json does not point to it, so Angular cannot import it.
// This adds the missing entry points so the benchmark can measure the official wrapper.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const dir = 'node_modules/schedula-core-angular';
const pkgPath = `${dir}/package.json`;
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const fesm = readdirSync(`${dir}/dist/fesm2022`).find((f) => f.endsWith('.mjs'));
pkg.module = `dist/fesm2022/${fesm}`;
pkg.typings = 'dist/index.d.ts';
pkg.exports = { '.': { types: './dist/index.d.ts', default: `./dist/fesm2022/${fesm}` }, './package.json': './package.json' };
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log(`schedula-core-angular entry points fixed → ${pkg.module}`);
