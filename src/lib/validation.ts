import { z } from "zod";
import { EXPENSE_CATEGORIES, IDOL_TYPES } from "./categories";
import { isDateOnly } from "./period";

/**
 * Every schema used by a Server Action lives here. The server never trusts a
 * value that has not been through one of these.
 */

// Safe ASCII email check that works on zod 3 and 4 alike.
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/;

export const emailSchema = z
  .string()
  .trim()
  .min(3, "Email wajib diisi")
  .max(254, "Email terlalu panjang")
  .regex(EMAIL_RE, "Format email tidak valid")
  .transform((v) => v.toLowerCase());

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username minimal 3 karakter")
  .max(32, "Username maksimal 32 karakter")
  .regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, underscore, dan strip")
  .transform((v) => v.toLowerCase());

/** 8+ chars, but never longer than 72 bytes because bcrypt silently truncates there. */
export const passwordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .max(72, "Password maksimal 72 karakter")
  .refine((v) => Buffer.byteLength(v, "utf8") <= 72, "Password terlalu panjang");

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak sama",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Username atau email wajib diisi").max(254),
  password: z.string().min(1, "Password wajib diisi").max(200),
  remember: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token tidak valid"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak sama",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Konfirmasi password tidak sama",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "Password baru harus berbeda dari password saat ini",
    path: ["newPassword"],
  });

export const dateOnlySchema = z
  .string()
  .refine(isDateOnly, "Format tanggal tidak valid (YYYY-MM-DD)");

export const amountSchema = z
  .number({ message: "Nominal wajib diisi" })
  .int("Nominal tidak boleh mengandung desimal")
  .positive("Nominal harus lebih dari 0")
  .max(1_000_000_000_000, "Nominal terlalu besar");

/**
 * Amount as submitted by the browser: the form sends a string, the tests and
 * seeds send a number. Both paths go through the same positivity/length rules -
 * "150000", "1.250.000" and 150000 all normalise to 150000, and "", "abc",
 * "-1000" and 0 are all rejected.
 */
export const amountFieldSchema = z
  .union([z.number(), z.string()])
  .transform((value) =>
    typeof value === "string" ? Number(value.replace(/[^\d-]/g, "")) : value,
  )
  .pipe(amountSchema);

export const expenseInputSchema = z
  .object({
    idolType: z.enum(IDOL_TYPES),
    customIdolName: z.string().trim().max(60, "Nama idol maksimal 60 karakter").optional().nullable(),
    memberName: z.string().max(80, "Nama member maksimal 80 karakter").optional().nullable(),
    category: z.enum(EXPENSE_CATEGORIES),
    amount: amountFieldSchema,
    expenseDate: dateOnlySchema,
    note: z.string().max(500, "Catatan maksimal 500 karakter").optional().nullable(),
    /**
     * Idempotency key for one form submission (requirement 46). Optional so
     * seeds/tests can still create rows directly; when present it is what stops
     * a replayed server action from inserting the same expense twice.
     */
    clientToken: z.string().trim().max(64).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.idolType === "OTHER" && !data.customIdolName?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["customIdolName"],
        message: "Nama idol / group wajib diisi untuk pilihan Other",
      });
    }
  });

export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export const budgetInputSchema = z.object({
  amount: z.union([z.number(), z.string()]),
  periodStart: dateOnlySchema,
});

export const rangeFilterSchema = z.object({
  preset: z.enum(["current", "previous", "all", "custom"]).default("current"),
  start: z.string().optional().nullable(),
  end: z.string().optional().nullable(),
});

/** Turn a ZodError into `{ field: message }` for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
