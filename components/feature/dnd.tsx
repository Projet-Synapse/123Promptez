// Moteur de glisser-déposer, deux modes selon la plateforme :
//  - WEB (site / Electron) : drag & drop HTML5 natif du navigateur — fiable à
//    la souris, fantôme géré par le navigateur, cibles = zones qui acceptent
//    l'événement drop. Les clics restent des clics (gérés par le navigateur).
//  - NATIF : PanResponder qui prend le geste au pointer-down et départage
//    tap / appui long / drag (seuil 6 px).
// Un petit store partagé porte l'élément en cours + la cible survolée pour la
// surbrillance et l'exécution du drop.
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { View, Text, PanResponder, Platform } from 'react-native';
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
let dropExecuted = false; // web : distingue drop réel d'une annulation (Esc)
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

export const isWebDnD = Platform.OS === 'web' && typeof window !== 'undefined';

function findZone(item: DragItem, x: number, y: number): Zone | null {
  for (const zone of zones.values()) {
    const r = zone.getRect();
    if (!r || r.width === 0 || r.height === 0) continue;
    if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height && zone.accepts(item)) {
      return zone;
    }
  }
  return null;
}

// ── API store ────────────────────────────────────────────────────────────────
export function beginDrag(item: DragItem, x: number, y: number) {
  dropExecuted = false;
  dragState = { item, x, y, overId: findZone(item, x, y)?.id ?? null };
  emit();
}
export function moveDrag(x: number, y: number) {
  if (!dragState) return;
  const zone = findZone(dragState.item, x, y);
  const overId = zone?.id ?? null;
  if (dragState.x === x && dragState.y === y && dragState.overId === overId) return;
  dragState = { ...dragState, x, y, overId };
  emit();
}
/** Exécute le drop sur la cible survolée puis réinitialise. */
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
/** Web (drop DOM) : marque qu'un drop réel a eu lieu, l'overId est déjà posé par dragover. */
export function markDropped() {
  dropExecuted = true;
}
/** Web (dragend) : exécute le drop si un vrai drop a eu lieu, sinon annule. */
export function finishWebDrag() {
  if (dropExecuted) endDrag();
  else cancelDrag();
}

// ── Source draggable ─────────────────────────────────────────────────────────
/**
 * Enveloppe déplaçable. Sur le web, pose `draggable` + les écouteurs HTML5 sur
 * le nœud DOM (les Pressable enfants gardent leurs clics). En natif, gère le
 * geste via PanResponder (tap / appui long / drag).
 */
export function Draggable({ getItem, onTap, onLongPress, onContextMenu, style, children }: {
  getItem: () => DragItem | null;
  onTap?: () => void;
  onLongPress?: () => void;
  onContextMenu?: (pos?: { x: number; y: number }) => void;
  style?: any;
  children?: React.ReactNode;
}) {
  const getItemRef = useRef(getItem);
  getItemRef.current = getItem;
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;
  const onCtxRef = useRef(onContextMenu);
  onCtxRef.current = onContextMenu;
  const webRef = useRef<any>(null);
  const draggingRef = useRef(false);
  const longPressFiredRef = useRef(false);
  const longTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Web — drag & drop HTML5
  useEffect(() => {
    if (!isWebDnD) return;
    const comp: any = webRef.current;
    const dom = comp && comp.nodeType === 1 ? comp : typeof comp?.getDOMNode === 'function' ? comp.getDOMNode() : null;
    if (!dom) return;
    dom.setAttribute('draggable', 'true');
    const onDragStart = (e: any) => {
      const item = getItemRef.current();
      if (!item) { e.preventDefault(); return; }
      try {
        e.dataTransfer.setData('text/plain', item.id);
        e.dataTransfer.effectAllowed = 'move';
      } catch { /* certains navigateurs */ }
      beginDrag(item, e.clientX ?? 0, e.clientY ?? 0);
    };
    const onDrag = (e: any) => moveDrag(e.clientX ?? 0, e.clientY ?? 0);
    const onDropEvt = () => markDropped();
    const onDragEnd = () => finishWebDrag();
    const onCtxMenu = (e: any) => {
      e.preventDefault?.();
      onCtxRef.current?.({ x: e.clientX ?? 0, y: e.clientY ?? 0 });
    };
    // Sur le web, ce wrapper REMPLACE le Pressable de la ligne : un clic sans
    // drag déclenche onTap (les Pressable enfants restent prioritaires via
    // stopPropagation dans leurs propres handlers si besoin).
    const onClick = () => {
      onTapRef.current?.();
    };
    dom.addEventListener('dragstart', onDragStart);
    dom.addEventListener('drag', onDrag);
    dom.addEventListener('drop', onDropEvt);
    dom.addEventListener('dragend', onDragEnd);
    dom.addEventListener('contextmenu', onCtxMenu);
    dom.addEventListener('click', onClick);
    return () => {
      dom.removeEventListener('dragstart', onDragStart);
      dom.removeEventListener('drag', onDrag);
      dom.removeEventListener('drop', onDropEvt);
      dom.removeEventListener('dragend', onDragEnd);
      dom.removeEventListener('contextmenu', onCtxMenu);
      dom.removeEventListener('click', onClick);
      dom.removeAttribute('draggable');
    };
  }, []);

  // Natif — PanResponder (tap / appui long / drag)
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => false,
      onPanResponderGrant: () => {
        draggingRef.current = false;
        longPressFiredRef.current = false;
        longTimerRef.current = setTimeout(() => {
          if (!draggingRef.current) {
            longPressFiredRef.current = true;
            onLongPressRef.current?.();
          }
        }, 550);
      },
      onPanResponderMove: (e, g) => {
        if (!draggingRef.current) {
          if (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6) {
            if (longTimerRef.current) { clearTimeout(longTimerRef.current); longTimerRef.current = null; }
            const item = getItemRef.current();
            if (item) {
              draggingRef.current = true;
              beginDrag(item, e.nativeEvent.pageX, e.nativeEvent.pageY);
            }
          }
        } else {
          moveDrag(e.nativeEvent.pageX, e.nativeEvent.pageY);
        }
      },
      onPanResponderRelease: () => {
        if (longTimerRef.current) { clearTimeout(longTimerRef.current); longTimerRef.current = null; }
        if (draggingRef.current) {
          endDrag();
        } else if (!longPressFiredRef.current) {
          onTapRef.current?.();
        }
        draggingRef.current = false;
      },
      onPanResponderTerminate: () => {
        if (longTimerRef.current) { clearTimeout(longTimerRef.current); longTimerRef.current = null; }
        if (draggingRef.current) cancelDrag();
        draggingRef.current = false;
      },
    }),
  ).current;

  return (
    <View ref={isWebDnD ? webRef : undefined} style={style} {...(isWebDnD ? {} : pan.panHandlers)}>
      {children}
    </View>
  );
}

// ── Zone de dépôt ────────────────────────────────────────────────────────────
/** Zone de dépôt : surbrillance quand survolée, `onDrop` à l'arrivée. */
export function DropZone({ zoneId, accepts, onDrop, style, activeStyle, children }: {
  zoneId: string;
  accepts: (item: DragItem) => boolean;
  onDrop: (item: DragItem) => void;
  style?: any;
  activeStyle?: any;
  children?: React.ReactNode;
}) {
  const ref = useRef<any>(null);
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

  // Web — accepte le drop via les événements HTML5 (pas besoin de géométrie)
  useEffect(() => {
    if (!isWebDnD) return;
    const comp: any = ref.current;
    const dom = comp && comp.nodeType === 1 ? comp : typeof comp?.getDOMNode === 'function' ? comp.getDOMNode() : null;
    if (!dom) return;
    const onDragOver = (e: any) => {
      const item = dragState?.item;
      if (!item || !cbRef.current.accepts(item)) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch { /* ignore */ }
      if (dragState?.overId !== zoneId) {
        dragState = { ...dragState!, overId: zoneId };
        emit();
      }
    };
    const onDrop = (e: any) => {
      const item = dragState?.item;
      if (!item || !cbRef.current.accepts(item)) return;
      e.preventDefault();
      markDropped();
      const zone = zones.get(zoneId);
      dragState = null;
      emit();
      zone?.onDrop(item);
    };
    dom.addEventListener('dragover', onDragOver);
    dom.addEventListener('drop', onDrop);
    return () => {
      dom.removeEventListener('dragover', onDragOver);
      dom.removeEventListener('drop', onDrop);
    };
  }, [zoneId]);

  // Natif — géométrie rafraîchie en continu pendant un drag
  useEffect(() => {
    if (isWebDnD || !dragging) return;
    let alive = true;
    const measure = () => {
      const node: any = ref.current;
      if (!node) return;
      if (typeof node.measureInWindow === 'function') {
        node.measureInWindow((x: number, y: number, width: number, height: number) => {
          if (alive) rectRef.current = { x, y, width, height };
        });
      } else if (typeof node.measure === 'function') {
        node.measure((x: number, y: number, width: number, height: number) => {
          if (alive) rectRef.current = { x, y, width, height };
        });
      }
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

/** Fantôme du drag en natif — le navigateur fournit le sien sur le web. */
export function DragLayer() {
  const state = useDnDState();
  const C = useThemeColors();
  if (isWebDnD || !state) return null;
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
