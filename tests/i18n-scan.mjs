// Ищет русские строки в коде интерфейса, которых нет в английском словаре (plitka/js/i18n.js).
// Запуск: node tests/i18n-scan.mjs  — печатает недостающие; с --all печатает все найденные.
import fs from 'node:fs';
import vm from 'node:vm';

const files = ['app.js', 'widgets.js', 'widgets-more.js', 'mesh.js'].map(f => 'plitka/js/' + f);
const found = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
    .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')   // без строк-комментариев
    .replace(/\/\*[\s\S]*?\*\//g, '');
  // строки в кавычках с кириллицей (шаблоны с ${} — отдельно, их покрывают PATTERNS)
  // только строки в одинарных кавычках; шаблоны `…${}…` с кириллицей покрывают PATTERNS (проверяются глазами по скринам)
  for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*[А-Яа-яЁё](?:[^'\\\n]|\\.)*)'/g)) {
    const s = m[1].replace(/\\n/g, '\n').replace(/\\'/g, "'");
    if (s.includes('// ')) continue;
    found.add(s);
  }
}
const ctx = { window: {}, document: undefined, navigator: { language: 'en' } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('plitka/js/i18n.js', 'utf8') + ';this.I18N = I18N;', ctx);
const { EN, PATTERNS } = ctx.I18N;
const all = [...found].sort();
const missing = all.filter(s => !(s in EN) && !PATTERNS.some(([re]) => re.test(s)) && !ctx.I18N.SKIP.some(re => re.test(s)));
for (const s of process.argv.includes('--all') ? all : missing) console.log(JSON.stringify(s));
console.error(`всего: ${all.length}, без перевода: ${missing.length}`);
process.exitCode = missing.length ? 1 : 0;
