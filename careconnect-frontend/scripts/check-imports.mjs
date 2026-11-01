// Static sanity check (no dependencies): verifies every relative import resolves to a file and that each
// named import exists as an export in the target module. Run with: npm run check
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src');
const exts = ['', '.js', '.jsx', '.mjs', '/index.js', '/index.jsx'];
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : /\.(jsx?|mjs)$/.test(f) && files.push(p); } })(root);

const resolve = (from, spec) => { const base = path.resolve(path.dirname(from), spec); return exts.map((e) => base + e).find((p) => fs.existsSync(p) && fs.statSync(p).isFile()); };
const src = Object.fromEntries(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));

function exportsOf(code) {
  const names = new Set(); let hasDefault = /export\s+default\b/.test(code);
  for (const m of code.matchAll(/export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of code.matchAll(/export\s*\{([^}]*)\}/g)) m[1].split(',').forEach((s) => { const t = s.trim().split(/\s+as\s+/); const n = (t[1] || t[0]).trim(); if (n === 'default') hasDefault = true; else if (n) names.add(n); });
  return { names, hasDefault };
}

// Match ONE import statement at a time: from "import" at line start to the first "from '...'" that
// terminates it, never crossing a ';' — this stops the clause from swallowing subsequent import lines
// when the immediate next import target is a bare package specifier (no leading '.').
const IMPORT_RE = /^import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"]\s*;?/gm;

let problems = 0;
const fail = (f, msg) => { problems += 1; console.log(`✖ ${path.relative(root, f)}: ${msg}`); };
for (const f of files) {
  const code = src[f];
  for (const m of code.matchAll(IMPORT_RE)) {
    const spec = m[2];
    if (!spec.startsWith('.')) continue; // only check local files; packages are trusted
    const target = resolve(f, spec);
    if (!target) { fail(f, `cannot resolve '${spec}'`); continue; }
    if (!/\.jsx?$/.test(target)) continue;
    const ex = exportsOf(src[target] ?? fs.readFileSync(target, 'utf8'));
    const clause = m[1].trim();
    const def = clause.match(/^([A-Za-z0-9_$]+)\s*(?:,|$)/);
    if (def && !clause.startsWith('{') && !clause.startsWith('*') && !ex.hasDefault) fail(f, `'${spec}' has no default export (imported as '${def[1]}')`);
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named) named[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean).forEach((n) => { if (!ex.names.has(n)) fail(f, `'${n}' is not exported by '${spec}'`); });
  }
}
console.log(problems ? `\n${problems} problem(s) found` : `✔ ${files.length} files checked — all relative imports resolve`);
process.exit(problems ? 1 : 0);
