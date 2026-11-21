import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigator from './TabNavigator';
import EntryDetailScreen from '../screens/EntryDetailScreen';
import { ChallengeScreen } from '../challenge';
import { formatDateNL } from '../utils/date';
import { RootStackParamList } from './types';
import { C } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerShadowVisible: false,
        headerTintColor: C.primary,
        headerTitleStyle: { color: C.ink, fontWeight: '700' },
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen
        name="EntryDetail"
        component={EntryDetailScreen}
        options={({ route }) => ({ title: formatDateNL(route.params.date) })}
      />
      <Stack.Screen name="Challenge" component={ChallengeScreen} options={{ title: '90 dagen challenge' }} />
    </Stack.Navigator>
  );
}
