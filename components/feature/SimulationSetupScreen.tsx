/**
 * Page de création Simulation (avant le chat) — worldbuilding + persona.
 * Mobile-first ; usable aussi sur desktop.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, Image, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useAlert } from '@/template';
import {
  type SimulationData,
  type SimulationPersona,
  emptyPersona,
  emptySimulationData,
  normalizeSimulationData,
} from '@/types/simulation';

const ACCENT = '#9B59B6';

interface Props {
  initial: SimulationData | undefined;
  workspaceName: string;
  onCancel?: () => void;
  onComplete: (data: SimulationData) => void;
}

function Field({
  label, value, onChange, placeholder, multiline, minHeight,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; multiline?: boolean; minHeight?: number;
}) {
  const C = useThemeColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: FontSize.xs, fontWeight: '700', color: C.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{
          backgroundColor: C.bgCardAlt,
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm + 2,
          color: C.textPrimary,
          fontSize: FontSize.body,
          minHeight: minHeight ?? (multiline ? 96 : 44),
          lineHeight: multiline ? 22 : undefined,
        }}
      />
    </View>
  );
}

function AvatarBubble({
  uri, size = 88, onPress, fallbackIcon = 'public',
}: {
  uri?: string; size?: number; onPress: () => void; fallbackIcon?: React.ComponentProps<typeof MaterialIcons>['name'];
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Changer l'image"
      style={({ pressed }) => [{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: ACCENT + '28',
        borderWidth: 2, borderColor: ACCENT + '88',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }, pressed && { opacity: 0.85 }]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <MaterialIcons name={fallbackIcon} size={size * 0.4} color={ACCENT} />
      )}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 4,
        alignItems: 'center',
      }}>
        <MaterialIcons name="photo-camera" size={14} color="#fff" />
      </View>
    </Pressable>
  );
}

export default function SimulationSetupScreen({ initial, workspaceName, onCancel, onComplete }: Props) {
  const C = useThemeColors();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const seed = useMemo(() => normalizeSimulationData(initial ?? emptySimulationData()), [initial]);

  const [iconUri, setIconUri] = useState(seed.world.iconUri);
  const [introduction, setIntroduction] = useState(seed.world.introduction);
  const [welcomeMessage, setWelcomeMessage] = useState(seed.world.welcomeMessage);
  const [backgroundContext, setBackgroundContext] = useState(seed.world.backgroundContext);
  const [rules, setRules] = useState(seed.world.rules ?? '');
  const [title, setTitle] = useState(seed.world.title);

  const [personas, setPersonas] = useState<SimulationPersona[]>(seed.personas);
  const [activePersonaId, setActivePersonaId] = useState(seed.activePersonaId ?? seed.personas[0]?.id);

  const activePersona = personas.find((p) => p.id === activePersonaId) ?? personas[0];

  const patchPersona = (id: string, patch: Partial<SimulationPersona>) => {
    setPersonas((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const pickImage = async (target: 'world' | 'persona') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission requise', "L'accès à la galerie est nécessaire pour choisir une image.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const uri = asset.base64
        ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
        : asset.uri;
      if (target === 'world') setIconUri(uri);
      else if (activePersona) patchPersona(activePersona.id, { avatarUri: uri });
    } catch (e: any) {
      showAlert('Erreur', e?.message ?? "Impossible d'importer l'image");
    }
  };

  const addPersona = () => {
    const p = emptyPersona({ name: `Persona ${personas.length + 1}` });
    setPersonas((prev) => [...prev, p]);
    setActivePersonaId(p.id);
  };

  const removePersona = (id: string) => {
    if (personas.length <= 1) {
      showAlert('Impossible', 'Il faut au moins un persona.');
      return;
    }
    showAlert('Supprimer ce persona ?', '', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: () => {
          const next = personas.filter((p) => p.id !== id);
          setPersonas(next);
          if (activePersonaId === id) setActivePersonaId(next[0].id);
        },
      },
    ]);
  };

  const handleStart = () => {
    const resolvedTitle =
      title.trim() ||
      introduction.trim().slice(0, 48) ||
      'Nouvelle simulation';
    const data = normalizeSimulationData({
      ...seed,
      world: {
        ...seed.world,
        title: resolvedTitle,
        iconUri,
        introduction,
        welcomeMessage,
        backgroundContext,
        rules,
      },
      personas: personas.map((p) => ({
        ...p,
        name: p.name.trim() || p.identity.trim().slice(0, 32) || 'Persona',
      })),
      activePersonaId,
      setupComplete: true,
    });
    onComplete(data);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.lg,
          paddingBottom: insets.bottom + 100,
          gap: Spacing.lg,
          maxWidth: 560,
          width: '100%',
          alignSelf: 'center',
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: FontSize.xs, color: ACCENT, fontWeight: '700', letterSpacing: 0.6 }}>
            SIMULATION · {workspaceName}
          </Text>
          <Text style={{ fontSize: FontSize.xl, fontWeight: '800', color: C.textPrimary }}>
            Créer ton monde
          </Text>
          <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, lineHeight: 20 }}>
            Avant le chat : pose le décor, le message d’accueil, puis ton persona joueur.
          </Text>
        </View>

        {/* Icône monde */}
        <View style={{ alignItems: 'center', gap: Spacing.sm }}>
          <AvatarBubble uri={iconUri} onPress={() => void pickImage('world')} fallbackIcon="public" />
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>Icône du monde — appuie pour importer</Text>
        </View>

        <Field
          label="Titre (optionnel)"
          value={title}
          onChange={setTitle}
          placeholder="Ex. L’Enchanteresse — Livre I"
        />
        <Field
          label="Introduction"
          value={introduction}
          onChange={setIntroduction}
          placeholder="Le contexte primordial de l’histoire…"
          multiline
          minHeight={88}
        />
        <Field
          label="Message de bienvenue"
          value={welcomeMessage}
          onChange={setWelcomeMessage}
          placeholder="Le premier message immersif que verra le joueur…"
          multiline
          minHeight={120}
        />
        <Field
          label="Contexte d’arrière-plan"
          value={backgroundContext}
          onChange={setBackgroundContext}
          placeholder="Monde, lieux, personnages importants…"
          multiline
          minHeight={160}
        />
        <Field
          label="Règles du roleplay"
          value={rules}
          onChange={setRules}
          placeholder="Ce que l’IA doit respecter absolument (ton, limites, style, interdits…) — priorité maximale."
          multiline
          minHeight={140}
        />

        {/* Personas */}
        <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: FontSize.md, fontWeight: '700', color: C.textPrimary }}>
              Ton persona
            </Text>
            <Pressable
              onPress={addPersona}
              style={({ pressed }) => [{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill,
                backgroundColor: ACCENT + '22', borderWidth: 1, borderColor: ACCENT + '55',
              }, pressed && { opacity: 0.8 }]}
            >
              <MaterialIcons name="person-add" size={14} color={ACCENT} />
              <Text style={{ fontSize: FontSize.xs, fontWeight: '700', color: ACCENT }}>Ajouter</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
            {personas.map((p) => {
              const active = p.id === activePersona?.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setActivePersonaId(p.id)}
                  onLongPress={() => removePersona(p.id)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill,
                    borderWidth: 1,
                    borderColor: active ? ACCENT : C.border,
                    backgroundColor: active ? ACCENT + '22' : C.bgCardAlt,
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                  }}
                >
                  {p.avatarUri ? (
                    <Image source={{ uri: p.avatarUri }} style={{ width: 20, height: 20, borderRadius: 10 }} />
                  ) : (
                    <MaterialIcons name="person" size={16} color={active ? ACCENT : C.textMuted} />
                  )}
                  <Text style={{ fontSize: FontSize.xs, fontWeight: '700', color: active ? ACCENT : C.textSecondary }}>
                    {p.name || 'Persona'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {activePersona ? (
            <View style={{
              gap: Spacing.md, backgroundColor: C.bgCard, borderRadius: Radius.lg,
              padding: Spacing.md, borderWidth: 1, borderColor: C.border,
            }}>
              <View style={{ alignItems: 'center', gap: Spacing.sm }}>
                <AvatarBubble
                  uri={activePersona.avatarUri}
                  size={72}
                  onPress={() => void pickImage('persona')}
                  fallbackIcon="person"
                />
              </View>
              <Field
                label="Nom du persona"
                value={activePersona.name}
                onChange={(v) => patchPersona(activePersona.id, { name: v })}
                placeholder="Ex. Lyra"
              />
              <Field
                label="Identité"
                value={activePersona.identity}
                onChange={(v) => patchPersona(activePersona.id, { identity: v })}
                placeholder="Qui es-tu dans cette histoire ?"
                multiline
              />
              <Field
                label="Physique"
                value={activePersona.physique}
                onChange={(v) => patchPersona(activePersona.id, { physique: v })}
                placeholder="Apparence, voix, présence…"
                multiline
              />
              <Field
                label="Personnalité"
                value={activePersona.personality}
                onChange={(v) => patchPersona(activePersona.id, { personality: v })}
                placeholder="Traits, défauts, forces…"
                multiline
              />
              <Field
                label="Goûts"
                value={activePersona.tastes}
                onChange={(v) => patchPersona(activePersona.id, { tastes: v })}
                placeholder="Ce que tu aimes, détestes, recherches…"
                multiline
              />
              <Field
                label="Arrière-plan"
                value={activePersona.background}
                onChange={(v) => patchPersona(activePersona.id, { background: v })}
                placeholder="Le reste : histoire, secrets, liens…"
                multiline
                minHeight={120}
              />
              {personas.length > 1 ? (
                <Pressable onPress={() => removePersona(activePersona.id)} style={{ alignSelf: 'center', padding: 8 }}>
                  <Text style={{ color: C.error, fontSize: FontSize.xs, fontWeight: '600' }}>Supprimer ce persona</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Barre d’actions */}
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm,
        paddingBottom: Math.max(insets.bottom, Spacing.md),
        backgroundColor: C.bg,
        borderTopWidth: 1, borderTopColor: C.border,
        flexDirection: 'row', gap: Spacing.sm,
        ...(Platform.OS === 'web' ? { maxWidth: 560, alignSelf: 'center', width: '100%' } : null),
      }}>
        {onCancel ? (
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [{
              flex: 1, paddingVertical: 14, borderRadius: Radius.md,
              alignItems: 'center', borderWidth: 1, borderColor: C.border, backgroundColor: C.bgCardAlt,
            }, pressed && { opacity: 0.8 }]}
          >
            <Text style={{ color: C.textSecondary, fontWeight: '700' }}>Plus tard</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={handleStart}
          style={({ pressed }) => [{
            flex: 2, paddingVertical: 14, borderRadius: Radius.md,
            alignItems: 'center', backgroundColor: ACCENT,
            flexDirection: 'row', justifyContent: 'center', gap: 8,
          }, pressed && { opacity: 0.9 }]}
        >
          <MaterialIcons name="play-arrow" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: FontSize.body }}>Commencer</Text>
        </Pressable>
      </View>
    </View>
  );
}
