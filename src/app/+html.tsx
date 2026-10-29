import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Web sürümünün HTML iskeleti: iPhone'da "Ana Ekrana Ekle" ile uygulama gibi açılması için.
 * SDK 58'den beri uygulamanın JS dosyaları ve stilleri headNodes/bodyNodes ile gelir; bunlar
 * yazılmazsa sayfa yalnızca yükleniyor dairesinde kalır.
 */
export default function Root({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();
  return (
    <html lang="tr" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Fiş Tarayıcı" />
        <meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
        <link rel="apple-touch-icon" href="/scan/apple-touch-icon.png" />
        <link rel="manifest" href="/scan/manifest.json" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <title>Fiş Tarayıcı</title>
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html:
              'html,body{background-color:#fafafa;-webkit-tap-highlight-color:transparent;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;font-feature-settings:"cv02","cv03","cv04","cv11"}' +
              '@media (prefers-color-scheme: dark){html,body{background-color:#09090b;color:#fafafa}}' +
              '::selection{background-color:rgba(120,120,128,0.25)}' +
              '@media (min-width: 1024px){' +
              '::-webkit-scrollbar{width:8px;height:8px}' +
              '::-webkit-scrollbar-track{background:transparent}' +
              '::-webkit-scrollbar-thumb{background:rgba(120,120,128,0.25);border-radius:4px}' +
              '::-webkit-scrollbar-thumb:hover{background:rgba(120,120,128,0.4)}' +
              '}',
          }}
        />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
