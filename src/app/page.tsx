import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Plataforma Ferrari</h1>
      <p className="max-w-xl text-sm text-neutral-500">
        Módulo B1 (Assessment/Diagnóstico) em construção — wizard de 3 passos,
        scoring determinístico, resultado com recomendação comercial. B6 e C1
        ainda não implementados. Ver <code>/api/health</code> e o README do
        repositório para o estado atual.
      </p>
      <Link
        href="/assessments/novo"
        className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        Iniciar diagnóstico
      </Link>
    </main>
  );
}
