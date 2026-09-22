"use client";

import { useState } from "react";

import { GerarEntregavelModal } from "../../../entregaveis/gerar-entregavel-modal";
import { RelatorioPdfModal } from "./relatorio-modal";

/**
 * Seção "Recomendação comercial" + modal "Registrar decisão do cliente"
 * (spec seção 6.1). Pacote sugerido é uma SUGESTÃO do sistema num select
 * editável — a decisão final é da administradora, nunca soma
 * automaticamente (texto do próprio spec).
 *
 * Geração de PDF (seção 6.1): `RelatorioPdfModal` abre o preview de verdade
 * (`/api/assessments/[id]/relatorio`) — ver esse arquivo para o racional de
 * por que "Enviar ao cliente" continua desabilitado dentro do modal.
 */

const PACOTES = ["Básico", "Premium", "Implantação"] as const;
type Pacote = (typeof PACOTES)[number];
type Decisao = "aceite" | "recusa" | "nao_agora";

export function ResultadoInterativo({
  assessmentId,
  tenantId,
}: {
  assessmentId: string;
  tenantId: string;
}) {
  const [pacoteSugerido, setPacoteSugerido] = useState<Pacote>("Básico");
  const [modalAberto, setModalAberto] = useState(false);
  const [decisao, setDecisao] = useState<Decisao | null>(null);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  async function registrarDecisao() {
    if (!decisao) return;
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/pipeline-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId, decisao, motivoDecisao: motivo, pacoteSugerido }),
      });
      if (!res.ok) throw new Error("Falha ao registrar decisão.");
      setSalvo(true);
      setModalAberto(false);
    } catch {
      setErro("Não foi possível registrar a decisão. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Pacote sugerido
          </label>
          <select
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={pacoteSugerido}
            onChange={(e) => setPacoteSugerido(e.target.value as Pacote)}
          >
            {PACOTES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <p className="text-xs text-neutral-500">
            Sugestão do sistema — a decisão final é sua, sempre editável antes de registrar.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Registrar decisão do cliente
          </button>

          <GerarEntregavelModal tenantId={tenantId} assessmentId={assessmentId} />

          <RelatorioPdfModal assessmentId={assessmentId} />
        </div>

        {salvo && (
          <p className="text-sm text-green-700 dark:text-green-400">
            Decisão registrada — o funil comercial (carteira) foi atualizado.
          </p>
        )}
      </section>

      {modalAberto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4"
        >
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-6 dark:bg-neutral-900">
            <h2 className="text-base font-semibold">Registrar decisão do cliente</h2>

            <div className="flex flex-col gap-1.5">
              {(
                [
                  ["aceite", "Aceite"],
                  ["recusa", "Recusa"],
                  ["nao_agora", "Não agora"],
                ] as const
              ).map(([valor, rotulo]) => (
                <label key={valor} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="decisao"
                    checked={decisao === valor}
                    onChange={() => setDecisao(valor)}
                  />
                  {rotulo}
                </label>
              ))}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Motivo
              </label>
              <textarea
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>

            {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={registrarDecisao}
                disabled={!decisao || salvando}
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
