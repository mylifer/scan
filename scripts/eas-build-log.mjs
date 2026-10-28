// EAS derleme kaydını (eas build:list --json çıktısındaki logFiles) indirip okunur biçimde yazdırır.
// Kayıtlar gzip'li JSON satırlarıdır; hata aşamasının çevresi ve son satırlar gösterilir.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const build = JSON.parse(readFileSync(process.argv[2], 'utf8'))[0] ?? {};
console.log('Derleme:', build.id, build.status, build.error?.errorCode ?? '', build.error?.message ?? '');
const lines = [];
for (const url of build.logFiles ?? []) {
  let buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  for (const l of buf.toString('utf8').split('\n')) {
    try {
      const j = JSON.parse(l);
      lines.push(`[${j.phase ?? ''}] ${j.msg ?? ''}`);
    } catch {
      if (l.trim()) lines.push(l);
    }
  }
}
const failed = lines.findIndex((l) => /\berror\b|❌|Error:|failed/i.test(l) && !/^\[(PREBUILD|INSTALL)/.test(l));
const from = Math.max(0, (failed < 0 ? lines.length : failed) - 40);
console.log(lines.slice(from, from + 120).join('\n'));
console.log('----- son 60 satır -----');
console.log(lines.slice(-60).join('\n'));
