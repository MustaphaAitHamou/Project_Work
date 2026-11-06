import { describe, expect, it } from "vitest";
import {
  frenchVatFromSiren,
  isValidBelgianEnterprise,
  isValidLuxembourgVat,
  isValidSiren,
  isValidSiret,
  isValidSpanishNif,
  isValidSwissUid,
  isValidUkCrn,
  validateIdentifier,
  validateSecondary,
} from "@/lib/companies/identifiers";

describe("company identifiers", () => {
  it("France: SIREN / SIRET (Luhn) and derived VAT number", () => {
    expect(isValidSiren("552100554")).toBe(true); // Renault SA (published SIREN)
    expect(isValidSiren("552100555")).toBe(false);
    expect(isValidSiret("55210055400013")).toBe(true);
    expect(isValidSiret("55210055400014")).toBe(false);
    expect(frenchVatFromSiren("303265045")).toBe("FR40303265045"); // documented example of the VAT key algorithm
    expect(validateIdentifier("fr_siren", "552 100 554")).toEqual({ ok: true, normalized: "552100554" });
  });

  it("Switzerland: UID modulo 11", () => {
    expect(isValidSwissUid("CHE123456788")).toBe(true);
    expect(isValidSwissUid("CHE123456789")).toBe(false);
    expect(validateIdentifier("ch_uid", "CHE-123.456.788")).toEqual({ ok: true, normalized: "CHE123456788" });
  });

  it("Belgium: enterprise number modulo 97", () => {
    expect(isValidBelgianEnterprise("0403170701")).toBe(true);
    expect(isValidBelgianEnterprise("0403170702")).toBe(false);
    expect(validateIdentifier("be_kbo", "BE 0403.170.701")).toEqual({ ok: true, normalized: "0403170701" });
    expect(validateIdentifier("be_kbo", "403.170.701")).toEqual({ ok: true, normalized: "0403170701" });
  });

  it("Spain: CIF, DNI and NIE check characters", () => {
    expect(isValidSpanishNif("B12345674")).toBe(true);
    expect(isValidSpanishNif("B12345675")).toBe(false);
    expect(isValidSpanishNif("12345678Z")).toBe(true);
    expect(isValidSpanishNif("12345678A")).toBe(false);
    expect(isValidSpanishNif("X1234567L")).toBe(true);
    expect(validateIdentifier("es_nif", "ES-B12345674")).toEqual({ ok: true, normalized: "B12345674" });
  });

  it("United Kingdom: Companies House number formats", () => {
    expect(isValidUkCrn("00000006")).toBe(true);
    expect(isValidUkCrn("SC123456")).toBe(true);
    expect(isValidUkCrn("XX123456")).toBe(false);
    expect(validateIdentifier("uk_crn", "6")).toEqual({ ok: true, normalized: "00000006" });
  });

  it("Luxembourg: VAT checksum (mod 89) and RCS format", () => {
    expect(isValidLuxembourgVat("LU15027442")).toBe(true);
    expect(isValidLuxembourgVat("LU15027443")).toBe(false);
    expect(validateIdentifier("lu_rcs", "B 123456")).toEqual({ ok: true, normalized: "B123456" });
  });

  it("Algeria, Canada, United States: format checks only (manual verification)", () => {
    expect(validateIdentifier("dz_rc", "16/00-1234567 B 12").ok).toBe(true);
    expect(validateIdentifier("dz_rc", "x").ok).toBe(false);
    expect(validateIdentifier("ca_neq", "1171234567").ok).toBe(true);
    expect(validateIdentifier("us_state_file", "7286832").ok).toBe(true);
    expect(validateSecondary("us_ein", "12-3456789")).toEqual({ ok: true, normalized: "123456789" });
  });

  it("rejects unknown identifier types", () => {
    expect(validateIdentifier("xx_unknown", "123").ok).toBe(false);
  });
});
