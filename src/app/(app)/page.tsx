import Link from "next/link";

import { botaoPrimario, botaoSecundario, textoSecundario } from "@/lib/ui/classes";

// `<main>` fica só no layout do route group (app) — esta página é filha
// dele agora, então usa `<div>` pra não aninhar dois `<main>` na mesma
// árvore (inválido em HTML e ruim pra leitor de tela).
export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Plataforma Ferrari</h1>
      <p className={`max-w-xl ${textoSecundario}`}>
        Módulos B1 (Assessment/Diagnóstico) e B6 (Gestão de carteira)
        implementados. C1 (geração de entregáveis por IA) ainda não. Ver{" "}
        <code>/api/health</code> e o README do repositório para o estado atual.
      </p>
      <div className="flex gap-3">
        <Link
          href="/assessments/novo"
          className={`px-5 py-2.5 ${botaoPrimario}`}
        >
          Iniciar diagnóstico
        </Link>
        <Link
          href="/carteira"
          className={`px-5 py-2.5 font-medium ${botaoSecundario}`}
        >
          Ver carteira
        </Link>
      </div>
    </div>
  );
}
