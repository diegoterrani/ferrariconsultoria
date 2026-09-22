import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pdfkit` (módulo C1... na verdade B1, geração de PDF do resultado —
  // ver src/lib/relatorio/relatorio-pdf.ts) e sua dependência `fontkit`
  // usam um padrão de decorator/export que o bundling automático do
  // Turbopack para Route Handlers não resolve (`Export
  // applyDecoratedDescriptor doesn't exist in target module` vindo de
  // node_modules/fontkit/dist/module.mjs, build real confirmado no
  // Vercel). `serverExternalPackages` é a opção oficial e estável do
  // Next (desde 15.0.0, ver node_modules/next/dist/docs/.../serverExternalPackages.md)
  // pra exatamente este caso: pacotes com uso pesado de Node.js nativo
  // ficam de fora do bundling e são resolvidos via `require` nativo em
  // runtime — não é um workaround frágil, é o mecanismo documentado.
  serverExternalPackages: ["pdfkit", "fontkit"],
};

export default nextConfig;
