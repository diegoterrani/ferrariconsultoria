import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";

/**
 * Fontes da identidade visual (fase f3_escopo_mvp, identidade_visual.html):
 * Fraunces (serifa — wordmark e títulos), Source Sans 3 (corpo/UI) e IBM
 * Plex Mono (dados/técnico).
 *
 * `next/font/local`, não `next/font/google`: os arquivos `.woff2` abaixo
 * (`src/app/fonts/`, ~184KB no total) foram extraídos uma única vez dos
 * pacotes oficiais `@fontsource/*` (mesmas fontes, mesmo Google Fonts/Adobe/
 * IBM, licença SIL Open Font License) e ficam versionados no repositório —
 * nenhuma dependência de rede em tempo de build. Isso importa aqui porque
 * `next/font/google` baixa os arquivos de fonte do Google *durante* `next
 * build`; testado neste sandbox de desenvolvimento, essa chamada é
 * bloqueada pelo proxy de rede do ambiente (mesma categoria de restrição já
 * documentada no README para os binários do Prisma) — e ainda que o build
 * real no Vercel tenha rede irrestrita e provavelmente funcionasse,
 * `next/font/local` elimina essa dependência de rede por completo, em vez
 * de só confiar que o ambiente de build de produção vai ter acesso a
 * fonts.googleapis.com no momento certo. Resultado prático é idêntico ao
 * de `next/font/google` (self-hosted, sem requisição a terceiro em
 * runtime, `--font-*` como variável CSS) — só a fonte dos arquivos no
 * momento do build é que muda, e a nova é mais robusta.
 *
 * `display: "swap"` evita texto invisível enquanto a fonte carrega (troca
 * pra fonte de sistema até a real chegar).
 */
const fraunces = localFont({
  src: [
    { path: "./fonts/fraunces-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/fraunces-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/fraunces-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/fraunces-500-italic.woff2", weight: "500", style: "italic" },
  ],
  variable: "--font-fraunces",
  display: "swap",
});

const sourceSans = localFont({
  src: [
    { path: "./fonts/source-sans-3-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/source-sans-3-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/source-sans-3-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/source-sans-3-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-source-sans",
  display: "swap",
});

const plexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Plataforma Ferrari",
  description: "Ferrari Consultoria — RH Estratégico & DP Operacional",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`h-full antialiased ${fraunces.variable} ${sourceSans.variable} ${plexMono.variable}`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
