import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#020617" />
        <ScrollViewStyleReset />
        <style>{`
          html, body, #root {
            width: 100%;
            min-height: 100%;
            margin: 0;
            padding: 0;
            background-color: #020617 !important;
            color-scheme: dark;
          }
          html, body, #root { height: 100%; }
          #root { display: flex; flex: 1; }
          /* React Navigation Web can render its default light canvas inline. */
          #root [style*="background-color:rgba(242,242,242"] {
            background-color: #020617 !important;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
