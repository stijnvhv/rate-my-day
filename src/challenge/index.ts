import * as React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as nav from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as entryStore from '../storage/entriesStorage';
import * as dates from '../utils/date';
import * as score from '../utils/score';
import installChallenge from './challengeModule';

// Zelfde volgorde als de oude bundel-injectie (zie challengeModule.js, kopcommentaar).
const deps = [React, StyleSheet, Text, View, ScrollView, nav, TextInput, TouchableOpacity, AsyncStorage, entryStore, dates, score, SafeAreaView];
const mod: any = {};
installChallenge((x: unknown) => x, deps, mod);

export const ChallengeScreen: React.ComponentType = mod.default;
export const ChallengeButton: React.ComponentType = mod.ChallengeButton;
