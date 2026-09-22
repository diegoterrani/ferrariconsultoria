"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { LABELS_TIPO, templatesPorTipo, type TipoEntregavel } from "@/lib/entregaveis/templates";
import { botaoPrimario, botaoSecundario, campoInput, modalOverlay, modalPainel, rotuloCampo, textoErro } from "@/lib/ui/classes";

const TIPOS = Object.keys(LABELS_TIPO) as TipoEntregavel[];

/**
 * Modal "Gerar entregável" (spec seção 6.3) — ponto de entrada em
 * /carteira/[id] (aba Entregáveis) e /assessments/[id]/resultado.
 *
 * "Botão 'Gerar' fecha o modal e dispara o job assíncrono" (spec): aqui o
 * fechamento do modal e a navegação para o editor só acontecem depois da
 * resposta da API (ver racional de chamada síncrona em
 * api/deliverables/route.ts) — a mensagem de carregamento explícita e o
 * botão desabilitado durante a chamada cobrem a mesma exigência de UX
 * ("nunca um spinner mudo... evita clique duplo").
 */
export function GerarEntregavelModal({
  tenantId,
  assessmentId,
}: {
  tenantId: string;
  assessmentId?: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<TipoEntregavel | "">("");
  const [templateBaseId, setTemplateBaseId] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const templatesDisponiveis = tipo ? templatesPorTipo(tipo) : [];

  function abrir() {
    setTipo("");
    setTemplateBaseId("");
    setErro(null);
    setAberto(true);
  }

  async function gerar() {
    if (!tipo || !templateBaseId) return;
    setGerando(true);
    setErro(null);
    try {
      const res = await fetch("/api/deliverables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, tipo, templateBaseId, ...(assessmentId ? { assessmentId } : {}) }),
      });
      const dados = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(typeof dados?.error === "string" ? dados.error : "Falha ao gerar entregável.");
      }
      router.push(`/entregaveis/${dados.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar entregável. Tente de novo.");
      setGerando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className={botaoPrimario}
      >
        Gerar entregável
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          className={modalOverlay}
        >
          <div className={`${modalPainel} max-w-sm`}>
            <h2 className="text-base font-semibold text-ink">Gerar entregável</h2>

            {gerando ? (
              <p className="text-sm text-ink-soft">
                Gerando rascunho com IA — isso pode levar até 30 segundos.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <label className={rotuloCampo}>Tipo</label>
                  <select
                    className={campoInput}
                    value={tipo}
                    onChange={(e) => {
                      setTipo(e.target.value as TipoEntregavel);
                      setTemplateBaseId("");
                    }}
                  >
                    <option value="">Selecione</option>
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {LABELS_TIPO[t]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className={rotuloCampo}>
                    Template-base
                  </label>
                  <select
                    className={`${campoInput} disabled:opacity-40`}
                    value={templateBaseId}
                    onChange={(e) => setTemplateBaseId(e.target.value)}
                    disabled={!tipo}
                  >
                    <option value="">Selecione</option>
                    {templatesDisponiveis.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {erro && <p className={textoErro}>{erro}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAberto(false)}
                disabled={gerando}
                className={botaoSecundario}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={gerar}
                disabled={!tipo || !templateBaseId || gerando}
                className={botaoPrimario}
              >
                {gerando ? "Gerando..." : "Gerar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
