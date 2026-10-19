'use client';
import { create } from 'zustand';
import { api } from '@/lib/api';
import { CATEGORY_LABELS, CATEGORY_Z_INDEX, type Category } from '@/types';
import type { AdminCategory } from '@/lib/adminApi';

export const useCategoryStore = create<{
  labels: Record<Category, string>; layers: Record<Category, number>;
  load: () => Promise<void>;
}>((set) => ({
  labels: CATEGORY_LABELS, layers: CATEGORY_Z_INDEX,
  load: async () => {
    const { data } = await api.get<{ data: AdminCategory[] }>('/categories');
    const labels = { ...CATEGORY_LABELS }, layers = { ...CATEGORY_Z_INDEX };
    for (const c of data.data) { labels[c.code] = c.name; layers[c.code] = c.layerOrder; }
    set({ labels, layers });
  },
}));
export const useCategoryLabels = () => useCategoryStore((state) => state.labels);
