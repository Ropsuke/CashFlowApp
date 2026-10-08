import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StatusBar, StyleSheet } from 'react-native';
import { initDatabase } from './src/db/db';
import { HomeScreen } from './src/screens/HomeScreen';

export default function App() {
  const [isDbReady, setIsDbReady] = useState<boolean>(false);

  useEffect(() => {
    initDatabase()
      .then(() => setIsDbReady(true))
      .catch((err) => console.error('Rakenduse initsialiseerimise viga:', err));
  }, []);

  if (!isDbReady) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#58A6FF" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0D1117" />
      <HomeScreen />
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0D1117',
    justifyContent: 'center',
    alignItems: 'center',
  },
});