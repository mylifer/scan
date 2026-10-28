// GitHub secret'ına yapıştırılan .p8 anahtarını geçerli PEM dosyasına çevirir.
// Kabul edilenler: dosyanın tamamı, BEGIN/END satırları olmadan yalnızca gövde, "\n" kaçışlı tek satır,
// tırnak içinde ya da Windows satır sonlu metin. Anahtarın kendisi hiçbir zaman yazdırılmaz.
// Kullanım: ASC_API_KEY_P8=... node scripts/asc-key.mjs <çıktı-yolu>
import { createPrivateKey } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const raw = (process.env.ASC_API_KEY_P8 ?? '').replace(/\\n/g, '\n').replace(/\r/g, '').trim().replace(/^["']|["']$/g, '');
const body = raw
  .replace(/-----(BEGIN|END)[A-Z ]*-----/g, '')
  .replace(/[^A-Za-z0-9+/=]/g, '');
if (!body) throw new Error('ASC_API_KEY_P8 boş');
const pem = `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;
try {
  createPrivateKey(pem);
} catch {
  throw new Error(
    `ASC_API_KEY_P8 geçerli bir App Store Connect anahtarı değil (${body.length} karakter; beklenen ~200). ` +
      '.p8 dosyasının tamamını metin düzenleyiciyle açıp kopyalayın.',
  );
}
writeFileSync(process.argv[2], pem, { mode: 0o600 });
console.log('App Store Connect anahtarı hazır');
