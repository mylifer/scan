// App Store Connect API ile paket kimliğinden (bundleIdentifier) uygulamanın Apple Kimliğini (ascAppId) bulur.
// CI'da EAS'in TestFlight'a gönderebilmesi için kullanılır; eas.json'a elle numara yazmaya gerek kalmaz.
// Gerekli ortam değişkenleri: EXPO_ASC_API_KEY_PATH, EXPO_ASC_KEY_ID, EXPO_ASC_ISSUER_ID
import { sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const { EXPO_ASC_API_KEY_PATH: keyPath, EXPO_ASC_KEY_ID: kid, EXPO_ASC_ISSUER_ID: iss } = process.env;
if (!keyPath || !kid || !iss) throw new Error('App Store Connect anahtarı tanımlı değil');

const bundleId = JSON.parse(readFileSync('app.json', 'utf8')).expo.ios.bundleIdentifier;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const data = `${b64({ alg: 'ES256', kid, typ: 'JWT' })}.${b64({ iss, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' })}`;
const sig = sign('sha256', Buffer.from(data), { key: readFileSync(keyPath, 'utf8'), dsaEncoding: 'ieee-p1363' }).toString('base64url');

const res = await fetch(`https://api.appstoreconnect.apple.com/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}`, {
  headers: { Authorization: `Bearer ${data}.${sig}` },
});
if (!res.ok) throw new Error(`App Store Connect API ${res.status}: ${await res.text()}`);
const app = (await res.json()).data?.find((a) => a.attributes?.bundleId === bundleId);
if (!app) throw new Error(`App Store Connect'te ${bundleId} paket kimlikli uygulama bulunamadı`);
console.log(app.id);
