"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { botaoPrimario, botaoPrimarioPequeno, botaoSecundario, modalOverlay, modalPainel, textoErro } from "@/lib/ui/classes";

type Preview = { competencia: string; count: number; tenants: { id: string; razaoSocial: string; valor: number }[] };

/**
 * "Gerar cobranças do mês" (spec seção 6.2) — ação em lote, "exige modal
 * de confirmação antes de executar... porque é uma ação que toca todos os
 * clientes de uma vez". O texto do modal (N cobranças / M clientes) só
 * pode ser honesto se vier de uma prévia real (GET preview-mes), não de um
 * texto genérico — daí o fetch antes de abrir o modal, não só ao confirmar.
 */
export function GerarCobrancasButton() {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function abrirModal() {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/invoices/preview-mes");
      if (!res.ok) throw new Error("Falha ao calcular prévia.");
      setPreview(await res.json());
    } catch {
      setErro("Não foi possível calcular a prévia. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  async function confirmar() {
    setGerando(true);
    setErro(null);
    try {
      const res = await fetch("/api/invoices/gerar-mes", { method: "POST" });
      if (!res.ok) throw new Error("Falha ao gerar cobranças.");
      setPreview(null);
      router.refresh();
    } catch {
      setErro("Não foi possível gerar as cobranças.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrirModal}
        disabled={carregando}
        className={botaoPrimarioPequeno}
      >
        {carregando ? "Calculando..." : "Gerar cobranças do mês"}
      </button>

      {erro && !preview && <p className={`mt-2 ${textoErro}`}>{erro}</p>}

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          className={modalOverlay}
        >
          <div className={`${modalPainel} max-w-sm gap-3`}>
            <h2 className="text-base font-semibold">Gerar cobranças do mês</h2>
            {preview.count === 0 ? (
              <p className="text-sm text-ink-soft">
                Nenhum cliente ativo com pacote contratado ainda sem cobrança em {preview.competencia}.
              </p>
            ) : (
              <p className="text-sm text-ink">
                Isso vai gerar <strong>{preview.count}</strong> {preview.count === 1 ? "cobrança" : "cobranças"} para{" "}
                <strong>{preview.count}</strong> {preview.count === 1 ? "cliente ativo" : "clientes ativos"} em{" "}
                {preview.competencia}. Confirmar?
              </p>
            )}

            {erro && <p className={textoErro}>{erro}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className={botaoSecundario}
              >
                Cancelar
              </button>
              {preview.count > 0 && (
                <button
                  type="button"
                  onClick={confirmar}
                  disabled={gerando}
                  className={botaoPrimario}
                >
                  {gerando ? "Gerando..." : "Confirmar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
