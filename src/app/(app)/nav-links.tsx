"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", rotulo: "Início" },
  { href: "/assessments/novo", rotulo: "Diagnóstico" },
  { href: "/carteira", rotulo: "Carteira" },
] as const;

/**
 * Nav do cabeçalho autenticado, com o item ativo destacado em ouro — a
 * regra de uso da marca é explícita sobre isto ("ouro — acento, detalhe
 * único por peça"; ouro é a cor de estado ativo no mockup de dashboard do
 * próprio documento de marca, "dash-nav-item.active"). Só a marcação do
 * item ativo precisa saber a rota atual (`usePathname`), então só isto
 * virou Client Component — o resto do layout ((app)/layout.tsx) continua
 * Server Component, sem motivo pra mudar.
 */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 text-sm font-medium">
      {ITENS.map((item) => {
        const ativo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              ativo ? "bg-gold text-wine-deep" : "text-on-brand/85 hover:bg-white/10 hover:text-on-brand"
            }`}
          >
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
