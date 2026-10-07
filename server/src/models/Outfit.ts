import { Schema, model, Document, Types } from 'mongoose';
import { SEASONS, OCCASIONS, Season, Occasion } from '../types/index.js';
// ===== NEW: Body Profile =====
import {
  BODY_GENDERS, BODY_SHAPES, BODY_MEASUREMENT_RANGES, BodyGender, BodyShape, BodyMeasurements,
  // NEW: Body 3D
  BODY_WEIGHT_RANGE, MODEL_HUE_RANGE, SCENE3D_MAX_ITEMS,
} from '../types/index.js';

/**
 * Snapshot dang nguoi luc phoi (khong lien ket voi User.bodyProfile: doi profile sau nay
 * khong lam outfit cu thay doi). null / khong co = outfit cu hoac tat mannequin.
 */
export interface IOutfitMannequin {
  gender: BodyGender;
  shape: BodyShape;
  measurements?: BodyMeasurements;
}
// ===== END NEW =====

// ===== NEW: Body 3D =====
/** Snapshot nguoi mau 3D luc phoi - chi chu so huu duoc thay (strip khi tra cho nguoi khac). */
export interface IScene3DBody extends IOutfitMannequin {
  weightKg?: number;
  modelColorHue?: number;
}

/**
 * 1 mon do trong canh 3D. Toa do tinh bang met, truc y huong len, nguoi mau dung tai goc.
 * anchor != null: offset = diem tham chieu cua mon do tru di neo. anchor null: offset = vi tri tuyet doi.
 * scale = be rong mon do (met) chia be rong chuan cua nhom do tren than bodySnapshot.
 */
export interface IScene3DItem {
  itemId: Types.ObjectId;
  anchor: string | null;
  offset: number[];
  scale: number;
  /** Goc xoay quanh truc nhin (radian). */
  rotation: number;
  /** Thu tu lop: so lon = nam ngoai. */
  layer: number;
  /** Ti le cao/rong cua anh - de dung lai khung truoc khi texture tai xong. */
  aspect?: number;
  flipX?: boolean;
}

export interface IScene3D {
  version: number;
  bodySnapshot: IScene3DBody;
  /** false = luc luu dang an nguoi mau. */
  showModel: boolean;
  items: IScene3DItem[];
  camera?: { position: number[]; target: number[] };
}
// ===== END NEW =====

/**
 * Vi tri / bien doi cua 1 item tren canvas.
 * Tach rieng khoi canvasJSON de co the query "outfit nao chua item X"
 * va de render lai preview nhe ma khong can Fabric.
 */
export interface IOutfitItem {
  item: Types.ObjectId;
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  zIndex: number;
  flipX?: boolean;
  // ===== NEW: Body Profile =====
  /** Ten anchor cua mannequin ma item dang bam vao (vd 'neck', 'waist'); null = tu do. */
  anchorRef?: string | null;
  /** Do lech diem tham chieu cua item so voi anchor, don vi logic 400x800. */
  offset?: { x: number; y: number };
  // ===== END NEW =====
}

export interface IOutfit extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  name: string;
  items: IOutfitItem[];
  /**
   * Snapshot day du tu canvas.toJSON() cua Fabric.
   * Mixed vi cau truc do Fabric quyet dinh - khong rang buoc schema.
   */
  canvasJSON: Record<string, unknown>;
  /** Anh PNG export tu canvas, dung lam thumbnail trong danh sach/lich. */
  thumbnailUrl?: string;
  thumbnailPublicId?: string;
  seasons: Season[];
  occasions: Occasion[];
  tags: string[];
  isPublic: boolean;
  likeCount: number;
  // ===== NEW: Body Profile =====
  mannequin?: IOutfitMannequin | null;
  // ===== END NEW =====
  // ===== NEW: Body 3D =====
  /** Canh 3D (them ben canh canvasJSON, khong thay the). Khong co / null = outfit 2D. */
  scene3D?: IScene3D | null;
  // ===== END NEW =====
  createdAt: Date;
  updatedAt: Date;
}

const outfitItemSchema = new Schema<IOutfitItem>(
  {
    item: { type: Schema.Types.ObjectId, ref: 'ClothingItem', required: true },
    left: { type: Number, required: true },
    top: { type: Number, required: true },
    scaleX: { type: Number, default: 1 },
    scaleY: { type: Number, default: 1 },
    angle: { type: Number, default: 0 },
    zIndex: { type: Number, default: 0 },
    flipX: { type: Boolean, default: false },
    // ===== NEW: Body Profile =====
    // Khong dat default -> outfit cu doc ra van khong co 2 field nay (render nhu truoc).
    anchorRef: { type: String },
    offset: { x: Number, y: Number },
    // ===== END NEW =====
  },
  { _id: false }
);

// ===== NEW: Body Profile =====
const mannequinMeasurement = (k: keyof typeof BODY_MEASUREMENT_RANGES) => ({
  type: Number,
  min: BODY_MEASUREMENT_RANGES[k].min,
  max: BODY_MEASUREMENT_RANGES[k].max,
});

const mannequinMeasurements = {
  heightCm: mannequinMeasurement('heightCm'),
  shoulderCm: mannequinMeasurement('shoulderCm'),
  bustCm: mannequinMeasurement('bustCm'),
  waistCm: mannequinMeasurement('waistCm'),
  hipCm: mannequinMeasurement('hipCm'),
  inseamCm: mannequinMeasurement('inseamCm'), // NEW: Body 3D
};

const outfitMannequinSchema = new Schema<IOutfitMannequin>(
  {
    gender: { type: String, enum: BODY_GENDERS, required: true },
    shape: { type: String, enum: BODY_SHAPES, required: true },
    measurements: mannequinMeasurements,
  },
  { _id: false }
);
// ===== END NEW =====

// ===== NEW: Body 3D =====
const vec3 = {
  type: [Number],
  validate: { validator: (v: number[]) => v.length === 3, message: 'Can dung 3 toa do' },
};

const scene3DBodySchema = new Schema<IScene3DBody>(
  {
    gender: { type: String, enum: BODY_GENDERS, required: true },
    shape: { type: String, enum: BODY_SHAPES, required: true },
    measurements: mannequinMeasurements,
    weightKg: { type: Number, min: BODY_WEIGHT_RANGE.min, max: BODY_WEIGHT_RANGE.max },
    modelColorHue: { type: Number, min: MODEL_HUE_RANGE.min, max: MODEL_HUE_RANGE.max },
  },
  { _id: false }
);

const scene3DItemSchema = new Schema<IScene3DItem>(
  {
    itemId: { type: Schema.Types.ObjectId, ref: 'ClothingItem', required: true },
    anchor: { type: String, default: null },
    offset: { ...vec3, required: true },
    scale: { type: Number, required: true, min: 0 },
    rotation: { type: Number, default: 0 },
    layer: { type: Number, default: 0 },
    aspect: { type: Number },
    flipX: { type: Boolean },
  },
  { _id: false }
);

const scene3DSchema = new Schema<IScene3D>(
  {
    version: { type: Number, required: true },
    bodySnapshot: { type: scene3DBodySchema, required: true },
    showModel: { type: Boolean, default: true },
    items: {
      type: [scene3DItemSchema],
      validate: {
        validator: (arr: IScene3DItem[]) => arr.length <= SCENE3D_MAX_ITEMS,
        message: `Canh 3D toi da ${SCENE3D_MAX_ITEMS} mon do`,
      },
    },
    // Khong co default: camera chi luu khi client gui.
    camera: {
      type: new Schema({ position: vec3, target: vec3 }, { _id: false }),
      default: undefined,
    },
  },
  { _id: false }
);
// ===== END NEW =====

const outfitSchema = new Schema<IOutfit>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    items: {
      type: [outfitItemSchema],
      validate: {
        validator: (arr: IOutfitItem[]) => arr.length > 0,
        message: 'Outfit phai co it nhat 1 mon do',
      },
    },
    canvasJSON: { type: Schema.Types.Mixed, default: {} },
    thumbnailUrl: { type: String },
    thumbnailPublicId: { type: String },
    seasons: { type: [String], enum: SEASONS, default: [] },
    occasions: { type: [String], enum: OCCASIONS, default: [] },
    tags: { type: [String], default: [] },
    isPublic: { type: Boolean, default: false },
    likeCount: { type: Number, default: 0 },
    // ===== NEW: Body Profile =====
    mannequin: { type: outfitMannequinSchema, default: undefined },
    // ===== END NEW =====
    // ===== NEW: Body 3D =====
    scene3D: { type: scene3DSchema, default: undefined },
    // ===== END NEW =====
  },
  { timestamps: true }
);

outfitSchema.index({ owner: 1, createdAt: -1 });
// Feed OOTD cong khai.
outfitSchema.index({ isPublic: 1, createdAt: -1 });
// Tim outfit dang dung 1 item cu the (vd truoc khi xoa item).
outfitSchema.index({ 'items.item': 1 });

export const Outfit = model<IOutfit>('Outfit', outfitSchema);
