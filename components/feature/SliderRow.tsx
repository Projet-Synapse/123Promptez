// Powered by OnSpace.AI
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { Colors, Spacing, FontSize } from '@/constants/theme';

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
  format?: (val: number) => string;
}

export function SliderRow({ label, value, min, max, step, onChange, format }: SliderRowProps) {
  const display = format ? format(value) : String(Math.round(value * 100) / 100);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueBadge}>
          <Text style={styles.value}>{display}</Text>
        </View>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={Colors.accent}
        maximumTrackTintColor={Colors.border}
        thumbTintColor={Colors.accent}
        style={{ height: 32 }}
      />
      <View style={styles.minmax}>
        <Text style={styles.minmaxText}>{min}</Text>
        <Text style={styles.minmaxText}>{max}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.8 },
  valueBadge: {
    backgroundColor: Colors.bgCardAlt,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.accent + '55',
  },
  value: { fontSize: FontSize.sm, color: Colors.accent, fontFamily: 'monospace', fontWeight: '600' },
  minmax: { flexDirection: 'row', justifyContent: 'space-between' },
  minmaxText: { fontSize: FontSize.xs, color: Colors.textMuted },
});
