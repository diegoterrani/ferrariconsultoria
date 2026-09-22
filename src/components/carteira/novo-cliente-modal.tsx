"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatarCnpj } from "@/lib/cnpj";
import { botaoPrimario, botaoSecundario, campoInput, modalOverlay, modalPainel, rotuloCampo, textoErro } from "@/lib/ui/classes";

type Estado = {
  razaoSocial: string;
  cnpj: string;
  porte: "pequeno" | "medio" | "grande" | "";
  segmento: "restaurante" | "hotel" | "outro" | "";
};

const INICIAL: Estado = { razaoSocial: "", cnpj: "", porte: "", segmento: "" };

/**
 * "+ Novo cliente" (auditoria de UX, set/2026) — mesmos 4 campos e a mesma
 * validação do passo 1 do wizard de diagnóstico (razão social, CNPJ com
 * máscara + dígito verificador, porte, segmento — ver
 * `src/lib/validation/tenant.ts`, `TenantCreateSchema`), num modal em vez de
 * um wizard de 3 passos: aqui não existe diagnóstico nenhum sendo
 * respondido, só o cadastro do cliente em si — um formulário curto é
 * proporcional à tarefa (mesmo racional já aplicado ao modal "Registrar
 * horas").
 *
 * Reutilizado em dois pontos de entrada (Carteira → Clientes e o dashboard
 * em Início), mesmo padrão de componente compartilhado já usado por
 * `GerarEntregavelModal`.
 */
export function NovoClienteModal() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState<Estado>(INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const valido = valor.razaoSocial.trim().length >= 2 && valor.cnpj.replace(/\D/g, "").length === 14 && valor.porte !== "" && valor.segmento !== "";

  function fecharEResetar() {
    setAberto(false);
    setValor(INICIAL);
    setErro(null);
  }

  async function salvar() {
    if (!valido) return;
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valor),
      });
      const dados = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(typeof dados?.error === "string" ? dados.error : "Não foi possível cadastrar o cliente.");
      }
      fecharEResetar();
      router.push(`/carteira/${dados.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cadastrar o cliente. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={botaoPrimario}>
        + Novo cliente
      </button>

      {aberto && (
        <div role="dialog" aria-modal="true" className={modalOverlay}>
          <div className={`${modalPainel} max-w-sm`}>
            <h2 className="text-base font-semibold text-ink">Novo cliente</h2>

            <label className="flex flex-col gap-1">
              <span className={rotuloCampo}>Razão social</span>
              <input
                className={campoInput}
                value={valor.razaoSocial}
                onChange={(e) => setValor({ ...valor, razaoSocial: e.target.value })}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className={rotuloCampo}>CNPJ</span>
              <input
                className={campoInput}
                value={valor.cnpj}
                placeholder="00.000.000/0000-00"
                onChange={(e) => setValor({ ...valor, cnpj: formatarCnpj(e.target.value) })}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className={rotuloCampo}>Porte</span>
              <select
                className={campoInput}
                value={valor.porte}
                onChange={(e) => setValor({ ...valor, porte: e.target.value as Estado["porte"] })}
              >
                <option value="">Selecione</option>
                <option value="pequeno">Pequeno</option>
                <option value="medio">Médio</option>
                <option value="grande">Grande</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className={rotuloCampo}>Segmento</span>
              <div className="flex gap-4">
                {(["restaurante", "hotel", "outro"] as const).map((opcao) => (
                  <label key={opcao} className="flex items-center gap-1.5 text-sm font-normal">
                    <input
                      type="radio"
                      name="novo-cliente-segmento"
                      checked={valor.segmento === opcao}
                      onChange={() => setValor({ ...valor, segmento: opcao })}
                    />
                    {opcao[0].toUpperCase() + opcao.slice(1)}
                  </label>
                ))}
              </div>
            </label>

            {erro && <p className={textoErro}>{erro}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={fecharEResetar} disabled={salvando} className={botaoSecundario}>
                Cancelar
              </button>
              <button type="button" onClick={salvar} disabled={!valido || salvando} className={botaoPrimario}>
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
