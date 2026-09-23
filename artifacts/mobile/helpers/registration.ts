/** Pure rules for the Register screen (design/screens/Register.png). */

export const MIN_PASSWORD_LENGTH = 10;

export interface RegistrationForm {
  name: string;
  email: string;
  /** Optional; empty means "not given". */
  phone: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
}

export type RegistrationField = keyof RegistrationForm;

/** Keys into `strings.register.errors`. */
export type RegistrationErrorKey =
  | "nameRequired"
  | "emailRequired"
  | "emailInvalid"
  | "phoneInvalid"
  | "passwordRequired"
  | "passwordWeak"
  | "confirmMismatch"
  | "termsRequired";

export type RegistrationErrors = Partial<
  Record<RegistrationField, RegistrationErrorKey>
>;

/** What the backend receives: trimmed, normalised, phone omitted if empty. */
export interface Registration {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export const EMPTY_REGISTRATION: RegistrationForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
};

/** Top-to-bottom order of the form, used to focus the first invalid field. */
export const REGISTRATION_FIELDS: readonly RegistrationField[] = [
  "name",
  "email",
  "phone",
  "password",
  "confirmPassword",
  "acceptedTerms",
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** E.164: a "+", then 7–15 digits. */
const PHONE = /^\+\d{7,15}$/;

const normalisePhone = (phone: string) => phone.replace(/[\s().-]/g, "");

export function meetsPasswordRule(password: string) {
  return password.length >= MIN_PASSWORD_LENGTH && /\d/.test(password);
}

export type PasswordStrength = "weak" | "fair" | "strong" | "veryStrong";

const STRENGTHS: PasswordStrength[] = ["weak", "fair", "strong", "veryStrong"];

/**
 * 0–4 bars. One for any input, one each for the length and number rules, and
 * one for a longer password mixing case or symbols. A score of 3 or more means
 * the password meets the rule ("fieldwork2026" scores 3, "Strong").
 */
export function passwordStrength(password: string): {
  score: number;
  strength: PasswordStrength | null;
} {
  if (!password) return { score: 0, strength: null };

  const score =
    1 +
    Number(password.length >= MIN_PASSWORD_LENGTH) +
    Number(/\d/.test(password)) +
    Number(
      password.length >= MIN_PASSWORD_LENGTH + 2 &&
        ((/[a-z]/.test(password) && /[A-Z]/.test(password)) ||
          /[^A-Za-z0-9]/.test(password)),
    );

  return { score, strength: STRENGTHS[score - 1] };
}

export function validateRegistration(
  form: RegistrationForm,
): RegistrationErrors {
  const errors: RegistrationErrors = {};
  const email = form.email.trim();
  const phone = normalisePhone(form.phone);

  if (!form.name.trim()) errors.name = "nameRequired";

  if (!email) errors.email = "emailRequired";
  else if (!EMAIL.test(email)) errors.email = "emailInvalid";

  if (phone && !PHONE.test(phone)) errors.phone = "phoneInvalid";

  if (!form.password) errors.password = "passwordRequired";
  else if (!meetsPasswordRule(form.password)) errors.password = "passwordWeak";

  if (form.password && form.confirmPassword !== form.password) {
    errors.confirmPassword = "confirmMismatch";
  }

  if (!form.acceptedTerms) errors.acceptedTerms = "termsRequired";

  return errors;
}

export function toRegistration(form: RegistrationForm): Registration {
  const phone = normalisePhone(form.phone);
  return {
    name: form.name.trim().replace(/\s+/g, " "),
    email: form.email.trim().toLowerCase(),
    ...(phone && { phone }),
    password: form.password,
  };
}
