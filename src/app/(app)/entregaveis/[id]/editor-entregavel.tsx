"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { botaoPrimario, botaoSecundario, campoInput, modalOverlay, modalPainel, rotuloCampo, textoErro, textoSucesso } from "@/lib/ui/classes";

type Status = "rascunho" | "em_revisao" | "aprovado" | "enviado";

const ESTAGIOS: { valor: Status; rotulo: string }[] = [
  { valor: "rascunho", rotulo: "Rascunho" },
  { valor: "em_revisao", rotulo: "Em revisão" },
  { valor: "aprovado", rotulo: "Aprovado" },
  { valor: "enviado", rotulo: "Enviado" },
];

/**
 * Editor de /entregaveis/[id] (spec seção 6.3) — "editor de texto rico...
 * editável livremente". Simplificado para um textarea de markdown em vez de
 * um editor WYSIWYG: o conteúdo gerado já sai em markdown simples (títulos
 * `#`, listas `-` — ver ai-provider.ts), revisão de texto jurídico/RH não
 * depende de formatação rica, e evita adicionar uma biblioteca de editor
 * só para isso (mesmo racional de "sem dependência nova sem necessidade
 * real" já aplicado ao Kanban e ao gráfico do módulo B6).
 *
 * `router.refresh()` depois de cada PATCH bem-sucedido: a página (Server
 * Component) é a fonte da verdade do status, igual ao padrão de
 * editar-pacote.tsx — evita o botão de ação e a barra de status
 * divergirem depois de salvar.
 */
export function EditorEntregavel({
  id,
  conteudoInicial,
  status,
}: {
  id: string;
  conteudoInicial: string;
  status: Status;
}) {
  const router = useRouter();
  const [conteudo, setConteudo] = useState(conteudoInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modalAprovarAberto, setModalAprovarAberto] = useState(false);
  const [minutosEconomizados, setMinutosEconomizados] = useState("");

  const podeEditar = status === "rascunho" || status === "em_revisao";
  const conteudoMudou = conteudo !== conteudoInicial;

  async function aplicarPatch(body: Record<string, unknown>) {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/deliverables/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const dados = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(typeof dados?.error === "string" ? dados.error : "Falha ao salvar.");
      }
      router.refresh();
      return true;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar. Tente de novo.");
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function salvarConteudo() {
    await aplicarPatch({ conteudo });
  }

  async function iniciarRevisao() {
    await aplicarPatch({ status: "em_revisao" });
  }

  async function confirmarAprovacao() {
    const minutos = minutosEconomizados.trim() === "" ? undefined : Number(minutosEconomizados);
    const ok = await aplicarPatch({
      status: "aprovado",
      ...(minutos !== undefined && Number.isFinite(minutos) ? { tempoManualEstimadoMinutos: minutos } : {}),
    });
    if (ok) setModalAprovarAberto(false);
  }

  async function enviarAoCliente() {
    await aplicarPatch({ status: "enviado" });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de status fixa (spec 6.3) */}
      <div className="flex items-center gap-2 text-xs">
        {ESTAGIOS.map((e, i) => (
          <span key={e.valor} className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${
                e.valor === status ? "bg-wine-deep text-on-brand" : "bg-surface-2 text-ink-soft"
              }`}
            >
              {e.rotulo}
            </span>
            {i < ESTAGIOS.length - 1 && <span className="text-ink-soft/40">→</span>}
          </span>
        ))}
      </div>

      <textarea
        className={`min-h-[400px] font-mono disabled:bg-surface-2 disabled:text-ink-soft ${campoInput}`}
        value={conteudo}
        onChange={(e) => setConteudo(e.target.value)}
        disabled={!podeEditar || salvando}
      />

      {erro && <p className={textoErro}>{erro}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {podeEditar && (
          <button
            type="button"
            onClick={salvarConteudo}
            disabled={!conteudoMudou || salvando}
            className={botaoSecundario}
          >
            {salvando ? "Salvando..." : "Salvar conteúdo"}
          </button>
        )}

        {status === "rascunho" && (
          <button
            type="button"
            onClick={iniciarRevisao}
            disabled={salvando}
            className={botaoPrimario}
          >
            Iniciar revisão
          </button>
        )}

        {status === "em_revisao" && (
          <button
            type="button"
            onClick={() => setModalAprovarAberto(true)}
            disabled={salvando}
            className={botaoPrimario}
          >
            Aprovar
          </button>
        )}

        {/* "Enviar ao cliente" sempre visível, desabilitado + tooltip até
            aprovado (spec 8.3: "o usuário nunca deve nem ver a opção de
            pular a revisão" — aqui ele vê o botão, mas nunca consegue
            clicar antes da hora, e o tooltip explica o motivo). */}
        <button
          type="button"
          onClick={enviarAoCliente}
          disabled={status !== "aprovado" || salvando}
          title={
            status !== "aprovado"
              ? "Disponível só depois que o entregável for aprovado — revisão humana é obrigatória antes do envio (spec 8.3)."
              : undefined
          }
          className="cursor-not-allowed rounded-md border border-line px-4 py-2 text-sm text-ink-soft/50 enabled:cursor-pointer enabled:border-transparent enabled:bg-wine-deep enabled:text-on-brand disabled:opacity-40"
        >
          Enviar ao cliente
        </button>
      </div>

      {status === "enviado" && (
        <p className={textoSucesso}>
          Marcado como enviado — este registro é manual; o envio de fato (e-mail, download) acontece por fora do
          sistema nesta versão (portal do cliente é módulo A1, fora do MVP).
        </p>
      )}

      {modalAprovarAberto && (
        <div role="dialog" aria-modal="true" className={modalOverlay}>
          <div className={`${modalPainel} max-w-sm`}>
            <h2 className="text-base font-semibold text-ink">Aprovar entregável</h2>
            <div className="flex flex-col gap-1">
              <label className={rotuloCampo}>
                Quanto tempo você levaria para produzir isso sem a IA? (minutos, opcional)
              </label>
              <input
                type="number"
                min={0}
                className={campoInput}
                value={minutosEconomizados}
                onChange={(e) => setMinutosEconomizados(e.target.value)}
              />
            </div>
            {erro && <p className={textoErro}>{erro}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAprovarAberto(false)}
                disabled={salvando}
                className={botaoSecundario}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarAprovacao}
                disabled={salvando}
                className={botaoPrimario}
              >
                {salvando ? "Aprovando..." : "Confirmar aprovação"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
