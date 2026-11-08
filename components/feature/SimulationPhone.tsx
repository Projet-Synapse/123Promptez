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

export type PhoneAppId = 'messages' | 'photos' | 'contacts' | 'clock';
const APPS: { id: PhoneAppId; label: string; icon: string; color: string }[] = [
  { id: 'messages', label: 'Messages', icon: 'sms', color: '#34C759' },
  { id: 'contacts', label: 'Contacts', icon: 'contacts', color: '#8E8E93' },
  { id: 'photos', label: 'Photos', icon: 'photo-library', color: '#FF9F0A' },
  { id: 'clock', label: 'Horloge', icon: 'schedule', color: '#1C1C1E' },
];

/** Écran d’accueil : grille de mini-applis (Photos seulement si l’album est actif). */
export function PhoneHomeScreen({ content, albumEnabled, onOpenApp }: {
  content: SimulationFeatureContent; albumEnabled: boolean; onOpenApp: (id: PhoneAppId) => void;
}) {
  const unread = content.messages.filter((m) => !m.read).length;
  const apps = APPS.filter((a) => a.id !== 'photos' || albumEnabled);
  return (
    <View style={{ flex: 1, backgroundColor: '#3a2357', paddingTop: 24, paddingHorizontal: 18 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
        {apps.map((a) => (
          <Pressable key={a.id} onPress={() => onOpenApp(a.id)} accessibilityLabel={a.label} style={{ width: 62, alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: a.color, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name={a.icon as any} size={30} color="#fff" />
              {a.id === 'messages' && unread ? (
                <View style={{ position: 'absolute', top: -5, right: -5, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{unread}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color: '#fff', fontSize: 11, marginTop: 4 }} numberOfLines={1}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Mini-applis simples : Contacts et Horloge. */
export function PhoneSimpleApp({ app, clock, content, onBack }: { app: 'contacts' | 'clock'; clock?: string; content: SimulationFeatureContent; onBack: () => void }) {
  const d = parseClock(clock);
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Pressable onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }}>
        <MaterialIcons name="chevron-left" size={22} color="#007AFF" />
        <Text style={{ color: '#007AFF', fontSize: 15 }}>Accueil</Text>
      </Pressable>
      {app === 'clock' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 56, fontWeight: '200', color: '#000' }}>{d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '--:--'}</Text>
          <Text style={{ color: '#555' }}>{d ? `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : ''}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 14 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#000', marginBottom: 8 }}>Contacts</Text>
          {content.personaNumber ? <Text style={{ color: '#555', marginBottom: 8 }}>Mon numéro : {content.personaNumber}</Text> : null}
          {content.contacts.map((c) => (
            <View key={c.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
              <Text style={{ fontSize: 16, color: '#000' }}>{c.name}</Text>
              {c.number ? <Text style={{ color: '#888', fontSize: 12 }}>{c.number}</Text> : null}
            </View>
          ))}
          {!content.contacts.length ? <Text style={{ color: '#888' }}>Aucun contact pour l’instant.</Text> : null}
        </ScrollView>
      )}
    </View>
  );
}
