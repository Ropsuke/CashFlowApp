import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PeriodType, DateRange } from '../types';

const STORAGE_KEY = '@user_period_filter_v1';
const CUSTOM_RANGE_KEY = '@user_custom_date_range_v1';

export const usePeriodFilter = () => {
  const [period, setPeriod] = useState<PeriodType>('1m');
  const [customRange, setCustomRange] = useState<DateRange>({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    endDate: new Date(),
  });
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const loadSavedState = async () => {
      try {
        const savedPeriod = await AsyncStorage.getItem(STORAGE_KEY);
        const savedCustomRange = await AsyncStorage.getItem(CUSTOM_RANGE_KEY);

        if (isMounted) {
          if (savedPeriod) {
            setPeriod(savedPeriod as PeriodType);
          }
          if (savedCustomRange) {
            const parsed = JSON.parse(savedCustomRange);
            setCustomRange({
              startDate: new Date(parsed.startDate),
              endDate: new Date(parsed.endDate),
            });
          }
        }
      } catch (e) {
        console.error('Perioodifiltri laadimise viga:', e);
      } finally {
        if (isMounted) setIsReady(true);
      }
    };

    loadSavedState();
    return () => { isMounted = false; };
  }, []);

  const changePeriod = useCallback(async (newPeriod: PeriodType) => {
    setPeriod(newPeriod);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newPeriod);
    } catch (e) {
      console.error('Perioodifiltri salvestamise viga:', e);
    }
  }, []);

  const changeCustomRange = useCallback(async (range: DateRange) => {
    setCustomRange(range);
    setPeriod('custom');
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'custom');
      await AsyncStorage.setItem(CUSTOM_RANGE_KEY, JSON.stringify({
        startDate: range.startDate.toISOString(),
        endDate: range.endDate.toISOString(),
      }));
    } catch (e) {
      console.error('Kuupäevavahemiku salvestamise viga:', e);
    }
  }, []);

  const getDateRange = useCallback((): DateRange => {
    const now = new Date();
    if (period === 'custom') return customRange;

    const start = new Date();
    if (period === '1m') {
      start.setMonth(now.getMonth() - 1);
    } else if (period === '3m') {
      start.setMonth(now.getMonth() - 3);
    } else if (period === '1y') {
      start.setFullYear(now.getFullYear() - 1);
    } else if (period === 'all') {
      start.setTime(0);
    }

    return { startDate: start, endDate: now };
  }, [period, customRange]);

  return {
    period,
    changePeriod,
    customRange,
    changeCustomRange,
    getDateRange,
    isReady,
  };
};