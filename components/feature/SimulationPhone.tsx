import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { parseClock } from '@/types/simulationClock';
import type { SimulationFeatureContent } from '@/types/simulationFeatureContent';

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const pad = (n: number) => String(n).padStart(2, '0');

export function senderLabel(m: { from: string; unknownSender?: boolean; fromNumber?: string }): string {
  return m.unknownSender ? (m.fromNumber ? `Numéro inconnu (${m.fromNumber})` : 'Numéro inconnu') : m.from;
}

/** Cadre de « petit téléphone » : coque, encoche, barre d’état. */
export function PhoneFrame({ clock, children, onClose }: { clock?: string; children: React.ReactNode; onClose: () => void }) {
  const d = parseClock(clock);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <View style={{ width: '100%', maxWidth: 360, aspectRatio: 9 / 18.5, maxHeight: '100%', borderRadius: 40, borderWidth: 6, borderColor: '#1c1c1e', backgroundColor: '#000', overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 10, height: 34 }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '--:--'}</Text>
          <View style={{ width: 80, height: 20, borderRadius: 10, backgroundColor: '#1c1c1e' }} />
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <MaterialIcons name="signal-cellular-alt" size={13} color="#fff" />
            <MaterialIcons name="battery-full" size={13} color="#fff" />
          </View>
        </View>
        <View style={{ flex: 1 }}>{children}</View>
        <Pressable onPress={onClose} accessibilityLabel="Ranger le téléphone" style={{ alignItems: 'center', paddingVertical: 10 }}>
          <View style={{ width: 110, height: 5, borderRadius: 3, backgroundColor: '#ffffffaa' }} />
        </Pressable>
      </View>
    </View>
  );
}

/** Écran de verrouillage : heure / date du jeu + notifications non lues. */
export function PhoneLockScreen({ clock, content, onUnlock }: { clock?: string; content: SimulationFeatureContent; onUnlock: () => void }) {
  const d = parseClock(clock);
  const unread = content.messages.filter((m) => !m.read);
  return (
    <View style={{ flex: 1, backgroundColor: '#2b1a3d' }}>
      <View style={{ alignItems: 'center', marginTop: 28 }}>
        <MaterialIcons name="lock" size={16} color="#ffffffcc" />
        <Text style={{ color: '#fff', fontSize: 15, marginTop: 6 }}>
          {d ? `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}` : ''}
        </Text>
        <Text style={{ color: '#fff', fontSize: 64, fontWeight: '200', lineHeight: 72 }}>
          {d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '--:--'}
        </Text>
      </View>
      <ScrollView style={{ flex: 1, marginTop: 12 }} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        {unread.map((m) => (
          <Pressable key={m.id} onPress={onUnlock} style={{ backgroundColor: '#ffffff26', borderRadius: 16, padding: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="sms" size={14} color="#7CFC9A" />
              <Text style={{ color: '#ffffffcc', fontSize: 11, flex: 1 }}>MESSAGES</Text>
            </View>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, marginTop: 2 }}>{senderLabel(m)}</Text>
            <Text style={{ color: '#fff', fontSize: 13 }} numberOfLines={2}>{m.content || '—'}</Text>
          </Pressable>
        ))}
        {!unread.length ? <Text style={{ color: '#ffffff88', textAlign: 'center', fontSize: 12 }}>Aucune notification</Text> : null}
      </ScrollView>
      <Pressable onPress={onUnlock} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 14 }}>
        <Text style={{ color: '#ffffffcc', fontSize: 13 }}>Appuyer pour déverrouiller</Text>
      </Pressable>
    </View>
  );
}
