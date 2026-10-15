// QuestionnaireCard — questions à choix posées par l'IA (marqueur
// [QUESTIONNAIRE:{…}]). Boutons de sélection + champs libres ; les réponses
// repartent dans la conversation via le bouton « Envoyer mes réponses ».
import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Radius, Spacing, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { QuestionnaireData } from '@/services/agentClientTools';

export interface QuestionnaireAnswer { question: string; answer: string }

interface Props {
  data: QuestionnaireData;
  answered?: boolean;
  disabled?: boolean;
  onSubmit?: (answers: QuestionnaireAnswer[]) => void;
}

export function QuestionnaireCard({ data, answered = false, disabled = false, onSubmit }: Props) {
  const C = useThemeColors();
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [freeText, setFreeText] = useState<Record<number, string>>({});

  const complete = data.questions.every((q, i) => {
    if (selected[i]) return true;
    if (q.libre) return (freeText[i] ?? '').trim().length > 0;
    return false;
  });

  const submit = () => {
    if (!complete || answered || disabled || !onSubmit) return;
    const answers = data.questions.map((q, i) => ({
      question: q.question,
      answer: selected[i] ?? (freeText[i] ?? '').trim(),
    }));
    onSubmit(answers);
  };

  const readOnly = answered || disabled;
  return (
    <View style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: answered ? C.border : C.accent + '44', marginTop: Spacing.xs, overflow: 'hidden' }}>
      {/* En-tête */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <MaterialIcons name={answered ? 'task-alt' : 'quiz'} size={15} color={answered ? '#00CC6A' : C.accent} />
        <Text style={{ fontSize: FontSize.xs, color: answered ? '#00CC6A' : C.accent, fontWeight: '700', flex: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {answered ? 'Questionnaire répondu' : (data.titre || 'Questionnaire')}
        </Text>
      </View>

      <View style={{ padding: Spacing.md, gap: Spacing.md }}>
        {data.questions.map((q, qi) => (
          <View key={qi} style={{ gap: Spacing.xs }}>
            <Text style={{ fontSize: FontSize.sm, color: C.textPrimary, fontWeight: '600', lineHeight: 19 }}>
              {qi + 1}. {q.question}
            </Text>
            {(q.options ?? []).map(opt => {
              const isSel = selected[qi] === opt;
              return (
                <Pressable
                  key={opt}
                  disabled={readOnly}
                  onPress={() => setSelected(prev => ({ ...prev, [qi]: prev[qi] === opt ? '' : opt }))}
                  style={({ pressed }) => [{
                    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
                    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
                    borderRadius: Radius.md, borderWidth: 1,
                    borderColor: isSel ? C.accent + '88' : C.border,
                    backgroundColor: isSel ? C.accent + '18' : C.bg,
                    opacity: readOnly ? 0.55 : pressed ? 0.75 : 1,
                  }]}
                >
                  <MaterialIcons name={isSel ? 'radio-button-checked' : 'radio-button-unchecked'} size={16} color={isSel ? C.accent : C.textMuted} />
                  <Text style={{ fontSize: FontSize.sm, color: isSel ? C.accent : C.textSecondary, fontWeight: isSel ? '700' : '500' }}>{opt}</Text>
                </Pressable>
              );
            })}
            {q.libre ? (
              <TextInput
                value={freeText[qi] ?? ''}
                onChangeText={t => setFreeText(prev => ({ ...prev, [qi]: t }))}
                editable={!readOnly}
                multiline
                placeholder={q.options?.length ? 'Ou précisez votre propre réponse…' : 'Votre réponse…'}
                placeholderTextColor={C.textMuted}
                style={{ backgroundColor: C.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, minHeight: 44, textAlignVertical: 'top' }}
              />
            ) : null}
          </View>
        ))}

        {!readOnly && onSubmit ? (
          <Pressable
            onPress={submit}
            disabled={!complete}
            style={({ pressed }) => [{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
              paddingVertical: Spacing.sm + 2, borderRadius: Radius.md,
              backgroundColor: complete ? C.accent : C.bg,
              borderWidth: 1, borderColor: complete ? C.accent : C.border,
              opacity: complete ? (pressed ? 0.8 : 1) : 0.5,
            }]}
          >
            <MaterialIcons name="send" size={14} color={complete ? C.bg : C.textMuted} />
            <Text style={{ fontSize: FontSize.sm, color: complete ? C.bg : C.textMuted, fontWeight: '700' }}>
              Envoyer mes réponses
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
