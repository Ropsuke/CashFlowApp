import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PieChart, LineChart } from 'react-native-gifted-charts';
import { db } from '../db/db';
import { usePeriodFilter } from '../hooks/usePeriodFilter';
import { Transaction, PeriodType } from '../types';
import { importBankCsv } from '../utils/csvImporter';
import { AddTransactionModal } from '../components/AddTransactionModal';
import { CustomDatePickerModal } from '../components/CustomDatePickerModal';

interface PieItem {
  value: number;
  color: string;
  text: string;
  categoryId: number;
  focused?: boolean;
}

interface TrendPoint {
  value: number;
  label: string;
}

export const HomeScreen: React.FC = () => {
  const { period, changePeriod, changeCustomRange, getDateRange, isReady } = usePeriodFilter();

  const [balance, setBalance] = useState<number>(0);
  const [totalSpent, setTotalSpent] = useState<number>(0);
  const [totalIncome, setTotalIncome] = useState<number>(0);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [balanceHistory, setBalanceHistory] = useState<TrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');

  // Ringdiagrammi andmed
  const [mainPieRaw, setMainPieRaw] = useState<PieItem[]>([]);
  const [subPieRaw, setSubPieRaw] = useState<PieItem[]>([]);

  // Valitud kategooriate ID-d (puhtalt UI olek, ei lae lehte uuesti)
  const [selectedMainId, setSelectedMainId] = useState<number | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [isDrilledDown, setIsDrilledDown] = useState<boolean>(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Laadimine käivitub AINULT perioodi või tehingutüübi filtri muutumisel
  const loadDashboardData = useCallback(async () => {
    if (!isReady) return;
    setIsLoading(true);

    try {
      const { startDate, endDate } = getDateRange();
      const startIso = startDate.toISOString().split('T')[0];
      const endIso = endDate.toISOString().split('T')[0];

      // 1. Konto hetkeseis
      const accountRes = await db.getFirstAsync<{ balance: number }>('SELECT balance FROM accounts LIMIT 1;');
      if (accountRes) setBalance(accountRes.balance);

      // 2. Perioodi tulud ja kulud
      const periodStats = await db.getFirstAsync<{ income: number; expense: number }>(`
        SELECT 
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
          SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END) as expense
        FROM transactions
        WHERE date BETWEEN ? AND ?;
      `, [startIso, endIso]);

      setTotalIncome(periodStats?.income || 0);

      // 3. Peakategooriate kuluarvutus
      const mainExpenses = await db.getAllAsync<{ categoryId: number; name: string; color: string; total: number }>(`
        SELECT 
          COALESCE(p.id, c.id) as categoryId,
          COALESCE(p.name, c.name) as name,
          COALESCE(p.color, c.color) as color,
          SUM(ABS(t.amount)) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        LEFT JOIN categories p ON c.parent_id = p.id
        WHERE t.type = 'expense' AND t.date BETWEEN ? AND ?
        GROUP BY categoryId
        ORDER BY total DESC;
      `, [startIso, endIso]);

      let spentSum = 0;
      const formattedMain: PieItem[] = mainExpenses.map((row) => {
        spentSum += row.total;
        return {
          value: row.total,
          color: row.color || '#A855F7',
          text: row.name,
          categoryId: row.categoryId,
        };
      });

      setTotalSpent(spentSum);
      setMainPieRaw(formattedMain);

      // 4. Viimased tehingud
      let txQuery = `
        SELECT t.*, c.name as category_name, c.color as category_color
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.date BETWEEN ? AND ?
      `;
      const queryParams: any[] = [startIso, endIso];

      if (typeFilter !== 'all') {
        txQuery += ' AND t.type = ?';
        queryParams.push(typeFilter);
      }
      txQuery += ' ORDER BY t.date DESC, t.id DESC LIMIT 10;';

      const recent = await db.getAllAsync<Transaction>(txQuery, queryParams);
      setRecentTransactions(recent);

      // 5. Saldo trend
      const allTx = await db.getAllAsync<{ date: string; amount: number }>(`
        SELECT date, amount FROM transactions ORDER BY date ASC;
      `);

      let running = 0;
      const pointsMap: { [key: string]: number } = {};
      allTx.forEach((tx) => {
        running += tx.amount;
        pointsMap[tx.date] = running;
      });

      const trendPoints: TrendPoint[] = Object.keys(pointsMap)
        .filter((d) => d >= startIso && d <= endIso)
        .map((d) => ({
          value: Math.max(0, pointsMap[d]),
          label: d.slice(8) + '.',
        }));

      if (trendPoints.length === 0) {
        trendPoints.push({ value: accountRes?.balance || 0, label: 'Täna' });
      }

      setBalanceHistory(trendPoints);

    } catch (error) {
      console.error('Laadimise viga:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isReady, getDateRange, typeFilter]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Arvutame reaalajas ringi tükkide olekud (focused: true lükkab lõigu väljapoole)
  const displayMainPie = useMemo(() => {
    return mainPieRaw.map((item) => ({
      ...item,
      focused: item.categoryId === selectedMainId,
    }));
  }, [mainPieRaw, selectedMainId]);

  const displaySubPie = useMemo(() => {
    return subPieRaw.map((item) => ({
      ...item,
      focused: item.categoryId === selectedSubId,
    }));
  }, [subPieRaw, selectedSubId]);

  const selectedMainCategory = useMemo(() => {
    if (!selectedMainId) return null;
    return mainPieRaw.find((m) => m.categoryId === selectedMainId) || null;
  }, [mainPieRaw, selectedMainId]);

  const selectedSubCategory = useMemo(() => {
    if (!selectedSubId) return null;
    return subPieRaw.find((s) => s.categoryId === selectedSubId) || null;
  }, [subPieRaw, selectedSubId]);

  // Tükile vajutus ilma lehe taaslaadimiseta
  const handleMainPieSelect = (item: PieItem) => {
    if (selectedMainId === item.categoryId) {
      setSelectedMainId(null);
    } else {
      setSelectedMainId(item.categoryId);
    }
    setSelectedSubId(null);
  };

  const handleSubPieSelect = (item: PieItem) => {
    if (selectedSubId === item.categoryId) {
      setSelectedSubId(null);
    } else {
      setSelectedSubId(item.categoryId);
    }
  };

  // Sisenemine alamkategooriatesse (Drill Down)
  const handleDrillDown = async () => {
    if (!selectedMainId) return;

    const { startDate, endDate } = getDateRange();
    const startIso = startDate.toISOString().split('T')[0];
    const endIso = endDate.toISOString().split('T')[0];

    const subExpenses = await db.getAllAsync<{ categoryId: number; name: string; total: number }>(`
      SELECT c.id as categoryId, c.name, SUM(ABS(t.amount)) as total
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE (c.parent_id = ? OR c.id = ?) AND t.type = 'expense' AND t.date BETWEEN ? AND ?
      GROUP BY c.id
      ORDER BY total DESC;
    `, [selectedMainId, selectedMainId, startIso, endIso]);

    const redShades = ['#FF5252', '#FF7043', '#E53935', '#D32F2F', '#C62828', '#B71C1C'];

    const formattedSub: PieItem[] = subExpenses.map((row, idx) => ({
      value: row.total,
      color: redShades[idx % redShades.length],
      text: row.name,
      categoryId: row.categoryId,
    }));

    setSubPieRaw(formattedSub);
    setIsDrilledDown(true);
  };

  const handleResetPie = () => {
    setIsDrilledDown(false);
    setSelectedMainId(null);
    setSelectedSubId(null);
  };

  const handleImportCsv = async () => {
    try {
      const res = await importBankCsv();
      if (res) {
        Alert.alert('Import õnnestus!', `Lisatud: ${res.added}\nVahele jäetud: ${res.skipped}`);
        loadDashboardData();
      }
    } catch (err) {
      Alert.alert('Viga', 'CSV faili import ebaõnnestus.');
    }
  };

  const filterButtons: { key: PeriodType; label: string }[] = [
    { key: '1m', label: '1 kuu' },
    { key: '3m', label: '3 kuud' },
    { key: '1y', label: '1 aasta' },
    { key: 'custom', label: 'Kalender' },
  ];

  if (!isReady || isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A855F7" />
      </SafeAreaView>
    );
  }

  const netBalance = totalIncome - totalSpent;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header - Saldo */}
        <View style={styles.headerCard}>
          <View>
            <Text style={styles.headerSubtitle}>SEB Arvelduskonto</Text>
            <Text style={styles.headerBalance}>{balance.toFixed(2)} €</Text>
          </View>
          <TouchableOpacity style={styles.csvBtn} onPress={handleImportCsv}>
            <Text style={styles.csvBtnText}>+ Import CSV</Text>
          </TouchableOpacity>
        </View>

        {/* Ajaperioodi Filter */}
        <View style={styles.filterBar}>
          {filterButtons.map((btn) => (
            <TouchableOpacity
              key={btn.key}
              style={[styles.filterTab, period === btn.key && styles.filterTabActive]}
              onPress={() => {
                if (btn.key === 'custom') setIsDatePickerOpen(true);
                else changePeriod(btn.key);
              }}
            >
              <Text style={[styles.filterTabText, period === btn.key && styles.filterTabTextActive]}>
                {btn.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Perioodi Statistika */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Tulud</Text>
            <Text style={[styles.statValue, { color: '#00E676' }]}>+{totalIncome.toFixed(2)} €</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Kulud</Text>
            <Text style={[styles.statValue, { color: '#FF5252' }]}>-{totalSpent.toFixed(2)} €</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Neto</Text>
            <Text style={[styles.statValue, { color: netBalance >= 0 ? '#C084FC' : '#FF5252' }]}>
              {netBalance >= 0 ? `+${netBalance.toFixed(2)}` : `${netBalance.toFixed(2)}`} €
            </Text>
          </View>
        </View>

        {/* Saldograafik */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Saldotrend perioodil</Text>
          {balanceHistory.length > 0 ? (
            <View style={{ marginTop: 15, paddingRight: 10 }}>
              <LineChart
                data={balanceHistory}
                color="#A855F7"
                thickness={3}
                curved
                hideDataPoints={false}
                dataPointsColor="#C084FC"
                dataPointsRadius={4}
                areaChart
                startFillColor="#A855F7"
                endFillColor="#A855F7"
                startOpacity={0.35}
                endOpacity={0.01}
                height={150}
                spacing={55}
                initialSpacing={20}
                yAxisColor="transparent"
                xAxisColor="#30363D"
                rulesType="dashed"
                rulesColor="#21262D"
                yAxisTextStyle={{ color: '#8B949E', fontSize: 10 }}
                xAxisLabelTextStyle={{ color: '#8B949E', fontSize: 10 }}
              />
            </View>
          ) : (
            <Text style={styles.emptyText}>Andmed puuduvad</Text>
          )}
        </View>

        {/* Reaalajas Reageeriv Ringdiagramm */}
        <View style={styles.card}>
          <View style={styles.txHeaderRow}>
            <Text style={styles.cardTitle}>
              {isDrilledDown ? `${selectedMainCategory?.text} (Alamkategooriad)` : 'Kulud kategooriate kaupa'}
            </Text>
            {isDrilledDown && (
              <TouchableOpacity onPress={handleResetPie}>
                <Text style={styles.resetText}>‹ Üldvaade</Text>
              </TouchableOpacity>
            )}
          </View>

          {mainPieRaw.length > 0 ? (
            <View style={styles.chartCenterWrapper}>
              <PieChart
                donut
                innerRadius={75}
                radius={98}
                extraRadius={12}
                focuson
                innerCircleColor="#161B22"
                data={isDrilledDown ? displaySubPie : displayMainPie}
                onPress={(item: PieItem) => {
                  if (!isDrilledDown) {
                    handleMainPieSelect(item);
                  } else {
                    handleSubPieSelect(item);
                  }
                }}
                centerLabelComponent={() => (
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                    {!isDrilledDown ? (
                      selectedMainCategory ? (
                        <>
                          <Text style={styles.centerTitle}>{selectedMainCategory.text}</Text>
                          <Text style={styles.centerAmount}>{selectedMainCategory.value.toFixed(2)} €</Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.centerTitle}>Kogukulu</Text>
                          <Text style={styles.centerAmount}>{totalSpent.toFixed(2)} €</Text>
                        </>
                      )
                    ) : (
                      selectedSubCategory ? (
                        <>
                          <Text style={styles.centerTitle}>{selectedSubCategory.text}</Text>
                          <Text style={[styles.centerAmount, { color: '#FF5252' }]}>
                            {selectedSubCategory.value.toFixed(2)} €
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.centerTitle}>{selectedMainCategory?.text}</Text>
                          <Text style={[styles.centerAmount, { color: '#FF5252' }]}>
                            {selectedMainCategory?.value.toFixed(2)} €
                          </Text>
                        </>
                      )
                    )}
                  </View>
                )}
              />

              {/* "Vaata sügavamale" nupp */}
              {!isDrilledDown && selectedMainCategory && (
                <TouchableOpacity style={styles.drillBtn} onPress={handleDrillDown}>
                  <Text style={styles.drillBtnText}>🔍 Vaata sügavamale</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text style={styles.emptyText}>Sellel perioodil kulutehinguid ei ole</Text>
          )}
        </View>

        {/* Tehingute Nimekiri */}
        <View style={styles.card}>
          <View style={styles.txHeaderRow}>
            <Text style={styles.cardTitle}>Tehingute ajalugu</Text>
            <View style={styles.subFilterRow}>
              {(['all', 'expense', 'income'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.subFilterChip, typeFilter === t && styles.subFilterChipActive]}
                  onPress={() => setTypeFilter(t)}
                >
                  <Text style={[styles.subFilterText, typeFilter === t && styles.subFilterTextActive]}>
                    {t === 'all' ? 'Kõik' : t === 'expense' ? 'Kulud' : 'Tulud'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {recentTransactions.length > 0 ? (
            recentTransactions.map((tx) => (
              <View key={tx.id} style={styles.txItem}>
                <View style={[styles.categoryIndicator, { backgroundColor: tx.category_color || '#A855F7' }]} />
                <View style={{ flex: 1, paddingLeft: 12 }}>
                  <Text style={styles.txParty}>{tx.party_name || tx.description || 'Tehing'}</Text>
                  <Text style={styles.txSub}>
                    {tx.date} • {tx.category_name || 'Määramata'}
                  </Text>
                </View>
                <Text style={[styles.txAmount, { color: tx.amount < 0 ? '#FF5252' : '#00E676' }]}>
                  {tx.amount > 0 ? `+${tx.amount.toFixed(2)}` : `${tx.amount.toFixed(2)}`} €
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Ühtegi tehingut ei leitud</Text>
          )}
        </View>

      </ScrollView>

      {/* Lisamise FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setIsAddModalOpen(true)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <AddTransactionModal
        visible={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={loadDashboardData}
      />

      <CustomDatePickerModal
        visible={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        onApply={(start, end) => changeCustomRange({ startDate: start, endDate: end })}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  loadingContainer: { flex: 1, backgroundColor: '#0D1117', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 90 },
  headerCard: { backgroundColor: '#161B22', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#30363D', marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerSubtitle: { color: '#8B949E', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },
  headerBalance: { color: '#C084FC', fontSize: 28, fontWeight: 'bold', marginTop: 2 },
  csvBtn: { backgroundColor: '#A855F7', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  csvBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  filterBar: { flexDirection: 'row', backgroundColor: '#161B22', borderRadius: 12, padding: 4, borderColor: '#30363D', borderWidth: 1, marginBottom: 14 },
  filterTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  filterTabActive: { backgroundColor: '#21262D' },
  filterTabText: { color: '#8B949E', fontSize: 12, fontWeight: '600' },
  filterTabTextActive: { color: '#C084FC', fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  statBox: { flex: 1, backgroundColor: '#161B22', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#30363D', marginHorizontal: 3, alignItems: 'center' },
  statLabel: { color: '#8B949E', fontSize: 11, fontWeight: '600' },
  statValue: { fontSize: 13, fontWeight: 'bold', marginTop: 4 },
  card: { backgroundColor: '#161B22', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#30363D', marginBottom: 16 },
  cardTitle: { color: '#C084FC', fontSize: 15, fontWeight: '600' },
  resetText: { color: '#C084FC', fontSize: 13, fontWeight: 'bold' },
  chartCenterWrapper: { alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  
  // Puhtad ja stabiilsed teksti stiilid ilma hüppavate fontideta
  centerTitle: { color: '#8B949E', fontSize: 12, fontWeight: '500' },
  centerAmount: { color: '#C084FC', fontSize: 20, fontWeight: 'bold', marginTop: 4 },

  drillBtn: { marginTop: 14, backgroundColor: '#21262D', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#A855F7' },
  drillBtnText: { color: '#C084FC', fontSize: 12, fontWeight: 'bold' },
  emptyText: { color: '#8B949E', fontSize: 13, textAlign: 'center', marginVertical: 16 },
  txHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subFilterRow: { flexDirection: 'row' },
  subFilterChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 4 },
  subFilterChipActive: { backgroundColor: '#A855F7' },
  subFilterText: { color: '#8B949E', fontSize: 11 },
  subFilterTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
  txItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#21262D' },
  categoryIndicator: { width: 10, height: 10, borderRadius: 5 },
  txParty: { color: '#F0F6FC', fontSize: 14, fontWeight: '500' },
  txSub: { color: '#8B949E', fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: 'bold' },
  fab: { position: 'absolute', right: 20, bottom: 25, width: 56, height: 56, borderRadius: 28, backgroundColor: '#A855F7', justifyContent: 'center', alignItems: 'center', elevation: 8 },
  fabIcon: { color: '#FFFFFF', fontSize: 32, marginTop: -3 },
});