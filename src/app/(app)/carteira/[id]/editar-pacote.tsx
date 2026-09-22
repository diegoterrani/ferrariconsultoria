"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PACOTES } from "@/lib/carteira/pacotes";
import { botaoPrimario, campoInput, cartao, rotuloCampo, textoErro } from "@/lib/ui/classes";

const STATUS_OPCOES = [
  { value: "ativo", label: "Ativo" },
  { value: "risco_churn", label: "Risco de churn" },
  { value: "encerrado", label: "Encerrado" },
] as const;

/**
 * Aba "Dados do cliente" de /carteira/[id] — edição manual de pacote e
 * status (spec seção 6.2). `router.refresh()` em vez de estado local pro
 * valor exibido: a página em volta (Server Component) é a fonte da
 * verdade, evita os dois ficarem dessincronizados depois de salvar.
 */
export function EditarPacote({
  tenantId,
  pacoteAtual,
  statusAtual,
}: {
  tenantId: string;
  pacoteAtual: string | null;
  statusAtual: string;
}) {
  const router = useRouter();
  const [pacote, setPacote] = useState(pacoteAtual ?? "");
  const [status, setStatus] = useState(statusAtual);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pacoteContratado: pacote || null, status }),
      });
      if (!res.ok) throw new Error("Falha ao salvar.");
      router.refresh();
    } catch {
      setErro("Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className={`${cartao} flex flex-col gap-4 p-4`}>
      <div className="flex flex-col gap-1">
        <label htmlFor="ep-pacote" className={rotuloCampo}>
          Pacote contratado
        </label>
        <select
          id="ep-pacote"
          value={pacote}
          onChange={(e) => setPacote(e.target.value)}
          className={campoInput}
        >
          <option value="">Nenhum</option>
          {Object.keys(PACOTES).map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="ep-status" className={rotuloCampo}>
          Status
        </label>
        <select
          id="ep-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={campoInput}
        >
          {STATUS_OPCOES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {erro && <p className={textoErro}>{erro}</p>}

      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className={`self-start ${botaoPrimario}`}
      >
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}
