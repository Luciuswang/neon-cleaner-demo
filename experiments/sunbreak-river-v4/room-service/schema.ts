import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const lobbyrooms = sqliteTable(
  'lobbyrooms',
  {
    id: text('id').primaryKey(),
    rev: integer('rev').notNull(),
    state: text('state').notNull(),
    expires: integer('expires').notNull(),
  },
  (t) => [index('lobbyrooms_expires_idx').on(t.expires)],
);
