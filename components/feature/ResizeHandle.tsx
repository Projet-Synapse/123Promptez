// ResizeHandle — poignée de redimensionnement à la souris (web) pour les
// barres latérales : on tire la poignée, la largeur du panneau suit.
// L'effet ne s'accroche qu'à l'événement `mousedown` du nœud DOM ; le
// déplacement est suivi sur `document` jusqu'au `mouseup`.
import React, { useEffect, useRef } from 'react';
import { View, Platform } from 'react-native';

export function ResizeHandle({
  edge, width, minWidth = 260, maxWidth = 720, onResize, onEnd, color,
}: {
  edge: 'left' | 'right';
  width: number;
  minWidth?: number;
  maxWidth?: number;
  onResize: (newWidth: number) => void;
  onEnd?: (finalWidth: number) => void;
  color?: string;
}) {
  const ref = useRef<View>(null);
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    const node = ref.current as any;
    if (Platform.OS !== 'web' || !node || typeof node.addEventListener !== 'function') return;
    const down = (e: MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = widthRef.current;
      const move = (ev: MouseEvent) => {
        const delta = edge === 'right' ? ev.clientX - startX : startX - ev.clientX;
        onResize(Math.min(maxWidth, Math.max(minWidth, startW + delta)));
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        document.body.style.userSelect = '';
        onEnd?.(widthRef.current);
      };
      document.body.style.userSelect = 'none'; // évite la sélection pendant le tirage
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    };
    node.addEventListener('mousedown', down);
    return () => node.removeEventListener('mousedown', down);
  }, [edge, minWidth, maxWidth, onResize, onEnd]);

  return (
    <View
      ref={ref as any}
      style={{
        position: 'absolute', top: 0, bottom: 0,
        left: edge === 'left' ? -4 : undefined,
        right: edge === 'right' ? -4 : undefined,
        width: 9, alignItems: 'center', justifyContent: 'center', zIndex: 6,
        cursor: 'ew-resize' as any,
      }}
    >
      <View style={{ width: 3, height: 48, borderRadius: 2, backgroundColor: color ?? '#b6bdc7' }} />
    </View>
  );
}
