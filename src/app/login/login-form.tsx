"use client";

import { useActionState } from "react";

import { botaoPrimario, campoInput, rotuloCampo, textoErro } from "@/lib/ui/classes";

import { authenticate } from "./actions";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, pending] = useActionState(authenticate, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className={rotuloCampo}>
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className={campoInput}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className={rotuloCampo}>
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={campoInput}
        />
      </div>

      {state?.error && (
        <p role="alert" className={textoErro}>
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={botaoPrimario}
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
