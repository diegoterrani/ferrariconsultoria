"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth";

export type LoginState = { error: string } | undefined;

/**
 * Server Action do formulário de login. Segue o padrão documentado em
 * node_modules/next/dist/docs/.../authentication.md ("Sign-up and login
 * functionality") — Server Action + useActionState, sem endpoint de API
 * separado pra isso.
 */
export async function authenticate(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: (formData.get("callbackUrl") as string) || "/assessments/novo",
    });
  } catch (error) {
    // NextAuth usa um redirect interno (NEXT_REDIRECT) pra navegar em caso
    // de sucesso — isso chega aqui como um erro que PRECISA ser relançado,
    // nunca tratado como falha de login.
    if (error instanceof AuthError) {
      return { error: "E-mail ou senha incorretos." };
    }
    throw error;
  }
}
