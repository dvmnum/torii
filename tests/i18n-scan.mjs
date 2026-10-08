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

// словари остальных языков (js/lang/*.js): у каждой английской строки из EN должен быть перевод.
// Разрешены без перевода: подстановки {…}, единицы и то, что на всех языках одинаково (URL, бренды)
const SAME = new Set(['{time}', '{date}', '{day}', ' m/s', 'm/s']);
let langMissing = 0;
for (const f of fs.readdirSync('plitka/js/lang').filter(f => f.endsWith('.js'))) {
  const code = f.replace('.js', '');
  vm.runInContext(fs.readFileSync('plitka/js/lang/' + f, 'utf8'), Object.assign(ctx, {}));
  const x = ctx.I18N.EXTRA[code];
  const miss = [...new Set(Object.values(EN))].filter(e => !SAME.has(e) && !(e.trim() in x.dict) && !x.patterns.some(([re]) => re.test(e.trim())));
  for (const s of miss) console.log(`${code}: ${JSON.stringify(s)}`);
  console.error(`${code}: без перевода ${miss.length}`);
  langMissing += miss.length;
}
process.exitCode = missing.length || langMissing ? 1 : 0;
