"use client";

import { useState } from "react";

import { botaoPrimario, botaoSecundario, modalOverlay, modalPainel } from "@/lib/ui/classes";

/**
 * Modal de preview do PDF de resultado (spec seção 6.1) — "aqui um modal é
 * correto: é uma checagem rápida antes de baixar/enviar, não um
 * formulário". Preview via `<iframe>` apontando pra própria rota de API
 * com `?preview=1` (Content-Disposition: inline) — usa o visualizador de
 * PDF nativo do navegador, sem adicionar uma dependência de renderização
 * de PDF no cliente só para isto.
 *
 * "Enviar ao cliente" fica desabilitado com tooltip — ver o comentário em
 * `src/app/api/assessments/[id]/relatorio/route.ts` para o racional
 * completo (sem e-mail do cliente no schema, sem serviço de envio
 * configurado; depende do módulo A1-A3, Prioridade 3 do PRD).
 */
export function RelatorioPdfModal({ assessmentId }: { assessmentId: string }) {
  const [aberto, setAberto] = useState(false);

  const urlPreview = `/api/assessments/${assessmentId}/relatorio?preview=1`;
  const urlDownload = `/api/assessments/${assessmentId}/relatorio`;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={botaoSecundario}
      >
        Gerar relatório em PDF
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="relatorio-pdf-modal-titulo"
          className={modalOverlay}
        >
          <div className={`${modalPainel} h-[85vh] max-w-2xl gap-3`}>
            <div className="flex items-center justify-between">
              <h2 id="relatorio-pdf-modal-titulo" className="text-base font-semibold">
                Relatório de resultado — preview
              </h2>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="text-sm text-ink-soft hover:text-ink"
              >
                Fechar
              </button>
            </div>

            <iframe
              src={urlPreview}
              title="Preview do relatório em PDF"
              className="min-h-0 flex-1 rounded-md border border-line"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled
                title="Envio ao cliente ainda não implementado — depende do portal do cliente (módulo A1-A3), que ainda não existe nesta versão."
                className="cursor-not-allowed rounded-md border border-line px-4 py-2 text-sm text-ink-soft/50"
              >
                Enviar ao cliente
              </button>
              <a
                href={urlDownload}
                download
                className={botaoPrimario}
              >
                Baixar
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
