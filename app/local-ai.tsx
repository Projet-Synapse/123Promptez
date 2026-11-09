// Studio IA locale — gestion complète d'Ollama sans terminal.
// Modèles installés, téléchargement avec progression, suppression, modèles
// chargés en mémoire, création d'un modèle personnalisé (personnalité gravée).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ThemedInput, IconButton } from '@/components';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useBot } from '@/hooks/useBot';
import { useToast } from '@/contexts/ToastContext';
import {
  listDetailedModels, listRunningModels, ollamaVersion,
  pullModel, deleteModel, createCustomModel,
  type OllamaDetailedModel, type OllamaRunningModel,
} from '@/services/ollamaService';

const SUGGESTIONS = [
  { id: 'qwen2.5:7b', desc: '7B · polyvalent, bon français, outils (4,7 Go)' },
  { id: 'qwen2.5:3b', desc: '3B · très rapide, idéal mobile/PC modeste (1,9 Go)' },
  { id: 'llama3.1:8b', desc: '8B · Meta, polyvalent (4,7 Go)' },
  { id: 'mistral:7b', desc: '7B · Mistral, concis et rapide (4,1 Go)' },
];

const fmtGo = (bytes: number) => `${(bytes / 1e9).toFixed(1)} Go`;

export default function LocalAIStudioScreen() {
  const C = useThemeColors();
  const router = useRouter();
  const { bot, updateLLMConfig } = useBot();
  const { showToast } = useToast();

  const [version, setVersion] = useState<string | null>(null);
  const [local, setLocal] = useState<OllamaDetailedModel[]>([]);
  const [cloud, setCloud] = useState<OllamaDetailedModel[]>([]);
  const [running, setRunning] = useState<OllamaRunningModel[]>([]);
  const [unreachable, setUnreachable] = useState(false);
  const [pullName, setPullName] = useState('');
  const [pullStatus, setPullStatus] = useState<{ status: string; percent: number | null } | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('mon-assistant');
  const [baseModel, setBaseModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const pullAbortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    const [det, run, ver] = await Promise.all([
      listDetailedModels(), listRunningModels(), ollamaVersion(),
    ]);
    setVersion(ver);
    if (det) { setLocal(det.local); setCloud(det.cloud); setUnreachable(false); }
    else setUnreachable(true);
    setRunning(run);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  // Rafraîchit l'état mémoire toutes les 10 s (modèle chargé / déchargé)
  useEffect(() => {
    const iv = setInterval(() => { void listRunningModels().then(setRunning); }, 10000);
    return () => clearInterval(iv);
  }, []);

  const startPull = async (model: string) => {
    if (!model.trim() || pullStatus) return;
    setPullError(null);
    setPullStatus({ status: 'préparation…', percent: 0 });
    const ctrl = new AbortController();
    pullAbortRef.current = ctrl;
    const result = await pullModel(model.trim(), (p) => setPullStatus(p), ctrl.signal);
    pullAbortRef.current = null;
    if (result.ok) {
      showToast(`Modèle « ${model.trim()} » installé ✓`, { tone: 'success' });
      setPullStatus(null);
      setPullName('');
      void refresh();
    } else {
      setPullStatus(null);
      setPullError(result.error ?? 'échec');
    }
  };

  const removeModel = (model: string) => {
    Alert.alert(
      'Supprimer ce modèle ?',
      `« ${model} » sera retiré du disque (l'espace sera libéré). Il pourra être retéléchargé.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => {
          void deleteModel(model).then((r) => {
            if (r.ok) { showToast(`« ${model} » supprimé`, { tone: 'success' }); void refresh(); }
            else showToast(`Échec : ${r.error ?? 'inconnu'}`, { tone: 'error' });
          });
        }},
      ],
    );
  };

  const makeCustom = async () => {
    const name = newName.trim().replace(/\s+/g, '-').toLowerCase();
    const base = baseModel.trim() || local[0]?.name;
    if (!name || !base || !systemPrompt.trim()) {
      showToast('Nom, modèle de base et personnalité requis', { tone: 'error' });
      return;
    }
    setCreating(true);
    const result = await createCustomModel(name, base, systemPrompt.trim(), (status) => setPullStatus({ status, percent: null }));
    setCreating(false);
    setPullStatus(null);
    if (result.ok) {
      showToast(`Modèle « ${name} » créé ✓`, { tone: 'success' });
      setSystemPrompt('');
      void refresh();
    } else {
      showToast(`Échec : ${result.error ?? 'inconnu'}`, { tone: 'error' });
    }
  };

  const discuterAvec = (model: string) => {
    updateLLMConfig({ model: `ollama:${model}` });
    showToast(`Le chat utilise maintenant « ${model} »`, { tone: 'success' });
    router.replace('/chat');
  };

  const Card = ({ children, accent }: { children: React.ReactNode; accent?: string }) => (
    <View style={{ backgroundColor: C.bgCard, borderRadius: 16, borderWidth: 1, borderColor: accent ? accent + '55' : C.border, padding: Spacing.md, gap: Spacing.sm }}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      {/* En-tête */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <IconButton icon="arrow-back" label="Retour" onPress={() => router.back()} bare size={22} color={C.textPrimary} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: C.textPrimary }}>Studio IA locale</Text>
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            {version ? `Ollama v${version} · 127.0.0.1:11434` : 'Connexion à Ollama…'}
          </Text>
        </View>
        <IconButton icon="refresh" label="Rafraîchir" onPress={() => void refresh()} bare size={20} color={C.textSecondary} />
      </View>

      {unreachable ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl }}>
          <MaterialIcons name="cloud-off" size={44} color={C.textMuted} />
          <Text style={{ fontSize: 15, color: C.textSecondary, textAlign: 'center', lineHeight: 22 }}>
            Ollama ne répond pas sur ce PC. Lancez-le (icône du lama dans la barre des tâches) puis touchez « Rafraîchir ».
          </Text>
          <Pressable onPress={() => void refresh()} style={{ backgroundColor: C.accentGlow, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
            <Text style={{ color: C.accent, fontWeight: '700' }}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {/* Modèles chargés en mémoire */}
          {running.length > 0 ? (
            <Card accent="#7ee787">
              <Text style={{ fontSize: 11, color: '#7ee787', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>En mémoire maintenant</Text>
              {running.map(r => (
                <View key={r.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 }}>
                  <MaterialIcons name="memory" size={14} color="#7ee787" />
                  <Text style={{ flex: 1, fontSize: 13, color: C.textPrimary }}>{r.name}</Text>
                  <Text style={{ fontSize: 11, color: C.textMuted }}>{fmtGo(r.vramBytes)} en VRAM · libéré dans {r.expiresInSeconds ? Math.ceil(r.expiresInSeconds / 60) : '?'} min</Text>
                </View>
              ))}
            </Card>
          ) : null}

          {/* Modèles locaux installés */}
          <Card>
            <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Modèles locaux installés ({local.length})</Text>
            {local.length === 0 ? (
              <Text style={{ fontSize: 13, color: C.textMuted }}>Aucun modèle local. Téléchargez-en un ci-dessous.</Text>
            ) : local.map(model => {
              const isChatModel = bot.llmConfig.model === `ollama:${model.name}`;
              return (
                <View key={model.name} style={{ backgroundColor: C.bgCardAlt, borderRadius: 12, padding: Spacing.sm + 2, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ flex: 1, fontSize: 14, color: C.textPrimary, fontWeight: '700' }}>{model.name}</Text>
                    <Text style={{ fontSize: 11, color: C.textMuted }}>{fmtGo(model.sizeBytes)} · {model.parameterSize ?? '?'} · {model.quantization ?? '?'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    <Pressable onPress={() => discuterAvec(model.name)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isChatModel ? '#7ee78722' : C.accentGlow, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }, pressed && { opacity: 0.7 }]}>
                      <MaterialIcons name={isChatModel ? 'check-circle' : 'chat'} size={12} color={isChatModel ? '#7ee787' : C.accent} />
                      <Text style={{ fontSize: 11, color: isChatModel ? '#7ee787' : C.accent, fontWeight: '700' }}>{isChatModel ? 'modèle du chat ✓' : 'Discuter'}</Text>
                    </Pressable>
                    <Pressable onPress={() => removeModel(model.name)} accessibilityLabel={`Supprimer ${model.name}`} style={{ backgroundColor: C.error + '18', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <MaterialIcons name="delete-outline" size={12} color={C.error} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </Card>

          {/* Télécharger un modèle */}
          <Card>
            <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Télécharger un modèle</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput
                value={pullName}
                onChangeText={setPullName}
                placeholder="ex. qwen3:8b"
                placeholderTextColor={C.textMuted}
                autoCapitalize="none" autoCorrect={false}
                style={{ flex: 1, color: C.textPrimary, fontSize: 14, padding: 10, borderWidth: 1, borderColor: C.border, borderRadius: 10, backgroundColor: C.bgCardAlt }}
              />
              <Pressable
                disabled={!pullName.trim() || !!pullStatus}
                onPress={() => void startPull(pullName.trim())}
                style={{ backgroundColor: pullName.trim() && !pullStatus ? C.accent : C.bgCardAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}
              >
                {pullStatus ? <ActivityIndicator size="small" color={C.accent} /> : <MaterialIcons name="download" size={16} color={pullName.trim() && !pullStatus ? C.bg : C.textMuted} />}
              </Pressable>
            </View>
            <View style={{ gap: 6 }}>
              {SUGGESTIONS.map(s => (
                <Pressable key={s.id} disabled={!!pullStatus} onPress={() => setPullName(s.id)} style={{ backgroundColor: C.bgCardAlt, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }}>
                  <Text style={{ fontSize: 12, color: C.textSecondary }}><Text style={{ fontWeight: '700', color: C.textPrimary }}>{s.id}</Text> — {s.desc}</Text>
                </Pressable>
              ))}
            </View>
            {pullStatus ? (
              <View style={{ backgroundColor: C.bgCardAlt, borderRadius: 10, padding: Spacing.sm, gap: 6 }}>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: C.bg, overflow: 'hidden' }}>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: C.accent, width: `${pullStatus.percent ?? 5}%` }} />
                </View>
                <Text style={{ fontSize: 11, color: C.textSecondary }}>
                  {pullStatus.percent != null ? `${pullStatus.percent} % — ` : ''}{pullStatus.status}
                </Text>
                <Pressable onPress={() => { pullAbortRef.current?.abort(); }} accessibilityLabel="Annuler le téléchargement">
                  <Text style={{ fontSize: 11, color: C.error }}>Annuler</Text>
                </Pressable>
              </View>
            ) : null}
            {pullError ? <Text style={{ fontSize: 11, color: C.error }}>{pullError}</Text> : null}
            <Text style={{ fontSize: 11, color: C.textMuted, lineHeight: 16 }}>
              ⚠️ Les modèles pèsent plusieurs Go et s'installent sur C:. Vérifiez l'espace libre avant de télécharger.
            </Text>
          </Card>

          {/* Modèles cloud (information) */}
          {cloud.length > 0 ? (
            <Card>
              <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Modèles cloud ollama.com (quota de crédits)</Text>
              {cloud.map(m => (
                <View key={m.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 }}>
                  <MaterialIcons name="cloud-off" size={14} color={C.error} />
                  <Text style={{ flex: 1, fontSize: 13, color: C.textSecondary }}>{m.name}</Text>
                  <Text style={{ fontSize: 10, color: C.error }}>crédits requis</Text>
                </View>
              ))}
              <Text style={{ fontSize: 11, color: C.textMuted, lineHeight: 16 }}>
                Ces modèles tournent chez ollama.com (payant à l'usage) et non sur votre PC — votre moteur sans quota est un modèle local ci-dessus.
              </Text>
            </Card>
          ) : null}

          {/* Modèle personnalisé */}
          <Card accent={C.accent}>
            <Text style={{ fontSize: 11, color: C.accent, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Créer mon modèle personnalisé</Text>
            <Text style={{ fontSize: 12, color: C.textSecondary, lineHeight: 18 }}>
              Dérive un modèle local avec votre personnalité gravée : il répondra « par nature » selon vos règles, sans répéter les consignes à chaque message.
            </Text>
            <ThemedInput value={newName} onChangeText={setNewName} placeholder="Nom du modèle (ex. 123promptez-stella)" mono />
            <Text style={{ fontSize: 11, color: C.textMuted }}>Modèle de base : <Text style={{ color: C.textPrimary, fontWeight: '600' }}>{baseModel.trim() || local[0]?.name || '— installez d\'abord un modèle'}</Text></Text>
            <TextInput
              value={systemPrompt}
              onChangeText={setSystemPrompt}
              multiline
              textAlignVertical="top"
              placeholder="Personnalité et règles : « Tu es Stella Bellarosa… Tu réponds en français, ton chaleureux… »"
              placeholderTextColor={C.textMuted}
              style={{ minHeight: 110, backgroundColor: C.bgCardAlt, borderRadius: 10, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: 13, padding: 10, textAlignVertical: 'top', lineHeight: 19 }}
            />
            <Pressable
              disabled={creating || !systemPrompt.trim() || !baseModel.trim()}
              onPress={() => void makeCustom()}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 10, paddingVertical: 12, opacity: creating || !systemPrompt.trim() || !baseModel.trim() ? 0.4 : pressed ? 0.85 : 1 }]}
            >
              {creating ? <ActivityIndicator size="small" color={C.bg} /> : <MaterialIcons name="auto-fix-high" size={15} color={C.bg} />}
              <Text style={{ fontSize: 13, color: C.bg, fontWeight: '800' }}>{creating ? 'Création en cours…' : 'Créer mon modèle'}</Text>
            </Pressable>
            {pullStatus ? <Text style={{ fontSize: 11, color: C.textSecondary }}>{pullStatus.status}</Text> : null}
            <Text style={{ fontSize: 11, color: C.textMuted, lineHeight: 16 }}>
              Après création, le modèle apparaît dans la liste ci-dessus — touchez « Discuter » pour l'utiliser.
            </Text>
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
