"use client";

import Link from "next/link";
import { useState } from "react";

import { botaoSecundarioPequeno, modalOverlay, modalPainel, textoErro } from "@/lib/ui/classes";

export type LeadCard = {
  id: string;
  estagio: "contato" | "reuniao" | "diagnostico" | "fechamento";
  assessmentId: string | null;
  decisao: "aceite" | "recusa" | "nao_agora" | null;
  motivoDecisao: string | null;
  pacoteSugerido: string | null;
  tenant: { razaoSocial: string } | null;
};

const COLUNAS = [
  { valor: "contato", rotulo: "Contato" },
  { valor: "reuniao", rotulo: "Reunião" },
  { valor: "diagnostico", rotulo: "Diagnóstico" },
  { valor: "fechamento", rotulo: "Fechamento" },
] as const;

const DECISAO_LABEL: Record<string, string> = {
  aceite: "Aceite",
  recusa: "Recusa",
  nao_agora: "Não agora",
};

/**
 * Board arrastar-e-soltar nativo (HTML5 Drag and Drop API — sem lib nova,
 * spec seção 6.2 não pede uma e o board é simples: 4 colunas fixas, sem
 * reordenar dentro da coluna). Atualização otimista: move o card na hora,
 * reverte se o PATCH falhar — evita o board "travar" esperando rede a
 * cada arraste, que é ruim numa ação repetida o dia inteiro.
 */
export function KanbanBoard({ leadsIniciais }: { leadsIniciais: LeadCard[] }) {
  const [leads, setLeads] = useState(leadsIniciais);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<LeadCard | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function moverPara(leadId: string, novoEstagio: LeadCard["estagio"]) {
    const anterior = leads;
    setLeads((atual) => atual.map((l) => (l.id === leadId ? { ...l, estagio: novoEstagio } : l)));
    setErro(null);
    try {
      const res = await fetch(`/api/pipeline-leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estagio: novoEstagio }),
      });
      if (!res.ok) throw new Error("Falha ao mover.");
    } catch {
      setLeads(anterior);
      setErro("Não foi possível mover o card. Tente de novo.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && <p className={textoErro}>{erro}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COLUNAS.map((coluna) => {
          const cards = leads.filter((l) => l.estagio === coluna.valor);
          return (
            <div
              key={coluna.valor}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const leadId = e.dataTransfer.getData("text/plain");
                if (leadId) void moverPara(leadId, coluna.valor);
                setArrastando(null);
              }}
              className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3"
            >
              <h2 className="text-xs font-semibold text-ink-soft">
                {coluna.rotulo} <span className="font-normal">({cards.length})</span>
              </h2>

              {cards.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", lead.id);
                    setArrastando(lead.id);
                  }}
                  onDragEnd={() => setArrastando(null)}
                  onClick={() => setSelecionado(lead)}
                  className={`flex flex-col gap-1 rounded-md border border-line bg-surface p-3 text-left text-sm shadow-sm ${
                    arrastando === lead.id ? "opacity-40" : ""
                  }`}
                >
                  <span className="font-medium">{lead.tenant?.razaoSocial ?? "Sem cliente"}</span>
                  {lead.decisao && (
                    <span className="text-xs text-ink-soft">
                      {DECISAO_LABEL[lead.decisao]}
                      {lead.pacoteSugerido ? ` · ${lead.pacoteSugerido}` : ""}
                    </span>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {selecionado && (
        <div
          role="dialog"
          aria-modal="true"
          className={modalOverlay}
          onClick={() => setSelecionado(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`${modalPainel} max-w-sm gap-2`}
          >
            <h2 className="text-base font-semibold text-ink">{selecionado.tenant?.razaoSocial ?? "Sem cliente"}</h2>
            <p className="text-xs text-ink-soft">
              Estágio: {COLUNAS.find((c) => c.valor === selecionado.estagio)?.rotulo}
            </p>
            {selecionado.decisao && (
              <p className="text-sm">
                Decisão: <strong>{DECISAO_LABEL[selecionado.decisao]}</strong>
              </p>
            )}
            {selecionado.pacoteSugerido && <p className="text-sm">Pacote sugerido: {selecionado.pacoteSugerido}</p>}
            {selecionado.motivoDecisao && (
              <p className="text-sm text-ink-soft">{selecionado.motivoDecisao}</p>
            )}

            <div className="mt-2 flex justify-between">
              {selecionado.assessmentId ? (
                <Link
                  href={`/assessments/${selecionado.assessmentId}/resultado`}
                  className="text-sm text-wine underline"
                >
                  Ver diagnóstico
                </Link>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setSelecionado(null)}
                className={botaoSecundarioPequeno}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
