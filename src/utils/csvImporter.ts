import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import Papa from 'papaparse';
import { db } from '../db/db';
import { Category, Rule } from '../types';

export interface ImportResult {
  added: number;
  skipped: number;
}

export const importBankCsv = async (): Promise<ImportResult | null> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const fileUri = result.assets[0].uri;
    const fileContent = await FileSystem.readAsStringAsync(fileUri);

    const parsed = Papa.parse<string[]>(fileContent, {
      skipEmptyLines: true,
    });

    const rows = parsed.data;
    if (rows.length < 2) return { added: 0, skipped: 0 };

    const categories = await db.getAllAsync<Category>('SELECT * FROM categories;');
    const rules = await db.getAllAsync<Rule>('SELECT * FROM rules;');
    const account = await db.getFirstAsync<{ id: number }>('SELECT id FROM accounts LIMIT 1;');
    const accountId = account ? account.id : 1;

    let addedCount = 0;
    let skippedCount = 0;

    // Otsime veerge päisest (SEB CSV tüüpiline struktuur)
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const dateIdx = header.findIndex((h) => h.includes('kuupäev') || h.includes('date'));
    const partyIdx = header.findIndex((h) => h.includes('saaja') || h.includes('maksja') || h.includes('nimi') || h.includes('party'));
    const amountIdx = header.findIndex((h) => h.includes('summa') || h.includes('amount'));
    const descIdx = header.findIndex((h) => h.includes('selgitus') || h.includes('description'));

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 3) continue;

      const rawDate = dateIdx !== -1 ? row[dateIdx] : row[0];
      const rawParty = partyIdx !== -1 ? row[partyIdx] : row[1] || '';
      const rawAmount = amountIdx !== -1 ? row[amountIdx] : row[2];
      const rawDesc = descIdx !== -1 ? row[descIdx] : row[3] || '';

      const cleanAmount = parseFloat(rawAmount.replace(',', '.').replace(/\s/g, ''));
      if (isNaN(cleanAmount)) continue;

      // Tehingu tüüp ja suund
      const txType = cleanAmount < 0 ? 'expense' : 'income';
      const formattedDate = rawDate.split('T')[0]; // YYYY-MM-DD

      // Tekitame unikaalse räsi (hash) dublikaatide vältimiseks
      const rawString = `${formattedDate}_${cleanAmount}_${rawParty}_${rawDesc}`;
      const rawHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawString
      );

      // Reeglimootor - proovime leida kategooria
      let categoryId: number | null = null;
      let needsReview = 1;

      const searchContent = `${rawParty} ${rawDesc}`.toUpperCase();
      for (const rule of rules) {
        if (rule.match_type === 'contains' && searchContent.includes(rule.pattern.toUpperCase())) {
          categoryId = rule.category_id;
          needsReview = 0;
          break;
        } else if (rule.match_type === 'exact' && searchContent === rule.pattern.toUpperCase()) {
          categoryId = rule.category_id;
          needsReview = 0;
          break;
        }
      }

      // Vaikimisi kategooria kui reeglit ei leitud
      if (!categoryId) {
        const defaultCat = categories.find((c) => c.type === txType);
        if (defaultCat) categoryId = defaultCat.id;
      }

      try {
        await db.runAsync(
          `INSERT INTO transactions 
           (date, amount, type, description, party_name, category_id, account_id, needs_review, raw_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            formattedDate,
            cleanAmount,
            txType,
            rawDesc,
            rawParty,
            categoryId,
            accountId,
            needsReview,
            rawHash,
          ]
        );
        addedCount++;
      } catch (err: any) {
        // SQLite UNIQUE piirang viskab vea kui tehing on juba olemas
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
          skippedCount++;
        }
      }
    }

    // Uuendame konto summaarset balanssi
    await db.runAsync(`
      UPDATE accounts 
      SET balance = (SELECT IFNULL(SUM(amount), 0) FROM transactions)
      WHERE id = ?;
    `, [accountId]);

    return { added: addedCount, skipped: skippedCount };
  } catch (error) {
    console.error('CSV Import Error:', error);
    throw error;
  }
};