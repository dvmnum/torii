import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Сборка под магазины: npm run build → dist/torii-<версия>-chrome.zip и dist/torii-<версия>-firefox.zip
// Код один (папка plitka/), отличается только manifest.json:
//   chrome  — Chrome Web Store, Edge Add-ons; оттуда же ставят Яндекс, Opera, Brave, Vivaldi;
//   firefox — addons.mozilla.org: свой id расширения, минимальная версия и пометка «данные не собираем».
const SRC = path.resolve('plitka');
const OUT = path.resolve('dist');
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));

const TARGETS = {
  chrome: (m) => m,
  firefox: (m) => ({
    ...m,
    browser_specific_settings: {
      gecko: {
        id: 'torii@torii.newtab',
        // 140 — с неё Firefox понимает data_collection_permissions; вёрстке (:has(), container queries, color-mix, @property) хватает и 128
        strict_min_version: '140.0',
        data_collection_permissions: { required: ['none'] }, // никакой аналитики (требование AMO для новых расширений)
      },
      gecko_android: { strict_min_version: '142.0' }, // на Android эту пометку понимают с 142 (новую вкладку там и так не подменить)
    },
  }),
};

// все файлы расширения (без служебного мусора)
function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.name.startsWith('.') || e.name === 'Thumbs.db') return [];
    return e.isDirectory() ? walk(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  });
}

// Минимальный zip (deflate, без шифрования и zip64) — магазинам больше не нужно
function zip(files) {
  const local = [], central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const packed = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = packed.length < data.length;
    const body = useDeflate ? packed : data;
    const crc = zlib.crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); // utf-8 имена
    head.writeUInt16LE(useDeflate ? 8 : 0, 8); head.writeUInt32LE(0, 10);
    head.writeUInt32LE(crc, 14); head.writeUInt32LE(body.length, 18); head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(nameBuf.length, 26); head.writeUInt16LE(0, 28);
    local.push(head, nameBuf, body);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(useDeflate ? 8 : 0, 10); cen.writeUInt32LE(0, 12);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(body.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += head.length + nameBuf.length + body.length;
  }
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cenBuf, end]);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const names = walk(SRC);
for (const [target, patch] of Object.entries(TARGETS)) {
  const dir = path.join(OUT, target);
  const files = names.map((name) => ({
    name,
    data: name === 'manifest.json' ? Buffer.from(JSON.stringify(patch(manifest), null, 2) + '\n') : fs.readFileSync(path.join(SRC, name)),
  }));
  // распакованная копия — чтобы загрузить в браузер для проверки (Firefox: about:debugging → «Загрузить временное дополнение»)
  for (const f of files) { fs.mkdirSync(path.dirname(path.join(dir, f.name)), { recursive: true }); fs.writeFileSync(path.join(dir, f.name), f.data); }
  const file = path.join(OUT, `torii-${manifest.version}-${target}.zip`);
  fs.writeFileSync(file, zip(files));
  console.log(`${target.padEnd(8)} ${path.relative(process.cwd(), file)} — ${files.length} файлов, ${(fs.statSync(file).size / 1024).toFixed(0)} КБ`);
}
