"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { botaoPrimarioPequeno, campoInputPequeno, textoErro } from "@/lib/ui/classes";

/**
 * Edição inline do valor de capacidade semanal (spec seção 6.2: "valor
 * configurável quando a fundadora migrar para dedicação full-time — não
 * deve ser hardcoded").
 */
export function EditarCapacidade({ horasAtual }: { horasAtual: number }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(horasAtual));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/capacity-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horasPorSemana: Number(valor) }),
      });
      if (!res.ok) throw new Error("Falha ao salvar.");
      setEditando(false);
      router.refresh();
    } catch {
      setErro("Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (!editando) {
    return (
      <button type="button" onClick={() => setEditando(true)} className="text-xs text-ink-soft hover:underline">
        Editar capacidade
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <input
        type="number"
        min={1}
        max={168}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className={`w-16 ${campoInputPequeno}`}
      />
      <span className="text-ink-soft">h/semana</span>
      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className={botaoPrimarioPequeno}
      >
        {salvando ? "..." : "Salvar"}
      </button>
      <button type="button" onClick={() => setEditando(false)} className="text-ink-soft hover:underline">
        Cancelar
      </button>
      {erro && <span className={textoErro}>{erro}</span>}
    </div>
  );
}
