"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/carteira", rotulo: "Clientes" },
  { href: "/carteira/capacidade", rotulo: "Capacidade" },
  { href: "/carteira/pipeline", rotulo: "Pipeline" },
  { href: "/carteira/faturamento", rotulo: "Faturamento" },
] as const;

/**
 * Barra de abas persistente do módulo Carteira — mesmo estilo já usado nas
 * abas de /carteira/[id] (borda inferior vinho-noite na ativa), reaproveitado
 * aqui em vez de inventar um terceiro padrão visual de navegação dentro do
 * mesmo módulo.
 *
 * Antes desta mudança (auditoria de UX, set/2026): este sub-menu só existia
 * como conteúdo de /carteira/page.tsx — quem entrava em Capacidade, Pipeline
 * ou Faturamento ficava sem nenhuma forma de voltar ou trocar de aba a não
 * ser o botão voltar do navegador ou reabrir "Carteira" no menu principal.
 * Viver num layout.tsx aninhado (`(modulo)/layout.tsx`) resolve isso na
 * raiz: chrome persistente entre rotas irmãs é o que layout.tsx do Next.js
 * existe pra prover.
 */
export function CarteiraSubNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-line text-sm">
      {ABAS.map((aba) => {
        const ativo = aba.href === "/carteira" ? pathname === "/carteira" : pathname.startsWith(aba.href);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            className={`-mb-px border-b-2 px-3 py-2 transition-colors ${
              ativo ? "border-wine-deep font-medium text-ink" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
