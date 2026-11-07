import React, { useState } from 'react';
import { View, Text, Switch, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { DEFAULT_LOCAL_AI, XAI_URL, listLocalModels, type LocalAIConfig } from '@/services/localAI';
import { Radius, Spacing } from '@/constants/theme';

export function LocalAISettings({ value, onChange }: {
  value?: LocalAIConfig; onChange: (config: LocalAIConfig) => void;
}) {
  const C = useThemeColors();
  const config = { ...DEFAULT_LOCAL_AI, ...value };
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);
  const isXai = config.protocol === 'openai' && /api\.x\.ai/i.test(config.url);
  const patch = (p: Partial<LocalAIConfig>) => onChange({ ...config, ...p });
  const text = { color: C.textPrimary, fontSize: 14 };
  const input = { ...text, padding: 10, borderWidth: 1, borderColor: C.border, borderRadius: Radius.sm, backgroundColor: C.bgCardAlt };
  const test = async () => {
    setBusy(true); setStatus('');
    try {
      const found = await listLocalModels(config);
      setModels(found);
      setStatus(`Connexion réussie : ${found.length} modèle(s).`);
      // Do not silently change either selected model.
    } catch (e: any) {
      setModels([]);
      setStatus(`Échec : ${e?.message ?? e}. Vérifie l’URL, le serveur, le pare-feu et CORS.`);
    } finally { setBusy(false); }
  };
  return (
    <View style={{ padding: Spacing.md, gap: 12, backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ ...text, fontWeight: '800' }}>Fournisseur : IA locale / xAI</Text>
        <Switch accessibilityLabel="Activer IA locale" value={config.enabled} onValueChange={enabled => patch({ enabled })} />
      </View>
      <Text style={{ color: C.textMuted, fontSize: 12 }}>Activé : récit et mémoire vont directement au serveur choisi, sans proxy Supabase. Désactivé : le modèle cloud ci-dessous est utilisé.</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {(['ollama', 'openai'] as const).map(protocol => (
          <Pressable key={protocol} onPress={() => { patch({ protocol }); setModels([]); setStatus(''); }} accessibilityRole="radio" accessibilityState={{ selected: config.protocol === protocol }}>
            <Text style={{ ...text, color: config.protocol === protocol ? C.accent : C.textMuted }}>{protocol === 'ollama' ? '● Ollama' : '● OpenAI / LM Studio'}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => { patch({ protocol: 'openai', url: XAI_URL }); setModels([]); setStatus(''); }} accessibilityRole="radio" accessibilityState={{ selected: isXai }}>
          <Text style={{ ...text, color: isXai ? C.accent : C.textMuted }}>● xAI (Grok)</Text>
        </Pressable>
      </View>
      <Text style={text}>URL du serveur</Text>
      <TextInput value={config.url} onChangeText={url => { patch({ url }); setModels([]); setStatus(''); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={input} placeholder="http://localhost:11434" placeholderTextColor={C.textMuted} />
      {config.protocol === 'openai' ? (
        <View style={{ gap: 6 }}>
          <Text style={text}>{isXai ? 'Clé API xAI' : 'Clé API (optionnelle)'}</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput value={config.apiKey ?? ''} onChangeText={apiKey => patch({ apiKey })} secureTextEntry={!keyVisible} autoCapitalize="none" autoCorrect={false} style={{ ...input, flex: 1 }} placeholder={isXai ? 'xai-…' : 'Laisser vide pour LM Studio'} placeholderTextColor={C.textMuted} />
            <Pressable onPress={() => setKeyVisible(v => !v)} accessibilityLabel={keyVisible ? 'Masquer la clé' : 'Afficher la clé'}>
              <Text style={{ ...text, color: C.accent }}>{keyVisible ? 'Masquer' : 'Afficher'}</Text>
            </Pressable>
          </View>
          <Text style={{ color: C.textMuted, fontSize: 12 }}>Gardée dans le coffre sécurisé de l’appareil, jamais synchronisée. Avec xAI, tes messages partent chez xAI (payant à l’usage).</Text>
        </View>
      ) : null}
      <Pressable disabled={busy} onPress={() => void test()} style={{ backgroundColor: C.accentGlow, borderRadius: Radius.sm, padding: 10, flexDirection: 'row', gap: 8 }}>
        {busy ? <ActivityIndicator size="small" color={C.accent} /> : null}
        <Text style={{ ...text, color: C.accent }}>Tester la connexion / charger les modèles</Text>
      </Pressable>
      {status ? <Text accessibilityLiveRegion="polite" style={text}>{status}</Text> : null}
      {(['narrativeModel', 'memoryModel'] as const).map(key => (
        <View key={key} style={{ gap: 6 }}>
          <Text style={{ ...text, fontWeight: '700' }}>{key === 'memoryModel' ? 'Modèle pour la passe mémoire (JSON)' : 'Modèle pour le récit'}</Text>
          <TextInput style={input} value={config[key]} onChangeText={v => patch({ [key]: v })} placeholder="Choisir ci-dessous ou saisir l’identifiant exact" placeholderTextColor={C.textMuted} autoCapitalize="none" autoCorrect={false} />
          {models.map(model => (
            <Pressable key={model} onPress={() => patch({ [key]: model })} style={{ padding: 6 }}>
              <Text style={{ ...text, color: config[key] === model ? C.accent : C.textPrimary }}>{config[key] === model ? '✓ ' : ''}{model}</Text>
            </Pressable>
          ))}
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ ...text, flex: 1 }}>Repli Gemini en cas d’échec (optionnel)</Text>
        <Switch accessibilityLabel="Autoriser le repli Gemini" value={config.fallbackGemini} onValueChange={fallbackGemini => patch({ fallbackGemini })} />
      </View>
      <Text style={{ color: C.textMuted, fontSize: 12 }}>Désactivé par défaut. Si activé, le récit / la mémoire peuvent être envoyés à Google via Supabase en cas d’erreur locale. Nécessite ta clé Gemini dans les réglages cloud ; modèle de repli : Gemini 2.5 Flash Lite.</Text>
      <Text style={{ ...text, fontWeight: '700' }}>Première étape : installer Ollama sur le PC</Text>
      <Text selectable style={{ color: C.textMuted, fontSize: 12 }}>{'Télécharge un modèle chat : ollama pull qwen3:8b (adapter à la RAM du PC).\nPuis lance le serveur avec OLLAMA_HOST=0.0.0.0 et OLLAMA_ORIGINS=* (redémarre Ollama après changement).\nAndroid : utilise http://IP_DU_PC:11434, pas localhost (qui désigne le téléphone). Même Wi-Fi, ou adresse Tailscale ; autorise le port dans le pare-feu.\nLM Studio : démarre le serveur local (souvent http://localhost:1234), active CORS / accès réseau, choisis « OpenAI / LM Studio ». /v1 est optionnel dans l’URL.\nWeb HTTPS : le navigateur peut bloquer HTTP local (contenu mixte / accès réseau privé). Préférer Electron, ou un serveur HTTPS local correctement sécurisé.\nAttention : OLLAMA_HOST expose le serveur et ORIGINS=* autorise toute origine. Réserve-le à un réseau de confiance, limite le pare-feu ; ne publie jamais ce port sur Internet.'}</Text>
    </View>
  );
}
