import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

interface CustomDatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (startDate: Date, endDate: Date) => void;
}

export const CustomDatePickerModal: React.FC<CustomDatePickerModalProps> = ({
  visible,
  onClose,
  onApply,
}) => {
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const monthNames = [
    'Jaanuar', 'Veebruar', 'Märts', 'Aprill', 'Mai', 'Juuni',
    'Juuli', 'August', 'September', 'Oktoober', 'November', 'Detsember'
  ];

  const daysOfWeek = ['E', 'T', 'K', 'N', 'R', 'L', 'P'];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOffset = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const handleDatePress = (day: number) => {
    const selected = new Date(currentYear, currentMonth, day);

    if (!startDate || (startDate && endDate)) {
      setStartDate(selected);
      setEndDate(null);
    } else if (startDate && !endDate) {
      if (selected < startDate) {
        setStartDate(selected);
      } else {
        setEndDate(selected);
      }
    }
  };

  const quickSelectPreset = (preset: '7d' | 'thisMonth' | 'lastMonth') => {
    const now = new Date();
    if (preset === '7d') {
      const start = new Date();
      start.setDate(now.getDate() - 7);
      setStartDate(start);
      setEndDate(now);
    } else if (preset === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(start);
      setEndDate(now);
    } else if (preset === 'lastMonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(start);
      setEndDate(end);
      setCurrentMonth(start.getMonth());
      setCurrentYear(start.getFullYear());
    }
  };

  const isSelectedStart = (day: number) => {
    if (!startDate) return false;
    const d = new Date(currentYear, currentMonth, day);
    return d.toDateString() === startDate.toDateString();
  };

  const isSelectedEnd = (day: number) => {
    if (!endDate) return false;
    const d = new Date(currentYear, currentMonth, day);
    return d.toDateString() === endDate.toDateString();
  };

  const isInRange = (day: number) => {
    if (!startDate || !endDate) return false;
    const d = new Date(currentYear, currentMonth, day);
    return d > startDate && d < endDate;
  };

  const handleConfirm = () => {
    if (startDate && endDate) {
      onApply(startDate, endDate);
      onClose();
    } else if (startDate) {
      onApply(startDate, startDate);
      onClose();
    }
  };

  const daysCount = getDaysInMonth(currentYear, currentMonth);
  const offset = getFirstDayOffset(currentYear, currentMonth);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Vali kuupäeva vahemik</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Kiirvaliku nupud (UX täiendus) */}
          <View style={styles.presetRow}>
            <TouchableOpacity style={styles.presetChip} onPress={() => quickSelectPreset('7d')}>
              <Text style={styles.presetText}>Viimased 7 p</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => quickSelectPreset('thisMonth')}>
              <Text style={styles.presetText}>See kuu</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => quickSelectPreset('lastMonth')}>
              <Text style={styles.presetText}>Eelmine kuu</Text>
            </TouchableOpacity>
          </View>

          {/* Navigeerimine */}
          <View style={styles.navRow}>
            <TouchableOpacity onPress={() => setCurrentMonth((prev) => (prev === 0 ? 11 : prev - 1))}>
              <Text style={styles.navArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthYearText}>
              {monthNames[currentMonth]} {currentYear}
            </Text>
            <TouchableOpacity onPress={() => setCurrentMonth((prev) => (prev === 11 ? 0 : prev + 1))}>
              <Text style={styles.navArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Päevad */}
          <View style={styles.weekHeader}>
            {daysOfWeek.map((d) => (
              <Text key={d} style={styles.weekDayText}>
                {d}
              </Text>
            ))}
          </View>

          {/* Kalendri võrk */}
          <View style={styles.calendarGrid}>
            {Array.from({ length: offset }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.dayCell} />
            ))}

            {Array.from({ length: daysCount }).map((_, i) => {
              const day = i + 1;
              const start = isSelectedStart(day);
              const end = isSelectedEnd(day);
              const inRange = isInRange(day);

              return (
                <TouchableOpacity
                  key={`day-${day}`}
                  style={[
                    styles.dayCell,
                    start && styles.startCell,
                    end && styles.endCell,
                    inRange && styles.inRangeCell,
                  ]}
                  onPress={() => handleDatePress(day)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      (start || end) && styles.selectedDayText,
                      inRange && styles.inRangeDayText,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Jalus */}
          <View style={styles.footer}>
            <Text style={styles.rangeInfoText}>
              {startDate ? startDate.toISOString().split('T')[0] : 'Vali algus'} 
              {'  →  '} 
              {endDate ? endDate.toISOString().split('T')[0] : 'Vali lõpp'}
            </Text>
            <TouchableOpacity style={styles.applyBtn} onPress={handleConfirm}>
              <Text style={styles.applyBtnText}>Rakenda vahemik</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 16 },
  container: { backgroundColor: '#161B22', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#30363D' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: '#F0F6FC', fontSize: 16, fontWeight: 'bold' },
  closeText: { color: '#8B949E', fontSize: 20 },
  presetRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  presetChip: { flex: 1, backgroundColor: '#21262D', paddingVertical: 6, borderRadius: 8, alignItems: 'center', marginHorizontal: 2 },
  presetText: { color: '#C084FC', fontSize: 11, fontWeight: '600' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  navArrow: { color: '#C084FC', fontSize: 24, paddingHorizontal: 12, fontWeight: 'bold' },
  monthYearText: { color: '#F0F6FC', fontSize: 15, fontWeight: '600' },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  weekDayText: { color: '#8B949E', fontSize: 12, fontWeight: 'bold', width: 36, textAlign: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', height: 38, justifyContent: 'center', alignItems: 'center', marginVertical: 2 },
  startCell: { backgroundColor: '#A855F7', borderTopLeftRadius: 18, borderBottomLeftRadius: 18 },
  endCell: { backgroundColor: '#A855F7', borderTopRightRadius: 18, borderBottomRightRadius: 18 },
  inRangeCell: { backgroundColor: '#382353' },
  dayText: { color: '#F0F6FC', fontSize: 13 },
  selectedDayText: { color: '#FFFFFF', fontWeight: 'bold' },
  inRangeDayText: { color: '#E9D5FF' },
  footer: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#21262D', alignItems: 'center' },
  rangeInfoText: { color: '#8B949E', fontSize: 12, marginBottom: 12 },
  applyBtn: { backgroundColor: '#A855F7', paddingVertical: 12, borderRadius: 10, width: '100%', alignItems: 'center' },
  applyBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
});