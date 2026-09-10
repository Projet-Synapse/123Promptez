// Moteur de glisser-déposer minimaliste (souris + tactile via PanResponder),
// partagé par écran : un seul drag à la fois, zones de dépôt enregistrées avec
// leur rect fenêtre, fantôme rendu via <DragLayer />.
//
// Le geste se déclenche en phase CAPTURE après un seuil de déplacement : les
// taps continuent d'atteindre les Pressable, les drags sont interceptés.
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { View, Text, PanResponder } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Spacing, Radius, FontSize } from '@/constants/theme';

export type DragItem = {
  kind: 'file' | 'folder';
  id: string;
  label: string;
  icon?: string;
  color?: string;
  /** Données métier (fichier, localisation source…) manipulées au drop */
  data?: any;
};

type Rect = { x: number; y: number; width: number; height: number };

type Zone = {
  id: string;
  getRect: () => Rect | null;
  accepts: (item: DragItem) => boolean;
  onDrop: (item: DragItem) => void;
};

export type DragState = { item: DragItem; x: number; y: number; overId: string | null };

let dragState: DragState | null = null;
const zones = new Map<string, Zone>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}
export function subscribeDnD(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function getDnDState(): DragState | null {
  return dragState;
}
export function useDnDState(): DragState | null {
  return useSyncExternalStore(subscribeDnD, getDnDState, getDnDState);
}

function hitTest(item: DragItem, x: number, y: number): string | null {
  for (const zone of zones.values()) {
    const r = zone.getRect();
    if (!r || r.width === 0 || r.height === 0) continue;
    if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height && zone.accepts(item)) {
      return zone.id;
    }
  }
  return null;
}

export function beginDrag(item: DragItem, x: number, y: number) {
  dragState = { item, x, y, overId: hitTest(item, x, y) };
  emit();
}
export function moveDrag(x: number, y: number) {
  if (!dragState) return;
  dragState = { ...dragState, x, y, overId: hitTest(dragState.item, x, y) };
  emit();
}
export function endDrag() {
  const s = dragState;
  dragState = null;
  if (s?.overId) zones.get(s.overId)?.onDrop(s.item);
  emit();
}
export function cancelDrag() {
  dragState = null;
  emit();
}

/** PanHandlers à étaler sur la View englobante d'une ligne déplaçable. */
export function useDragHandlers(getItem: () => DragItem | null) {
  const getItemRef = useRef(getItem);
  getItemRef.current = getItem;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        !!getItemRef.current && (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6),
      onPanResponderGrant: (e) => {
        const item = getItemRef.current();
        if (item) beginDrag(item, e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onPanResponderMove: (e) => {
        moveDrag(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onPanResponderRelease: () => endDrag(),
      onPanResponderTerminate: () => cancelDrag(),
    }),
  ).current;
  return pan.panHandlers;
}

/** Zone de dépôt : mesure son rect fenêtre et se surligne quand survolée. */
export function DropZone({ zoneId, accepts, onDrop, style, activeStyle, children }: {
  zoneId: string;
  accepts: (item: DragItem) => boolean;
  onDrop: (item: DragItem) => void;
  style?: any;
  activeStyle?: any;
  children?: React.ReactNode;
}) {
  const ref = useRef<View>(null);
  const rectRef = useRef<Rect | null>(null);
  const cbRef = useRef({ accepts, onDrop });
  cbRef.current = { accepts, onDrop };
  const state = useDnDState();
  const dragging = !!state;

  useEffect(() => {
    zones.set(zoneId, {
      id: zoneId,
      getRect: () => rectRef.current,
      accepts: item => cbRef.current.accepts(item),
      onDrop: item => cbRef.current.onDrop(item),
    });
    return () => { zones.delete(zoneId); };
  }, [zoneId]);

  // Pendant un drag, on rafraîchit la géométrie (scroll, layout…) en continu.
  useEffect(() => {
    if (!dragging) return;
    let alive = true;
    const measure = () => {
      ref.current?.measureInWindow?.((x, y, width, height) => {
        if (alive) rectRef.current = { x, y, width, height };
      });
    };
    measure();
    const interval = setInterval(measure, 120);
    return () => { alive = false; clearInterval(interval); };
  }, [dragging]);

  const active = !!state && state.overId === zoneId;
  return (
    <View ref={ref} style={[style, active && activeStyle]}>
      {children}
    </View>
  );
}

/** Fantôme du drag qui suit le pointeur — à rendre une fois par écran. */
export function DragLayer() {
  const state = useDnDState();
  const C = useThemeColors();
  if (!state) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0, zIndex: 1000 }}>
      <View
        style={{
          position: 'absolute', left: state.x + 14, top: state.y + 12,
          flexDirection: 'row', alignItems: 'center', gap: 6,
          backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1,
          borderColor: state.overId ? C.accent : C.border,
          paddingHorizontal: Spacing.sm + 2, paddingVertical: 6,
          shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 8,
          opacity: 0.95, maxWidth: 240,
        }}
      >
        <MaterialIcons
          name={(state.item.icon as any) ?? (state.item.kind === 'folder' ? 'folder' : 'description')}
          size={14}
          color={state.item.color ?? C.accent}
        />
        <Text numberOfLines={1} style={{ fontSize: FontSize.xs, color: C.textPrimary, fontWeight: '700' }}>
          {state.item.label}
        </Text>
      </View>
    </View>
  );
}
