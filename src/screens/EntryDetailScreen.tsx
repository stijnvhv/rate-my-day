import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import DayEntryForm from '../components/DayEntryForm';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EntryDetail'>;

export default function EntryDetailScreen({ route, navigation }: Props) {
  const { date } = route.params;
  return (
    <SafeAreaView style={styles.flex}>
      <DayEntryForm date={date} onSaved={() => navigation.goBack()} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F4F2FA' },
});
