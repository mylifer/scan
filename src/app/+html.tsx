import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/** Web sürümünün HTML iskeleti: iPhone'da "Ana Ekrana Ekle" ile uygulama gibi açılması için. */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Fiş Tarayıcı" />
        <meta name="theme-color" content="#F2F2F7" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
        <link rel="apple-touch-icon" href="/scan/apple-touch-icon.png" />
        <link rel="manifest" href="/scan/manifest.json" />
        <title>Fiş Tarayıcı</title>
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html:
              'body{background-color:#F2F2F7;-webkit-tap-highlight-color:transparent}' +
              '@media (prefers-color-scheme: dark){body{background-color:#000}}' +
              '*{scrollbar-width:none}*::-webkit-scrollbar{display:none}',
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
