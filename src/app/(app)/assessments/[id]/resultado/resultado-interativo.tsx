"use client";

import { useState } from "react";

import { botaoPrimario, botaoSecundario, campoInput, cartao, modalOverlay, modalPainel, rotuloCampo, textoErro, textoSucesso } from "@/lib/ui/classes";

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
      <section className={`${cartao} flex flex-col gap-4 p-4`}>
        <div className="flex flex-col gap-1">
          <label className={rotuloCampo}>
            Pacote sugerido
          </label>
          <select
            className={campoInput}
            value={pacoteSugerido}
            onChange={(e) => setPacoteSugerido(e.target.value as Pacote)}
          >
            {PACOTES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-soft">
            Sugestão do sistema — a decisão final é sua, sempre editável antes de registrar.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className={botaoPrimario}
          >
            Registrar decisão do cliente
          </button>

          <GerarEntregavelModal tenantId={tenantId} assessmentId={assessmentId} />

          <RelatorioPdfModal assessmentId={assessmentId} />
        </div>

        {salvo && (
          <p className={textoSucesso}>
            Decisão registrada — o funil comercial (carteira) foi atualizado.
          </p>
        )}
      </section>

      {modalAberto && (
        <div
          role="dialog"
          aria-modal="true"
          className={modalOverlay}
        >
          <div className={`${modalPainel} max-w-sm`}>
            <h2 className="text-base font-semibold text-ink">Registrar decisão do cliente</h2>

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
              <label className={rotuloCampo}>
                Motivo
              </label>
              <textarea
                className={campoInput}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>

            {erro && <p className={textoErro}>{erro}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className={botaoSecundario}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={registrarDecisao}
                disabled={!decisao || salvando}
                className={botaoPrimario}
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
