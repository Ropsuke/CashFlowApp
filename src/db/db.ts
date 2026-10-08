import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('cashflow.db');

export const initDatabase = async () => {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL DEFAULT 0.0,
      currency TEXT DEFAULT 'EUR'
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      color TEXT,
      icon TEXT,
      parent_id INTEGER DEFAULT NULL,
      use_count INTEGER DEFAULT 0,
      FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      party_name TEXT,
      category_id INTEGER,
      account_id INTEGER NOT NULL,
      needs_review INTEGER DEFAULT 0,
      raw_hash TEXT UNIQUE,
      FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
      FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
    );
  `);

  const accountCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM accounts;');
  if (accountCount && accountCount.count === 0) {
    await db.runAsync(
      `INSERT INTO accounts (name, type, balance, currency) VALUES ('SEB Arvelduskonto', 'bank', 1607.91, 'EUR');`
    );
  }

  const categoryCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM categories;');
  if (categoryCount && categoryCount.count === 0) {
    const foodId = (await db.runAsync(`INSERT INTO categories (name, type, color, icon) VALUES ('Toit ja jook', 'expense', '#FF5252', 'fast-food');`)).lastInsertRowId;
    const shopId = (await db.runAsync(`INSERT INTO categories (name, type, color, icon) VALUES ('Ostlemine', 'expense', '#4FC3F7', 'cart');`)).lastInsertRowId;
    const homeId = (await db.runAsync(`INSERT INTO categories (name, type, color, icon) VALUES ('Kodu ja elamine', 'expense', '#FFB74D', 'home');`)).lastInsertRowId;
    const transId = (await db.runAsync(`INSERT INTO categories (name, type, color, icon) VALUES ('Transport', 'expense', '#BA68C8', 'bus');`)).lastInsertRowId;

    // Alamkategooriad
    const f1 = (await db.runAsync(`INSERT INTO categories (name, type, color, icon, parent_id) VALUES ('Toidukaubad', 'expense', '#FF5252', 'basket', ${foodId});`)).lastInsertRowId;
    const f2 = (await db.runAsync(`INSERT INTO categories (name, type, color, icon, parent_id) VALUES ('Restoranid', 'expense', '#E53935', 'restaurant', ${foodId});`)).lastInsertRowId;
    const f3 = (await db.runAsync(`INSERT INTO categories (name, type, color, icon, parent_id) VALUES ('Kohvikud', 'expense', '#C62828', 'cafe', ${foodId});`)).lastInsertRowId;

    const s1 = (await db.runAsync(`INSERT INTO categories (name, type, color, icon, parent_id) VALUES ('Riided', 'expense', '#81D4FA', 'shirt', ${shopId});`)).lastInsertRowId;
    const s2 = (await db.runAsync(`INSERT INTO categories (name, type, color, icon, parent_id) VALUES ('Elektroonika', 'expense', '#29B6F6', 'laptop', ${shopId});`)).lastInsertRowId;

    const t1 = (await db.runAsync(`INSERT INTO categories (name, type, color, icon, parent_id) VALUES ('Kütus', 'expense', '#AB47BC', 'car', ${transId});`)).lastInsertRowId;

    // Lisa reaalsete kuupäevadega testtehingud graafiku ja kategooriate testimiseks
    const today = new Date();
    const formatDate = (daysAgo: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().split('T')[0];
    };

    await db.runAsync(`INSERT INTO transactions (date, amount, type, description, party_name, category_id, account_id, raw_hash) VALUES
      ('${formatDate(25)}', 2500.00, 'income', 'Palk', 'Tööandja OÜ', NULL, 1, 'mock_1'),
      ('${formatDate(22)}', -85.40, 'expense', 'Selver ost', 'Selver', ${f1}, 1, 'mock_2'),
      ('${formatDate(20)}', -42.10, 'expense', 'Lõunasöök', 'Hesburger', ${f2}, 1, 'mock_3'),
      ('${formatDate(18)}', -120.00, 'expense', 'Kütus tanklas', 'Circle K', ${t1}, 1, 'mock_4'),
      ('${formatDate(15)}', -350.00, 'expense', 'Talvejope', 'Zara', ${s1}, 1, 'mock_5'),
      ('${formatDate(12)}', -15.50, 'expense', 'Kohv ja saiake', 'Caffeine', ${f3}, 1, 'mock_6'),
      ('${formatDate(10)}', -65.20, 'expense', 'Rimi ost', 'Rimi', ${f1}, 1, 'mock_7'),
      ('${formatDate(7)}', -220.00, 'expense', 'Kõrvaklapid', 'Euronics', ${s2}, 1, 'mock_8'),
      ('${formatDate(5)}', -48.90, 'expense', 'Õhtusöök', 'Restoran Kolm', ${f2}, 1, 'mock_9'),
      ('${formatDate(2)}', -92.30, 'expense', 'Nädala toiduvaru', 'Prisma', ${f1}, 1, 'mock_10');
    `);
  }
};