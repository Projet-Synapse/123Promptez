// Theme fix: inline styles with useThemeColors()
import React from 'react';
import { View, Text } from 'react-native';
import Slider from '@react-native-community/slider';
import { Spacing, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

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
  const C = useThemeColors();
  const display = format ? format(value) : String(Math.round(value * 100) / 100);
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</Text>
        <View style={{ backgroundColor: C.bgCardAlt, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: C.accent + '55' }}>
          <Text style={{ fontSize: FontSize.sm, color: C.accent, fontFamily: 'monospace', fontWeight: '600' }}>{display}</Text>
        </View>
      </View>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={C.accent}
        maximumTrackTintColor={C.border}
        thumbTintColor={C.accent}
        style={{ height: 32 }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{min}</Text>
        <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{max}</Text>
      </View>
    </View>
  );
}
