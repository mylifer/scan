// EAS derleme kaydını (eas build:list --json çıktısındaki logFiles) indirip okunur biçimde yazdırır.
// Kayıtlar gzip'li JSON satırlarıdır. Her dosyanın son satırları ve hata/uyarı satırları gösterilir;
// derlemenin hata kodu ve mesajı hem başta hem sonda yazılır.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const build = JSON.parse(readFileSync(process.argv[2], 'utf8'))[0] ?? {};
const summary = `Derleme: ${build.id} ${build.status} ${build.error?.errorCode ?? ''} ${build.error?.message ?? ''}`;
console.log(summary);
for (const [i, url] of (build.logFiles ?? []).entries()) {
  let buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  const lines = [];
  for (const l of buf.toString('utf8').split('\n')) {
    try {
      const j = JSON.parse(l);
      lines.push(`[${j.phase ?? ''}] ${j.msg ?? ''}`);
    } catch {
      if (l.trim()) lines.push(l);
    }
  }
  const errors = lines.filter((l) => /\berror\b|❌|Error:|\bfailed\b/i.test(l) && !/^\[(INSTALL_DEPENDENCIES|PREBUILD|RUN_EXPO_DOCTOR)\]/.test(l));
  console.log(`\n===== Kayıt ${i + 1} (${lines.length} satır) — hata satırları =====`);
  console.log(errors.slice(-30).join('\n'));
  console.log(`===== Kayıt ${i + 1} — son 40 satır =====`);
  console.log(lines.slice(-40).join('\n'));
}
console.log(`\n${summary}`);
