import * as SQLite from 'expo-sqlite';

// Avame kohaliku SQLite andmebaasifaili
export const db = SQLite.openDatabaseSync('finance.db');

export const initDatabase = async (): Promise<void> => {
  try {
    await db.execAsync(`
      PRAGMA foreign_keys = ON;

      -- 1. Pangakontod
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        balance REAL NOT NULL DEFAULT 0.0,
        currency TEXT NOT NULL DEFAULT 'EUR',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- 2. Kategooriad (Hierarhiline struktuur parent_id kaudu)
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        parent_id INTEGER,
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
      );

      -- 3. Tehingud
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT CHECK(type IN ('income', 'expense', 'transfer')) NOT NULL,
        description TEXT,
        party_name TEXT,
        category_id INTEGER,
        account_id INTEGER NOT NULL,
        needs_review INTEGER NOT NULL DEFAULT 0,
        raw_hash TEXT UNIQUE NOT NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      -- 4. Reeglimootor
      CREATE TABLE IF NOT EXISTS rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT NOT NULL,
        match_type TEXT CHECK(match_type IN ('contains', 'exact')) NOT NULL DEFAULT 'contains',
        category_id INTEGER NOT NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      );

      -- 5. Kasutaja seaded
      CREATE TABLE IF NOT EXISTS user_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    await seedDefaultData();
  } catch (error) {
    console.error('Viga andmebaasi initsialiseerimisel:', error);
    throw error;
  }
};

const seedDefaultData = async (): Promise<void> => {
  // Kontrollime vaikimisi pangakontot
  const accountCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM accounts;');
  if (accountCount && accountCount.count === 0) {
    await db.runAsync(
      'INSERT INTO accounts (name, balance, currency) VALUES (?, ?, ?);',
      ['SEB Arvelduskonto', 0.0, 'EUR']
    );
  }

  // Kontrollime vaikimisi kategooriaid
  const categoryCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM categories;');
  if (categoryCount && categoryCount.count === 0) {
    await db.execAsync(`
      INSERT INTO categories (id, name, type, color, icon, parent_id) VALUES
      (1, 'Toit & Toidukaubad', 'expense', '#FF5252', 'cart', NULL),
      (2, 'Transport & Kütus', 'expense', '#448AFF', 'car', NULL),
      (3, 'Kodu & Kommunaalid', 'expense', '#E040FB', 'home', NULL),
      (4, 'Meelelahutus', 'expense', '#FFAB40', 'film', NULL),
      (5, 'Sideteenused', 'expense', '#1DE9B6', 'wifi', NULL),
      (6, 'Palk & Tulu', 'income', '#00E676', 'cash', NULL);

      -- Alamkategooriad (parent_id abil)
      INSERT INTO categories (name, type, color, icon, parent_id) VALUES
      ('Restoranid & Kohvikud', 'expense', '#FF8A80', 'restaurant', 1),
      ('Supermarketid', 'expense', '#FF5252', 'basket', 1),
      ('Ühistransport', 'expense', '#82B1FF', 'bus', 2),
      ('Autokütus', 'expense', '#448AFF', 'oil', 2);

      -- Alglaaditavad reeglid SEB CSV automaatseks tuvastamiseks
      INSERT INTO rules (pattern, match_type, category_id) VALUES
      ('RIMI', 'contains', 1),
      ('MAXIMA', 'contains', 1),
      ('SELVER', 'contains', 1),
      ('CIRCLE K', 'contains', 2),
      ('ALEXELA', 'contains', 2),
      ('TELIA', 'contains', 5),
      ('ELISA', 'contains', 5);
    `);
  }
};