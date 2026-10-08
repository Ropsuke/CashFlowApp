import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { PieChart, LineChart } from 'react-native-gifted-charts';
import { db } from '../db/db';
import { usePeriodFilter } from '../hooks/usePeriodFilter';
import { Transaction, PeriodType } from '../types';

interface CategoryDonutItem {
  value: number;
  color: string;
  text: string;
  categoryId: number;
}

interface TrendPoint {
  value: number;
  label: string;
}

export const HomeScreen: React.FC = () => {
  const { period, changePeriod, getDateRange, isReady } = usePeriodFilter();

  const [balance, setBalance] = useState<number>(0);
  const [totalSpent, setTotalSpent] = useState<number>(0);
  const [donutData, setDonutData] = useState<CategoryDonutItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('');
  
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [balanceHistory, setBalanceHistory] = useState<TrendPoint[]>([]);
  const [categorySpendTrend, setCategorySpendTrend] = useState<TrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadDashboardData = useCallback(async () => {
    if (!isReady) return;
    setIsLoading(true);

    try {
      const { startDate, endDate } = getDateRange();
      const startIso = startDate.toISOString().split('T')[0];
      const endIso = endDate.toISOString().split('T')[0];

      // 1. Pangakonto koondseis
      const accountRes = await db.getFirstAsync<{ balance: number }>(
        'SELECT balance FROM accounts LIMIT 1;'
      );
      if (accountRes) setBalance(accountRes.balance);

      // 2. Väljaminekud kategooriate kaupa (Rõngasdiagramm)
      const expenses = await db.getAllAsync<{ categoryId: number; name: string; color: string; total: number }>(`
        SELECT c.id as categoryId, c.name, c.color, SUM(ABS(t.amount)) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.type = 'expense' AND t.date BETWEEN ? AND ?
        GROUP BY c.id
        ORDER BY total DESC;
      `, [startIso, endIso]);

      let spentSum = 0;
      const formattedDonut: CategoryDonutItem[] = expenses.map((row) => {
        spentSum += row.total;
        return {
          value: row.total,
          color: row.color || '#58A6FF',
          text: row.name,
          categoryId: row.categoryId,
        };
      });

      setTotalSpent(spentSum);
      setDonutData(formattedDonut);

      if (formattedDonut.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(formattedDonut[0].categoryId);
        setSelectedCategoryName(formattedDonut[0].text);
      }

      // 3. Viimased 5 tehingut
      const recent = await db.getAllAsync<Transaction>(`
        SELECT t.*, c.name as category_name, c.color as category_color
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        ORDER BY t.date DESC, t.id DESC
        LIMIT 5;
      `);
      setRecentTransactions(recent);

      // 4. Konto saldo dünaamika ajas
      const balancePoints = await db.getAllAsync<{ date: string; sum_amount: number }>(`
        SELECT date, SUM(CASE WHEN type = 'income' THEN amount ELSE -ABS(amount) END) as sum_amount
        FROM transactions
        WHERE date BETWEEN ? AND ?
        GROUP BY date
        ORDER BY date ASC;
      `, [startIso, endIso]);

      let runningBalance = balance;
      const points: TrendPoint[] = balancePoints.map((pt) => {
        runningBalance += pt.sum_amount;
        return {
          value: runningBalance,
          label: pt.date.slice(5),
        };
      });
      setBalanceHistory(points.length > 0 ? points : [{ value: balance, label: 'Täna' }]);

    } catch (error) {
      console.error('Avalehe andmete laadimise viga:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isReady, period, getDateRange, selectedCategoryId]);

  const loadCategoryTrend = useCallback(async (catId: number) => {
    try {
      const { startDate, endDate } = getDateRange();
      const startIso = startDate.toISOString().split('T')[0];
      const endIso = endDate.toISOString().split('T')[0];

      const trendRows = await db.getAllAsync<{ date: string; total: number }>(`
        SELECT date, SUM(ABS(amount)) as total
        FROM transactions
        WHERE category_id = ? AND type = 'expense' AND date BETWEEN ? AND ?
        GROUP BY date
        ORDER BY date ASC;
      `, [catId, startIso, endIso]);

      const formattedTrend: TrendPoint[] = trendRows.map((r) => ({
        value: r.total,
        label: r.date.slice(5),
      }));

      setCategorySpendTrend(formattedTrend);
    } catch (err) {
      console.error('Kategooria trendi laadimise viga:', err);
    }
  }, [getDateRange]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (selectedCategoryId) {
      loadCategoryTrend(selectedCategoryId);
    }
  }, [selectedCategoryId, loadCategoryTrend]);

  const filterButtons: { key: PeriodType; label: string }[] = [
    { key: '1m', label: '1 kuu' },
    { key: '3m', label: '3 kuud' },
    { key: '1y', label: '1 aasta' },
    { key: 'all', label: 'Kõik' },
  ];

  if (!isReady || isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#58A6FF" />
        <Text style={styles.loadingText}>Laen andmeid...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 1. Header Card - Pangakonto Koondseis */}
        <View style={styles.headerCard}>
          <Text style={styles.headerSubtitle}>SEB Arvelduskonto</Text>
          <Text style={styles.headerBalance}>{balance.toFixed(2)} €</Text>
        </View>

        {/* 2. Ajaperioodi Filter Bar */}
        <View style={styles.filterBar}>
          {filterButtons.map((btn) => (
            <TouchableOpacity
              key={btn.key}
              style={[styles.filterTab, period === btn.key && styles.filterTabActive]}
              onPress={() => changePeriod(btn.key)}
            >
              <Text style={[styles.filterTabText, period === btn.key && styles.filterTabTextActive]}>
                {btn.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 3. Interaktiivne Donut Chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Väljaminekud kategooriate kaupa</Text>
          {donutData.length > 0 ? (
            <View style={styles.chartCenterWrapper}>
              <PieChart
                donut
                innerRadius={70}
                radius={100}
                data={donutData.map((item) => ({
                  ...item,
                  onPress: () => {
                    setSelectedCategoryId(item.categoryId);
                    setSelectedCategoryName(item.text);
                  },
                }))}
                centerLabelComponent={() => (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#8B949E', fontSize: 12 }}>Kogukulu</Text>
                    <Text style={{ color: '#F0F6FC', fontSize: 18, fontWeight: 'bold' }}>
                      {totalSpent.toFixed(2)} €
                    </Text>
                  </View>
                )}
              />
              <Text style={styles.drillDownHint}>
                * Vajuta sektoril täpsema trendi nägemiseks
              </Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>Valitud perioodis tehingud puuduvad</Text>
          )}
        </View>

        {/* 4. Konto seisu graafik aja jooksul */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Konto saldo dünaamika</Text>
          {balanceHistory.length > 0 ? (
            <LineChart
              data={balanceHistory}
              color="#58A6FF"
              thickness={2}
              noOfSections={3}
              yAxisTextStyle={{ color: '#8B949E', fontSize: 10 }}
              xAxisLabelTextStyle={{ color: '#8B949E', fontSize: 10 }}
              hideDataPoints={false}
              dataPointsColor="#00E676"
              areaChart
              startOpacity={0.2}
              endOpacity={0.0}
              startFillColor="#58A6FF"
            />
          ) : (
            <Text style={styles.emptyText}>Andmed puuduvad</Text>
          )}
        </View>

        {/* 5. Kategooriapõhine kulutrend */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Kulutrend: <Text style={{ color: '#58A6FF' }}>{selectedCategoryName || 'Määramata'}</Text>
          </Text>
          {categorySpendTrend.length > 0 ? (
            <LineChart
              data={categorySpendTrend}
              color="#FF5252"
              thickness={2}
              noOfSections={3}
              yAxisTextStyle={{ color: '#8B949E', fontSize: 10 }}
              xAxisLabelTextStyle={{ color: '#8B949E', fontSize: 10 }}
              dataPointsColor="#FF5252"
            />
          ) : (
            <Text style={styles.emptyText}>Sellel kategoorial puudub valitud perioodis kulu</Text>
          )}
        </View>

        {/* 6. Viimased tehingud */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Viimased tehingud</Text>
          {recentTransactions.length > 0 ? (
            recentTransactions.map((tx) => (
              <View key={tx.id} style={styles.txItem}>
                <View style={[styles.categoryIndicator, { backgroundColor: tx.category_color || '#30363D' }]} />
                <View style={{ flex: 1, paddingLeft: 12 }}>
                  <Text style={styles.txParty}>{tx.party_name || 'Tundmatu maksja'}</Text>
                  <Text style={styles.txSub}>
                    {tx.date} • {tx.category_name || 'Kontrollimata'}
                  </Text>
                </View>
                <Text style={[styles.txAmount, { color: tx.amount < 0 ? '#FF5252' : '#00E676' }]}>
                  {tx.amount > 0 ? `+${tx.amount.toFixed(2)}` : `${tx.amount.toFixed(2)}`} €
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Tehinguid pole veel imporditud</Text>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  loadingContainer: { flex: 1, backgroundColor: '#0D1117', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8B949E', marginTop: 12, fontSize: 14 },
  scrollContent: { padding: 16 },
  headerCard: {
    backgroundColor: '#161B22',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363D',
    marginBottom: 16,
  },
  headerSubtitle: { color: '#8B949E', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8 },
  headerBalance: { color: '#58A6FF', fontSize: 32, fontWeight: 'bold', marginTop: 6 },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 4,
    borderColor: '#30363D',
    borderWidth: 1,
    marginBottom: 16,
  },
  filterTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  filterTabActive: { backgroundColor: '#21262D' },
  filterTabText: { color: '#8B949E', fontSize: 13, fontWeight: '600' },
  filterTabTextActive: { color: '#58A6FF', fontWeight: 'bold' },
  card: {
    backgroundColor: '#161B22',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363D',
    marginBottom: 16,
  },
  cardTitle: { color: '#F0F6FC', fontSize: 16, fontWeight: '600', marginBottom: 14 },
  chartCenterWrapper: { alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  drillDownHint: { color: '#8B949E', fontSize: 11, marginTop: 12, fontStyle: 'italic' },
  emptyText: { color: '#8B949E', fontSize: 13, textAlign: 'center', marginVertical: 16 },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#21262D',
  },
  categoryIndicator: { width: 10, height: 10, borderRadius: 5 },
  txParty: { color: '#F0F6FC', fontSize: 14, fontWeight: '500' },
  txSub: { color: '#8B949E', fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: 'bold' },
});