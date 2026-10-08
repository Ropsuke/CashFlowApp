export type TransactionType = 'income' | 'expense' | 'transfer';
export type CategoryType = 'income' | 'expense';
export type MatchType = 'contains' | 'exact';
export type PeriodType = '1m' | '3m' | '1y' | 'all' | 'custom';

export interface Account {
  id: number;
  name: string;
  balance: number;
  currency: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  parent_id?: number | null;
}

export interface Transaction {
  id: number;
  date: string; // Formaat: YYYY-MM-DD
  amount: number;
  type: TransactionType;
  description?: string;
  party_name?: string;
  category_id?: number | null;
  account_id: number;
  needs_review: number; // 0 (ei vaja) või 1 (vabade reeglitega)
  raw_hash: string;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
}

export interface Rule {
  id: number;
  pattern: string;
  match_type: MatchType;
  category_id: number;
}

export interface UserSetting {
  key: string;
  value: string;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}