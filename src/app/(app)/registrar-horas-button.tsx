"use client";

import { useId, useState } from "react";

import { botaoPrimario, botaoPrimarioSobreVinhoPequeno, botaoSecundario, campoInput, modalOverlay, modalPainel, rotuloCampo, textoErro } from "@/lib/ui/classes";

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
        className={botaoPrimarioSobreVinhoPequeno}
      >
        + Registrar horas
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          className={modalOverlay}
        >
          <div className={`${modalPainel} max-w-sm gap-3`}>
            <h2 className="text-base font-semibold">Registrar horas</h2>

            <div className="flex flex-col gap-1">
              <label htmlFor="th-cliente" className={rotuloCampo}>
                Cliente
              </label>
              <input
                id="th-cliente"
                list={datalistId}
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                placeholder="Buscar por nome..."
                className={campoInput}
              />
              <datalist id={datalistId}>
                {tenants.map((t) => (
                  <option key={t.id} value={t.razaoSocial} />
                ))}
              </datalist>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="th-atividade" className={rotuloCampo}>
                Atividade
              </label>
              <select
                id="th-atividade"
                value={atividade}
                onChange={(e) => setAtividade(e.target.value as typeof atividade)}
                className={campoInput}
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
                <label htmlFor="th-horas" className={rotuloCampo}>
                  Horas
                </label>
                <input
                  id="th-horas"
                  type="number"
                  min={0}
                  max={23}
                  value={horas}
                  onChange={(e) => setHoras(e.target.value)}
                  className={campoInput}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="th-minutos" className={rotuloCampo}>
                  Minutos
                </label>
                <input
                  id="th-minutos"
                  type="number"
                  min={0}
                  max={59}
                  value={minutos}
                  onChange={(e) => setMinutos(e.target.value)}
                  className={campoInput}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="th-data" className={rotuloCampo}>
                Data
              </label>
              <input
                id="th-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className={campoInput}
              />
            </div>

            {erro && <p className={textoErro}>{erro}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={fecharEResetar}
                className={botaoSecundario}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
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
