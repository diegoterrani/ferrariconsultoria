/**
 * Validação de CNPJ — dígito verificador (spec seção 6.1, passo 1 do
 * wizard: "CNPJ (máscara + validação de dígito verificador)").
 *
 * Algoritmo padrão da Receita Federal (módulo 11, pesos fixos) — não há
 * biblioteca externa aqui de propósito: é ~30 linhas de regra estável,
 * testável isoladamente, sem justificativa pra uma dependência nova.
 */

export function limparCnpj(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function formatarCnpj(valor: string): string {
  const digits = limparCnpj(valor).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function calcularDigito(base: string, pesos: number[]): number {
  const soma = base
    .split("")
    .reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function validarCnpj(valor: string): boolean {
  const cnpj = limparCnpj(valor);
  if (cnpj.length !== 14) return false;
  // Rejeita sequências repetidas (00000000000000, 11111111111111, ...) —
  // passam no módulo 11 mas nunca são CNPJ real.
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const digito1 = calcularDigito(cnpj.slice(0, 12), pesos1);
  if (digito1 !== Number(cnpj[12])) return false;

  const digito2 = calcularDigito(cnpj.slice(0, 13), pesos2);
  if (digito2 !== Number(cnpj[13])) return false;

  return true;
}
