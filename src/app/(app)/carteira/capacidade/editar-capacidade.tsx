"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
      <button type="button" onClick={() => setEditando(true)} className="text-xs text-neutral-500 hover:underline">
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
        className="w-16 rounded-md border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
      />
      <span className="text-neutral-500">h/semana</span>
      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="rounded-md bg-neutral-900 px-2 py-1 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
      >
        {salvando ? "..." : "Salvar"}
      </button>
      <button type="button" onClick={() => setEditando(false)} className="text-neutral-500 hover:underline">
        Cancelar
      </button>
      {erro && <span className="text-red-600 dark:text-red-400">{erro}</span>}
    </div>
  );
}
