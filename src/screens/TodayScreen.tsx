import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import DayEntryForm from '../components/DayEntryForm';
import { ChallengeButton } from '../challenge';
import PlannerCard from '../components/PlannerCard';
import { C } from '../theme';

export default function TodayScreen() {
  return (
    <SafeAreaView style={styles.flex}>
      <DayEntryForm hero top={<><PlannerCard /><ChallengeButton /></>} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
});
