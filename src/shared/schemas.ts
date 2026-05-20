import { z } from 'zod';

export const moneySchema = z.preprocess(
  (v) => {
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return v;
      const [w, f = ''] = trimmed.split('.');
      return Number(w) * 100 + Number(f.padEnd(2, '0'));
    }
    return v;
  },
  z.number().int().positive(),
);

export const idSchema = z.string().uuid();

export const potSchema = z.enum(['cash', 'card']);
export const roleSchema = z.enum(['admin', 'member']);

export const recordPaymentSchema = z.object({
  payerUserId: idSchema,
  method: potSchema,
  amount: moneySchema,
  note: z.string().optional(),
  allocations: z
    .array(z.object({ chargeId: idSchema, amount: moneySchema }))
    .min(1),
});

export const recordSpendingSchema = z.object({
  pot: potSchema,
  amount: moneySchema,
  categoryId: idSchema.nullable().optional(),
  description: z.string().min(1).max(200),
  occurredAt: z.string().datetime().optional(),
});

export const createAdhocChargeSchema = z.object({
  userId: idSchema,
  amount: moneySchema,
  description: z.string().min(1).max(200),
});

export const createPotBorrowSchema = z.object({
  userId: idSchema,
  amount: moneySchema,
  sourcePot: potSchema,
  description: z.string().min(1).max(200),
});

export const createSplitChargeSchema = z.object({
  description: z.string().min(1).max(200),
  allocations: z
    .array(z.object({ userId: idSchema, amount: moneySchema }))
    .min(1),
});

export const inviteMemberSchema = z.object({
  displayNameHint: z
    .string()
    .max(80)
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
});

export const updateDuesAmountSchema = z.object({ amount: moneySchema });

export const upsertInfoPageSchema = z.object({
  id: idSchema.optional(),
  title: z.string().min(1).max(120),
  body: z.string().max(20000),
});

export const reorderInfoPagesSchema = z.object({
  orderedIds: z.array(idSchema).min(1),
});

export const upsertCategorySchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1).max(60),
});

export const editMemberSchema = z.object({
  id: idSchema,
  displayName: z.string().trim().min(1).max(80),
  role: roleSchema,
});
