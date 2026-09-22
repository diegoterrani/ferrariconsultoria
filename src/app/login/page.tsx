import { Logomark } from "@/components/brand/logomark";

import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-bg px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Logomark />
        <div className="w-full">
          <h1 className="text-xl font-semibold text-ink">Acesso da equipe</h1>
          <p className="text-sm text-ink-soft">Login de administradora/staff da Ferrari Consultoria.</p>
        </div>
        <div className="w-full">
          <LoginForm callbackUrl={callbackUrl ?? "/assessments/novo"} />
        </div>
      </div>
    </main>
  );
}
