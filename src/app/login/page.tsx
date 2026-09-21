import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold">Plataforma Ferrari</h1>
          <p className="text-sm text-neutral-500">Acesso da equipe (admin/staff).</p>
        </div>
        <LoginForm callbackUrl={callbackUrl ?? "/assessments/novo"} />
      </div>
    </main>
  );
}
