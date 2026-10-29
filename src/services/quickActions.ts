import * as QuickActions from 'expo-quick-actions';
import { type Href, router } from 'expo-router';

/**
 * Ana ekranda uygulama simgesine basılı tutunca çıkan kısayollar (iPhone). Yerel modül yoksa
 * (Expo Go, eski TestFlight derlemesi, web) paket sessizce hiçbir şey yapmaz.
 */
const ITEMS: QuickActions.Action[] = [
  { id: 'scan', title: 'Fiş Tara', icon: 'symbol:camera.fill', params: { href: '/camera' } },
  { id: 'qr', title: 'Fatura Karekodu Okut', icon: 'symbol:qrcode.viewfinder', params: { href: '/manual?qr=1' } },
  { id: 'manual', title: 'Elle / PDF Fatura Ekle', icon: 'symbol:doc.richtext', params: { href: '/manual' } },
  { id: 'batch', title: 'Toplu Tarama', icon: 'symbol:square.stack.3d.up', params: { href: '/batch' } },
];

let initialHandled = false;

function open(action: QuickActions.Action | null | undefined) {
  const href = action?.params?.href;
  if (typeof href === 'string' && href.startsWith('/')) router.push(href as Href);
}

/** Kısayolları kurar ve dokunulunca ilgili ekranı açar (giriş yapılmışken). @returns temizleyici */
export function setupQuickActions(): () => void {
  QuickActions.setItems(ITEMS).catch(() => {});
  // Uygulama bir kısayolla açıldıysa (soğuk açılış) bir kez o ekrana git
  if (!initialHandled) {
    initialHandled = true;
    open(QuickActions.initial);
  }
  const sub = QuickActions.addListener(open);
  return () => sub.remove();
}
