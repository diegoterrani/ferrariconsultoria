import { describe, expect, it } from "vitest";
import { formatarCnpj, limparCnpj, validarCnpj } from "./cnpj";

describe("validarCnpj", () => {
  it("aceita CNPJs válidos (dígito verificador correto), com ou sem máscara", () => {
    expect(validarCnpj("11.222.333/0001-81")).toBe(true);
    expect(validarCnpj("11222333000181")).toBe(true);
    expect(validarCnpj("11444777000161")).toBe(true);
  });

  it("rejeita dígito verificador incorreto", () => {
    expect(validarCnpj("11222333000180")).toBe(false);
    expect(validarCnpj("11222333000199")).toBe(false);
  });

  it("rejeita tamanho incorreto", () => {
    expect(validarCnpj("1122233300018")).toBe(false);
    expect(validarCnpj("")).toBe(false);
  });

  it("rejeita sequências repetidas, mesmo que passem no módulo 11", () => {
    expect(validarCnpj("11111111111111")).toBe(false);
    expect(validarCnpj("00000000000000")).toBe(false);
  });
});

describe("formatarCnpj / limparCnpj", () => {
  it("formata dígitos crus na máscara XX.XXX.XXX/XXXX-XX", () => {
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("limparCnpj remove tudo que não é dígito", () => {
    expect(limparCnpj("11.222.333/0001-81")).toBe("11222333000181");
  });
});
