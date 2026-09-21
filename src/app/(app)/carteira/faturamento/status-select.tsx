"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const OPCOES = [
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago" },
  { value: "atrasado", label: "Atrasado" },
] as const;

/** Marcação manual de status (spec seção 6.2/7 — sem gateway de pagamento). */
export function StatusSelect({ invoiceId, statusAtual }: { invoiceId: string; statusAtual: string }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);

  async function alterar(novoStatus: string) {
    setSalvando(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus }),
      });
      if (res.ok) router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <select
      value={statusAtual}
      disabled={salvando}
      onChange={(e) => alterar(e.target.value)}
      className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
    >
      {OPCOES.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
