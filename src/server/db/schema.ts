import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// All money values are stored as integers in minor units (cents).

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  telegramUserId: integer('telegram_user_id').notNull().unique(),
  telegramUsername: text('telegram_username'),
  displayName: text('display_name').notNull(),
  photoUrl: text('photo_url'),
  role: text('role', { enum: ['admin', 'member'] }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  locale: text('locale', { enum: ['en', 'ru'] }),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  deactivatedAt: text('deactivated_at'),
});

export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const invites = sqliteTable('invites', {
  id: text('id').primaryKey(),
  token: text('token').notNull().unique(),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
  displayNameHint: text('display_name_hint'),
  consumedByUserId: text('consumed_by_user_id').references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  consumedAt: text('consumed_at'),
  revokedAt: text('revoked_at'),
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(), // always 1
  monthlyDuesAmount: integer('monthly_dues_amount').notNull().default(0),
  dueDay: integer('due_day').notNull().default(1),
  lastDuesGeneratedFor: text('last_dues_generated_for'),
  cashOpeningCents: integer('cash_opening_cents').notNull().default(0),
  cardOpeningCents: integer('card_opening_cents').notNull().default(0),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export const charges = sqliteTable('charges', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  type: text('type', {
    enum: ['monthly_dues', 'out_of_bounds', 'adhoc', 'pot_borrow'],
  }).notNull(),
  amount: integer('amount').notNull(),
  description: text('description').notNull(),
  billingPeriod: text('billing_period'),
  groupId: text('group_id'),
  sourcePot: text('source_pot', { enum: ['cash', 'card'] }),
  status: text('status', { enum: ['open', 'paid', 'cancelled'] }).notNull().default('open'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
});

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  payerUserId: text('payer_user_id').notNull().references(() => users.id),
  method: text('method', { enum: ['cash', 'card'] }).notNull(),
  amount: integer('amount').notNull(),
  note: text('note'),
  receivedAt: text('received_at').notNull(),
  cancelledAt: text('cancelled_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
});

export const paymentAllocations = sqliteTable('payment_allocations', {
  id: text('id').primaryKey(),
  paymentId: text('payment_id').notNull().references(() => payments.id, { onDelete: 'cascade' }),
  chargeId: text('charge_id').notNull().references(() => charges.id),
  amount: integer('amount').notNull(),
});

export const spendings = sqliteTable('spendings', {
  id: text('id').primaryKey(),
  pot: text('pot', { enum: ['cash', 'card'] }).notNull(),
  amount: integer('amount').notNull(),
  categoryId: text('category_id').references(() => categories.id),
  description: text('description').notNull(),
  occurredAt: text('occurred_at').notNull(),
  cancelledAt: text('cancelled_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
});

export const infoPages = sqliteTable('info_pages', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedByUserId: text('updated_by_user_id').notNull().references(() => users.id),
});

export const guests = sqliteTable('guests', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
});

export const guestDeposits = sqliteTable('guest_deposits', {
  id: text('id').primaryKey(),
  guestId: text('guest_id').references(() => guests.id),
  amount: integer('amount').notNull(),
  method: text('method', { enum: ['cash', 'card'] }).notNull(),
  note: text('note'),
  receivedAt: text('received_at').notNull(),
  cancelledAt: text('cancelled_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
});
