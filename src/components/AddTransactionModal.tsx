import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { db } from '../db/db';
import { Category, TransactionType } from '../types';
import { CategoryPickerModal } from './CategoryPickerModal';

interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [partyName, setPartyName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const finalAmount = type === 'expense' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
    const dateStr = new Date().toISOString().split('T')[0];
    const rawHash = `manual_${Date.now()}_${Math.random()}`;

    const account = await db.getFirstAsync<{ id: number }>('SELECT id FROM accounts LIMIT 1;');
    const accountId = account ? account.id : 1;

    await db.runAsync(
      `INSERT INTO transactions (date, amount, type, description, party_name, category_id, account_id, needs_review, raw_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?);`,
      [dateStr, finalAmount, type, description, partyName, selectedCategory?.id || null, accountId, rawHash]
    );

    await db.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?;', [finalAmount, accountId]);

    setAmount('');
    setPartyName('');
    setDescription('');
    setSelectedCategory(null);
    onSuccess();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        {/* Header Tabs */}
        <View style={styles.tabHeader}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, type === 'income' && styles.activeTab]}
              onPress={() => setType('income')}
            >
              <Text style={[styles.tabText, type === 'income' && styles.activeTabText]}>TULU</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, type === 'expense' && styles.activeTab]}
              onPress={() => setType('expense')}
            >
              <Text style={[styles.tabText, type === 'expense' && styles.activeTabText]}>KULU</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.saveHeaderBtn} onPress={handleSave}>
            <Text style={styles.saveHeaderBtnText}>✓</Text>
          </TouchableOpacity>
        </View>

        {/* Display Amount Box */}
        <View style={styles.amountBox}>
          <Text style={styles.amountSign}>{type === 'expense' ? '-' : '+'}</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0"
            placeholderTextColor="#8B949E"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            autoFocus
          />
          <Text style={styles.currencyText}>EUR</Text>
        </View>

        {/* Action Selectors */}
        <View style={styles.selectorRow}>
          <TouchableOpacity style={styles.selectorBtn}>
            <Text style={styles.selectorLabel}>KONTO</Text>
            <Text style={styles.selectorValue}>SEB Arvelduskonto</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.selectorBtn}
            onPress={() => setIsCategoryPickerOpen(true)}
          >
            <Text style={styles.selectorLabel}>KATEGOORIA</Text>
            <Text style={[styles.selectorValue, selectedCategory && { color: selectedCategory.color || '#C084FC' }]}>
              {selectedCategory ? selectedCategory.name : 'Vali kategooria ›'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Additional Inputs */}
        <View style={styles.formPadding}>
          <TextInput
            style={styles.input}
            placeholder="Saaja / Maksja nimi"
            placeholderTextColor="#8B949E"
            value={partyName}
            onChangeText={setPartyName}
          />
          <TextInput
            style={styles.input}
            placeholder="Selgitus (valikuline)"
            placeholderTextColor="#8B949E"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {/* Category Picker Modal */}
        <CategoryPickerModal
          visible={isCategoryPickerOpen}
          type={type}
          onClose={() => setIsCategoryPickerOpen(false)}
          onSelectCategory={(cat) => setSelectedCategory(cat)}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  tabHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  closeBtn: { padding: 8 },
  closeBtnText: { color: '#8B949E', fontSize: 22 },
  saveHeaderBtn: { padding: 8 },
  saveHeaderBtnText: { color: '#A855F7', fontSize: 24, fontWeight: 'bold' },
  tabs: { flexDirection: 'row', backgroundColor: '#161B22', borderRadius: 10, padding: 2 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  activeTab: { backgroundColor: '#A855F7' },
  tabText: { color: '#8B949E', fontWeight: 'bold', fontSize: 12 },
  activeTabText: { color: '#FFFFFF' },
  amountBox: { backgroundColor: '#161B22', paddingVertical: 30, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  amountSign: { color: '#F0F6FC', fontSize: 36, fontWeight: '300', marginRight: 10 },
  amountInput: { color: '#F0F6FC', fontSize: 48, fontWeight: 'bold', minWidth: 100, textAlign: 'center' },
  currencyText: { color: '#8B949E', fontSize: 20, marginLeft: 10, fontWeight: 'bold' },
  selectorRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#21262D' },
  selectorBtn: { flex: 1, backgroundColor: '#161B22', padding: 16, borderWidth: 0.5, borderColor: '#21262D', alignItems: 'center' },
  selectorLabel: { color: '#8B949E', fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  selectorValue: { color: '#F0F6FC', fontSize: 13, fontWeight: '600' },
  formPadding: { padding: 20 },
  input: { backgroundColor: '#161B22', color: '#F0F6FC', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#30363D', marginBottom: 14 },
});