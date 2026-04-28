import { z } from "zod";

// ─── Reusable field validators ─────────────────────────────

const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
    "Invalid PAN format. Expected format: ABCDE1234F"
  );

const mobileSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number. Must be 10 digits starting with 6-9");

const pincodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Pincode must be exactly 6 digits");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(64, "Password must be less than 64 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain at least one special character"
  );

const dobSchema = z
  .string()
  .trim()
  .regex(
    /^\d{2}\/\d{2}\/\d{4}$/,
    "Date of birth must be in dd/MM/yyyy format"
  )
  .refine((dob) => {
    try {
      // Validate it's a real date
      const [day, month, year] = dob.split("/").map(Number);
      const date = new Date(year, month - 1, day);
      return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
      );
    } catch {
      return false;
    }
  }, "Invalid date of birth")
  .refine((dob) => {
    try {
      // Must be at least 18 years old
      const [day, month, year] = dob.split("/").map(Number);
      const dobDate = new Date(year, month - 1, day);
      const today = new Date();
      let age = today.getFullYear() - dobDate.getFullYear();
      const m = today.getMonth() - dobDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
        age--;
      }
      return age >= 18;
    } catch {
      return false;
    }
  }, "You must be at least 18 years old to register")
  .refine((dob) => {
    try {
      // Must be at most 70 years old
      const [day, month, year] = dob.split("/").map(Number);
      const dobDate = new Date(year, month - 1, day);
      const today = new Date();
      let age = today.getFullYear() - dobDate.getFullYear();
      const m = today.getMonth() - dobDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
        age--;
      }
      return age <= 70;
    } catch {
      return false;
    }
  }, "Age must be 70 years or below");

// ─── Register Schema ───────────────────────────────────────
export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address"),

  password: passwordSchema,

  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(50, "First name must be less than 50 characters")
    .regex(/^[a-zA-Z\s]+$/, "First name can only contain letters")
    .transform((v) => v.toUpperCase()),

  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(50, "Last name must be less than 50 characters")
    .regex(/^[a-zA-Z\s]+$/, "Last name can only contain letters")
    .transform((v) => v.toUpperCase()),

  mobile: mobileSchema,

  dateOfBirth: dobSchema,

  panNumber: panSchema,

  addressLine1: z
    .string()
    .trim()
    .min(5, "Address line 1 must be at least 5 characters")
    .max(100, "Address line 1 must be less than 100 characters"),

  addressLine2: z
    .string()
    .trim()
    .max(100, "Address line 2 must be less than 100 characters")
    .optional(),

  city: z
    .string()
    .trim()
    .min(2, "City is required")
    .max(50, "City must be less than 50 characters")
    .transform((v) => v.toUpperCase()),

  state: z
    .string()
    .trim()
    .min(2, "State is required")
    .max(50, "State must be less than 50 characters")
    .transform((v) => v.toUpperCase()),

  pincode: pincodeSchema,
});

// ─── Login Schema ──────────────────────────────────────────
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address"),

  password: z
    .string()
    .min(1, "Password is required"),
});

// ─── Refresh Token Schema ──────────────────────────────────
export const refreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .min(1, "Refresh token is required"),
});

// ─── Inferred Types ────────────────────────────────────────
// These give you full TypeScript types from your schemas
// Use these as types anywhere in your code
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;