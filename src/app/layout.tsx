import type { Metadata } from "next";
import "./globals.css";

// As fontes reais da marca (Fraunces, Source Sans 3, IBM Plex Mono, via
// next/font/google — README do design system) entram quando os tokens e
// componentes forem portados para cá. Este layout, por ora, é só o esqueleto
// de infraestrutura.

export const metadata: Metadata = {
  title: "Plataforma Ferrari",
  description: "Ferrari Consultoria — RH Estratégico & DP Operacional",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
