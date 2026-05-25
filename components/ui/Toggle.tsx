// Powered by OnSpace.AI
import React from 'react';
import { Pressable, View, StyleSheet, Animated } from 'react-native';
import { Colors } from '@/constants/theme';

interface ToggleProps {
  value: boolean;
  onToggle: () => void;
}

export function Toggle({ value, onToggle }: ToggleProps) {
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.track, value ? styles.trackOn : styles.trackOff]}
      hitSlop={8}
    >
      <View style={[styles.thumb, value ? styles.thumbOn : styles.thumbOff]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  trackOn: { backgroundColor: Colors.accent },
  trackOff: { backgroundColor: Colors.bgCardAlt, borderWidth: 1, borderColor: Colors.border },
  thumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
  },
  thumbOn: { alignSelf: 'flex-end' },
  thumbOff: { alignSelf: 'flex-start' },
});
