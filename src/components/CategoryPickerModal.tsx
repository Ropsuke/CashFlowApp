import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
} from 'react-native';
import { db } from '../db/db';
import { Category, TransactionType } from '../types';

interface CategoryPickerModalProps {
  visible: boolean;
  type: TransactionType;
  onClose: () => void;
  onSelectCategory: (category: Category) => void;
}

export const CategoryPickerModal: React.FC<CategoryPickerModalProps> = ({
  visible,
  type,
  onClose,
  onSelectCategory,
}) => {
  const [frequentCategories, setFrequentCategories] = useState<Category[]>([]);
  const [mainCategories, setMainCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [selectedParent, setSelectedParent] = useState<Category | null>(null);

  useEffect(() => {
    if (visible) {
      setSelectedParent(null);
      loadCategories();
    }
  }, [visible, type]);

  const loadCategories = async () => {
    // Sagedasemad kategooriad
    const freq = await db.getAllAsync<Category>(
      `SELECT * FROM categories WHERE type = ? ORDER BY use_count DESC LIMIT 8;`,
      [type]
    );
    setFrequentCategories(freq);

    // Peakategooriad (parent_id IS NULL)
    const main = await db.getAllAsync<Category>(
      `SELECT * FROM categories WHERE type = ? AND parent_id IS NULL;`,
      [type]
    );
    setMainCategories(main);
  };

  const handleSelectMain = async (parent: Category) => {
    const subs = await db.getAllAsync<Category>(
      `SELECT * FROM categories WHERE parent_id = ?;`,
      [parent.id]
    );
    if (subs.length > 0) {
      setSubCategories(subs);
      setSelectedParent(parent);
    } else {
      confirmSelection(parent);
    }
  };

  const confirmSelection = async (cat: Category) => {
    // Uuenda kasutatavuse sagedust
    await db.runAsync(`UPDATE categories SET use_count = use_count + 1 WHERE id = ?;`, [cat.id]);
    onSelectCategory(cat);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            {selectedParent ? (
              <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedParent(null)}>
                <Text style={styles.backBtnText}>‹ Tagasi</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.title}>Vali kategooria</Text>
            )}
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {!selectedParent ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Most Frequent / Sagedasemad */}
              {frequentCategories.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>SAGEDASEMAD</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.freqRow}>
                    {frequentCategories.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={styles.freqItem}
                        onPress={() => confirmSelection(cat)}
                      >
                        <View style={[styles.iconCircle, { backgroundColor: cat.color || '#A855F7' }]}>
                          <Text style={styles.iconText}>{cat.name.charAt(0)}</Text>
                        </View>
                        <Text style={styles.freqName} numberOfLines={1}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* All Categories / Kõik peakategooriad */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>KÕIK KATEGOORIAD</Text>
                {mainCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.categoryRow}
                    onPress={() => handleSelectMain(cat)}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: cat.color || '#A855F7' }]}>
                      <Text style={styles.iconText}>{cat.name.charAt(0)}</Text>
                    </View>
                    <Text style={styles.categoryName}>{cat.name}</Text>
                    <Text style={styles.arrowText}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          ) : (
            /* Subcategories View / Alamkategooriad */
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{selectedParent.name.toUpperCase()} ALAMKATEGOORIAD</Text>
                
                {/* Valik: Vali peakategooria ise */}
                <TouchableOpacity
                  style={styles.categoryRow}
                  onPress={() => confirmSelection(selectedParent)}
                >
                  <View style={[styles.iconCircle, { backgroundColor: selectedParent.color || '#A855F7' }]}>
                    <Text style={styles.iconText}>✓</Text>
                  </View>
                  <Text style={[styles.categoryName, { fontWeight: 'bold' }]}>
                    {selectedParent.name} (Üldine)
                  </Text>
                </TouchableOpacity>

                {subCategories.map((sub) => (
                  <TouchableOpacity
                    key={sub.id}
                    style={styles.categoryRow}
                    onPress={() => confirmSelection(sub)}
                  >
                    <View style={[styles.iconCircleSub, { borderColor: sub.color || '#A855F7' }]}>
                      <Text style={[styles.iconTextSub, { color: sub.color || '#A855F7' }]}>
                        {sub.name.charAt(0)}
                      </Text>
                    </View>
                    <Text style={styles.categoryName}>{sub.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  container: { backgroundColor: '#161B22', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: '#F0F6FC', fontSize: 18, fontWeight: 'bold' },
  backBtn: { paddingVertical: 4 },
  backBtnText: { color: '#C084FC', fontSize: 16, fontWeight: 'bold' },
  closeText: { color: '#8B949E', fontSize: 20, fontWeight: 'bold' },
  section: { marginBottom: 20 },
  sectionTitle: { color: '#8B949E', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  freqRow: { flexDirection: 'row' },
  freqItem: { alignItems: 'center', marginRight: 16, width: 68 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  iconText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 },
  freqName: { color: '#F0F6FC', fontSize: 11, textAlign: 'center' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#21262D' },
  categoryName: { flex: 1, color: '#F0F6FC', fontSize: 15, marginLeft: 14 },
  arrowText: { color: '#8B949E', fontSize: 20 },
  iconCircleSub: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  iconTextSub: { fontWeight: 'bold', fontSize: 14 },
});