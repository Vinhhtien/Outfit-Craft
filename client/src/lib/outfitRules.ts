/**
 * Luat "moi vi tri 1 mon" khi them do len canvas Phoi do: them mon moi thi thay mon dang chiem
 * cho do, de canvas luon la 1 bo mac duoc. User muon mac chong (vd ao thun trong hoodie) thi
 * bat che do phoi lop - khi do khong thay mon nao.
 */
import type { Category } from '@/types';

const ONE_PIECE: readonly Category[] = ['dress', 'set'];

/** Cac loai bi thay khi them 1 mon thuoc loai category. Phu kien deo duoc nhieu mon. */
const CONFLICTS: Record<Category, readonly Category[]> = {
  top: ['top', ...ONE_PIECE],
  bottom: ['bottom', ...ONE_PIECE],
  dress: ['top', 'bottom', ...ONE_PIECE],
  set: ['top', 'bottom', ...ONE_PIECE],
  // Ao khoac la lop rieng, mac chong ngoai ao.
  outerwear: ['outerwear'],
  shoes: ['shoes'],
  bag: ['bag'],
  accessory: [],
};

export interface PlacedPiece {
  _id: string;
  category: Category;
}

export interface AddPlan {
  /** Mon cung loai se bi thay tai cho (giu thu tu lop cua no); null = them moi. */
  replace: string | null;
  /** Cac mon khac bi bo ra (vd them vay thi bo ao + quan). */
  remove: string[];
}

export function planAdd(onCanvas: PlacedPiece[], category: Category, layering = false): AddPlan {
  if (layering) return { replace: null, remove: [] };
  const conflicts = onCanvas.filter((p) => CONFLICTS[category].includes(p.category));
  const same = conflicts.find((p) => p.category === category) ?? null;
  return {
    replace: same?._id ?? null,
    remove: conflicts.filter((p) => p !== same).map((p) => p._id),
  };
}
