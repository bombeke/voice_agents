import {
  EMPTY_REGISTRATION,
  meetsPasswordRule,
  passwordStrength,
  type RegistrationForm,
  toRegistration,
  validateRegistration,
} from "../registration";

const VALID: RegistrationForm = {
  name: "Grace Nakato",
  email: "grace@uedcl.example.org",
  phone: "",
  password: "fieldwork2026",
  confirmPassword: "fieldwork2026",
  acceptedTerms: true,
};

describe("validateRegistration", () => {
  it("accepts a complete form, with or without a phone number", () => {
    expect(validateRegistration(VALID)).toEqual({});
    expect(
      validateRegistration({ ...VALID, phone: "+256 700 123-456" }),
    ).toEqual({});
  });

  it("flags every required field on an empty form", () => {
    expect(validateRegistration(EMPTY_REGISTRATION)).toEqual({
      name: "nameRequired",
      email: "emailRequired",
      password: "passwordRequired",
      acceptedTerms: "termsRequired",
    });
  });

  it("treats a blank name as missing", () => {
    expect(validateRegistration({ ...VALID, name: "   " }).name).toBe(
      "nameRequired",
    );
  });

  it.each(["grace", "grace@", "grace@uedcl", "gr ace@uedcl.org"])(
    "rejects the malformed email %p",
    (email) => {
      expect(validateRegistration({ ...VALID, email }).email).toBe(
        "emailInvalid",
      );
    },
  );

  it.each(["0700123456", "+256", "+256abc123456", "+1234567890123456"])(
    "rejects the phone number %p",
    (phone) => {
      expect(validateRegistration({ ...VALID, phone }).phone).toBe(
        "phoneInvalid",
      );
    },
  );

  it("requires the password rule and a matching confirmation", () => {
    expect(
      validateRegistration({
        ...VALID,
        password: "fieldwork",
        confirmPassword: "fieldwork",
      }).password,
    ).toBe("passwordWeak");
    expect(
      validateRegistration({ ...VALID, confirmPassword: "fieldwork2025" })
        .confirmPassword,
    ).toBe("confirmMismatch");
  });
});

describe("meetsPasswordRule", () => {
  it.each([
    ["fieldwork2026", true],
    ["fieldwork1", true],
    ["fieldwork", false],
    ["field2026", false],
  ])("%p → %p", (password, ok) => {
    expect(meetsPasswordRule(password)).toBe(ok);
  });
});

describe("passwordStrength", () => {
  it.each([
    ["", 0, null],
    ["abc", 1, "weak"],
    ["abcdefghij", 2, "fair"],
    ["abc123", 2, "fair"],
    ["fieldwork2026", 3, "strong"],
    ["Fieldwork2026", 4, "veryStrong"],
    ["fieldwork-2026", 4, "veryStrong"],
  ])("%p scores %p (%p)", (password, score, strength) => {
    expect(passwordStrength(password)).toEqual({ score, strength });
  });

  it("scores at least 3 exactly when the password meets the rule", () => {
    for (const pw of ["fieldwork2026", "fieldwork", "a1", "Abcdefghi!"]) {
      expect(passwordStrength(pw).score >= 3).toBe(meetsPasswordRule(pw));
    }
  });
});

describe("toRegistration", () => {
  it("normalises the fields the backend receives", () => {
    expect(
      toRegistration({
        ...VALID,
        name: "  Grace   Nakato ",
        email: " Grace@UEDCL.example.org ",
        phone: "+256 (700) 123-456",
      }),
    ).toEqual({
      name: "Grace Nakato",
      email: "grace@uedcl.example.org",
      phone: "+256700123456",
      password: "fieldwork2026",
    });
  });

  it("omits an empty phone number", () => {
    expect(toRegistration(VALID)).not.toHaveProperty("phone");
  });
});
