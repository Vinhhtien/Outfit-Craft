'use client';

import { create } from 'zustand';
import type { ClothingItem } from '@/types';

interface CanvasState {
  /** Outfit dang mo de sua; null nghia la dang tao moi. */
  editingOutfitId: string | null;
  /** Item duoc chon tren canvas - dung de hien thanh cong cu. */
  selectedItemId: string | null;
  /** Item user bam "them vao canvas" tu tu do, canvas se lang nghe. */
  pendingItem: ClothingItem | null;

  setEditingOutfit: (id: string | null) => void;
  setSelectedItem: (id: string | null) => void;
  addItemToCanvas: (item: ClothingItem) => void;
  consumePendingItem: () => void;
  reset: () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  editingOutfitId: null,
  selectedItemId: null,
  pendingItem: null,

  setEditingOutfit: (id) => set({ editingOutfitId: id }),
  setSelectedItem: (id) => set({ selectedItemId: id }),
  addItemToCanvas: (item) => set({ pendingItem: item }),
  consumePendingItem: () => set({ pendingItem: null }),
  reset: () => set({ editingOutfitId: null, selectedItemId: null, pendingItem: null }),
}));
