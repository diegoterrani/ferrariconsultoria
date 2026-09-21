"use client";

import { useId, useState } from "react";

/**
 * Botão global "+ Registrar horas" (spec seção 6.2) — modal com 4 campos:
 * cliente (busca por nome via <datalist>, sem lib nova), atividade, duração
 * (horas + minutos, dois inputs numéricos em vez de parsear "HH:MM" livre —
 * menos ambíguo de validar) e data (default: hoje).
 */

type TenantOption = { id: string; razaoSocial: string };

const ATIVIDADES = [
  { value: "entrega", label: "Entrega" },
  { value: "prospeccao", label: "Prospecção" },
  { value: "administrativo", label: "Administrativo" },
] as const;

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RegistrarHorasButton({ tenants }: { tenants: TenantOption[] }) {
  const datalistId = useId();
  const [aberto, setAberto] = useState(false);
  const [clienteNome, setClienteNome] = useState("");
  const [atividade, setAtividade] = useState<(typeof ATIVIDADES)[number]["value"]>("entrega");
  const [horas, setHoras] = useState("0");
  const [minutos, setMinutos] = useState("0");
  const [data, setData] = useState(hojeISO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const tenantSelecionado = tenants.find(
    (t) => t.razaoSocial.trim().toLowerCase() === clienteNome.trim().toLowerCase(),
  );

  function fecharEResetar() {
    setAberto(false);
    setClienteNome("");
    setAtividade("entrega");
    setHoras("0");
    setMinutos("0");
    setData(hojeISO());
    setErro(null);
  }

  async function salvar() {
    if (!tenantSelecionado) {
      setErro("Selecione um cliente da lista.");
      return;
    }
    const h = Number(horas);
    const m = Number(minutos);
    if (!Number.isInteger(h) || !Number.isInteger(m) || h * 60 + m <= 0) {
      setErro("Informe uma duração maior que zero.");
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenantSelecionado.id, atividade, horas: h, minutos: m, data }),
      });
      if (!res.ok) throw new Error("Falha ao registrar horas.");
      fecharEResetar();
    } catch {
      setErro("Não foi possível registrar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        + Registrar horas
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4"
        >
          <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg bg-white p-6 dark:bg-neutral-900">
            <h2 className="text-base font-semibold">Registrar horas</h2>

            <div className="flex flex-col gap-1">
              <label htmlFor="th-cliente" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Cliente
              </label>
              <input
                id="th-cliente"
                list={datalistId}
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                placeholder="Buscar por nome..."
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
              <datalist id={datalistId}>
                {tenants.map((t) => (
                  <option key={t.id} value={t.razaoSocial} />
                ))}
              </datalist>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="th-atividade" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Atividade
              </label>
              <select
                id="th-atividade"
                value={atividade}
                onChange={(e) => setAtividade(e.target.value as typeof atividade)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              >
                {ATIVIDADES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="th-horas" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Horas
                </label>
                <input
                  id="th-horas"
                  type="number"
                  min={0}
                  max={23}
                  value={horas}
                  onChange={(e) => setHoras(e.target.value)}
                  className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="th-minutos" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Minutos
                </label>
                <input
                  id="th-minutos"
                  type="number"
                  min={0}
                  max={59}
                  value={minutos}
                  onChange={(e) => setMinutos(e.target.value)}
                  className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="th-data" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Data
              </label>
              <input
                id="th-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>

            {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={fecharEResetar}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
