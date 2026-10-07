'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
// ===== NEW: Body 3D =====
import dynamic from 'next/dynamic';
// ===== END NEW =====
import {
  Save, Trash2, ArrowUp, ArrowDown, FlipHorizontal,
  Layers, Eraser, Plus,
  // ===== NEW: Body Profile =====
  PersonStanding, Magnet, FolderOpen, FilePlus, RotateCcw,
  // ===== END NEW =====
  // ===== NEW: Body 3D =====
  PanelRightClose, PanelRightOpen, Shirt, SlidersHorizontal, X,
  // ===== END NEW =====
} from 'lucide-react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { ScallopBanner } from '@/components/layout/ScallopBanner';
import { OutfitCanvas, type OutfitCanvasHandle } from '@/components/canvas/OutfitCanvas';
import { VButton, VChip, VInput, VLabel, VModal, VSpinner, VToast } from '@/components/ui/vintage';
import { itemApi, outfitApi, bodyProfileApi } from '@/lib/services';
import { getErrorMessage } from '@/lib/api';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/fabricCanvas';
// ===== NEW: Body Profile =====
import { DEFAULT_MANNEQUIN, resolveMannequinProfile } from '@/lib/mannequin';
// ===== END NEW =====
// ===== NEW: Body 3D =====
import { BodyControlsPanel } from '@/components/body3d/BodyControlsPanel';
import type { Outfit3DStageHandle } from '@/components/body3d/Outfit3DStage';
import {
  bodyStateFromProfile, bodyStateFromSnapshot, bodyStateToMannequin, bodyStateToProfile,
  bodyStateToSnapshot, sameBodyState, type BodyState,
} from '@/lib/bodyMetrics';
import { ITEM_DRAG_MIME } from '@/lib/placement3D';
import { webglAvailable } from '@/lib/webgl';
// ===== END NEW =====
import {
  CATEGORIES, CATEGORY_LABELS, OCCASIONS, OCCASION_LABELS,
  BODY_GENDERS, BODY_GENDER_LABELS, BODY_SHAPES, BODY_SHAPE_LABELS,
} from '@/types';
import type {
  BodyGender, BodyProfile, BodyShape, Category, ClothingItem, MannequinProfile, Occasion, Outfit,
} from '@/types';

// ===== NEW: Body 3D =====
// Canh 3D chi chay tren trinh duyet: nap rieng (three.js khong vao bundle trang khi dung 2D).
const Outfit3DStage = dynamic(
  () => import('@/components/body3d/Outfit3DStage').then((m) => m.Outfit3DStage),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full w-full place-items-center rounded-2xl bg-[#22262c]">
        <VSpinner />
      </div>
    ),
  }
);

type StudioMode = '2d' | '3d';

/** Nhung thao tac toolbar ma ca canvas 2D lan canh 3D deu co. */
type ToolHandle = Pick<
  OutfitCanvasHandle,
  'bringForward' | 'sendBackward' | 'flipSelected' | 'removeSelected' | 'autoArrange' | 'clear'
>;

/** Viec cho canvas/canh moi san sang: mo outfit, hoac chuyen mon do khi doi che do 2D <-> 3D. */
type Pending = { kind: 'outfit'; outfit: Outfit } | { kind: 'transfer'; items: ClothingItem[] };

/** Studio: BMI mac dinh an (khac trang Ho so). */
const studioBody = (profile: Partial<BodyProfile> | null) =>
  bodyStateFromProfile(profile ? { ...profile, showBmi: undefined } : null, { showBmi: false });
// ===== END NEW =====

const EMPTY_FORM = {
  name: '',
  occasions: [] as Occasion[],
  isPublic: false,
  /** Kem bong nguoi trong anh thumbnail. */
  includeMannequin: true,
};

export default function StudioPage() {
  const canvasRef = useRef<OutfitCanvasHandle>(null);
  const [setFitEl, canvasScale] = useFitScale();

  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [hasSelection, setHasSelection] = useState(false);

  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // ===== NEW: Body Profile =====
  /** Dáng trong hồ sơ của user (mặc định rectangle/neutral). */
  const [userProfile, setUserProfile] = useState<MannequinProfile>(DEFAULT_MANNEQUIN);
  /** Dáng đang dùng cho outfit này - đổi nhanh trên toolbar không ghi vào hồ sơ. */
  const [mannequin, setMannequin] = useState<MannequinProfile>(DEFAULT_MANNEQUIN);
  const [showMannequin, setShowMannequin] = useState(true);
  const [autoSnap, setAutoSnap] = useState(true);

  /** Outfit đang mở để sửa (null = phối mới). was3D: outfit đang có cảnh 3D. */
  const [editing, setEditing] = useState<{ id: string; name: string; was3D: boolean } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savedOutfits, setSavedOutfits] = useState<Outfit[] | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const pendingRef = useRef<Pending | null>(null);
  const userProfileRef = useRef<MannequinProfile>(DEFAULT_MANNEQUIN);
  // ===== END NEW =====

  // ===== NEW: Body 3D =====
  const stageRef = useRef<Outfit3DStageHandle | null>(null);
  const [has3D] = useState(() => webglAvailable());
  const [mode, setModeState] = useState<StudioMode>(() => (webglAvailable() ? '3d' : '2d'));
  const modeRef = useRef<StudioMode>(mode);
  /** Canvas 2D / canh 3D da gan vao trang va nhan lenh duoc chua. */
  const readyRef = useRef<Record<StudioMode, boolean>>({ '2d': false, '3d': false });

  /** Số đo trong hồ sơ (3D) và bản đang xem thử cho outfit này. */
  const [userBody, setUserBody] = useState<BodyState>(() => studioBody(null));
  const userBodyRef = useRef<BodyState>(userBody);
  const rawProfileRef = useRef<BodyProfile | null>(null);
  const [body3D, setBody3D] = useState<BodyState>(userBody);
  const [panelOpen, setPanelOpen] = useState(true);
  const [sheet, setSheet] = useState<'wardrobe' | 'body' | null>(null);
  const [saveBodyOpen, setSaveBodyOpen] = useState(false);
  const [savingBody, setSavingBody] = useState(false);

  /** Moi mon do da biet (tu do + mon trong outfit da mo) - de tha / chuyen che do. */
  const knownItemsRef = useRef(new Map<string, ClothingItem>());
  const rememberItems = (list: (ClothingItem | string)[]) => {
    for (const it of list) if (typeof it !== 'string') knownItemsRef.current.set(it._id, it);
  };

  const setMode = (m: StudioMode) => {
    if (m === modeRef.current) return;
    readyRef.current[modeRef.current] = false;
    modeRef.current = m;
    setModeState(m);
    setHasSelection(false);
  };

  const activeTools = (): ToolHandle | null =>
    modeRef.current === '3d' ? stageRef.current : canvasRef.current;

  const addToActive = (item: ClothingItem) => {
    if (modeRef.current === '3d') stageRef.current?.addItem(item);
    else void canvasRef.current?.addItem(item);
  };
  // ===== END NEW =====

  // ===== NEW: Body Profile =====
  const applyOutfit = useCallback(async (outfit: Outfit) => {
    rememberItems(outfit.items.map((i) => i.item)); // NEW: Body 3D
    // ===== NEW: Body 3D =====
    // Outfit phoi o 3D mo lai o 3D (neu trinh duyet co WebGL); outfit cu chi co canvasJSON -> 2D.
    const wants: StudioMode = outfit.scene3D && webglAvailable() ? '3d' : '2d';
    if (modeRef.current !== wants || !readyRef.current[wants]) {
      pendingRef.current = { kind: 'outfit', outfit };
      setMode(wants);
      return;
    }
    if (wants === '3d' && outfit.scene3D) {
      const scene = outfit.scene3D;
      const body = scene.bodySnapshot
        ? bodyStateFromSnapshot(scene.bodySnapshot, userBodyRef.current)
        : userBodyRef.current;
      stageRef.current?.load(scene, (id) => knownItemsRef.current.get(id), body);
      setBody3D(body);
      setShowMannequin(scene.showModel);
      setEditing({ id: outfit._id, name: outfit.name, was3D: true });
      setForm({
        name: outfit.name,
        occasions: outfit.occasions ?? [],
        isPublic: outfit.isPublic,
        includeMannequin: scene.showModel && !outfit.isPublic,
      });
      return;
    }
    // ===== END NEW =====

    const canvas = canvasRef.current;
    if (!canvas) return;
    // Outfit cu (khong co mannequin) hoac luu luc tat mannequin -> an mannequin, hien y nhu truoc.
    const visible = Boolean(outfit.mannequin);
    const profile = outfit.mannequin
      ? resolveMannequinProfile(outfit.mannequin)
      : userProfileRef.current;

    if (outfit.scene3D) {
      // NEW: Body 3D - outfit 3D nhung trinh duyet khong co WebGL: dat lai tung mon tu dong o 2D.
      await canvas.loadJSON({}, [], profile, visible);
      for (const s of [...outfit.scene3D.items].sort((a, b) => a.layer - b.layer)) {
        const it = knownItemsRef.current.get(s.itemId);
        if (it) await canvas.addItem(it);
      }
    } else {
      await canvas.loadJSON(outfit.canvasJSON ?? {}, outfit.items, profile, visible);
    }
    setMannequin(profile);
    setShowMannequin(visible);
    setEditing({ id: outfit._id, name: outfit.name, was3D: Boolean(outfit.scene3D) });
    setForm({
      name: outfit.name,
      occasions: outfit.occasions ?? [],
      isPublic: outfit.isPublic,
      includeMannequin: visible && !outfit.isPublic,
    });
  }, []);

  /** Chay viec dang cho khi canvas/canh cua che do hien tai san sang. */
  const flushPending = useCallback(() => {
    const p = pendingRef.current;
    const m = modeRef.current;
    if (!p || !readyRef.current[m]) return;
    if (p.kind === 'outfit') {
      const wants: StudioMode = p.outfit.scene3D && webglAvailable() ? '3d' : '2d';
      if (wants !== m) return;
      pendingRef.current = null;
      applyOutfit(p.outfit).catch((err) => setError(getErrorMessage(err)));
      return;
    }
    pendingRef.current = null;
    void (async () => {
      for (const it of p.items) {
        if (m === '3d') stageRef.current?.addItem(it);
        else await canvasRef.current?.addItem(it);
      }
    })();
  }, [applyOutfit]);

  const handleCanvasReady = useCallback(() => {
    readyRef.current['2d'] = true;
    flushPending();
  }, [flushPending]);
  // ===== END NEW =====

  // ===== NEW: Body 3D =====
  const handleStageReady = useCallback(() => {
    readyRef.current['3d'] = true;
    flushPending();
  }, [flushPending]);
  // ===== END NEW =====

  useEffect(() => {
    void (async () => {
      try {
        const res = await itemApi.list({ limit: 100 });
        setItems(res.data);
        rememberItems(res.data); // NEW: Body 3D
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoadingItems(false);
      }
    })();

    // ===== NEW: Body Profile =====
    void (async () => {
      const raw = await bodyProfileApi.get().catch(() => null);
      const profile = resolveMannequinProfile(raw);
      userProfileRef.current = profile;
      setUserProfile(profile);
      // ===== NEW: Body 3D =====
      rawProfileRef.current = raw;
      const body = studioBody(raw);
      userBodyRef.current = body;
      setUserBody(body);
      // ===== END NEW =====

      // /studio?outfit=<id> -> mo outfit da luu de sua.
      const outfitId = new URLSearchParams(window.location.search).get('outfit');
      if (!outfitId) {
        setMannequin(profile);
        setBody3D(body); // NEW: Body 3D
        return;
      }
      try {
        pendingRef.current = { kind: 'outfit', outfit: await outfitApi.get(outfitId) };
        flushPending();
      } catch (err) {
        setMannequin(profile);
        setBody3D(body); // NEW: Body 3D
        setError(getErrorMessage(err));
      }
    })();
    // ===== END NEW =====
  }, [flushPending]);

  const filtered =
    category === 'all' ? items : items.filter((i) => i.category === category);

  const handleSelectionChange = useCallback((v: boolean) => setHasSelection(v), []);
  const closeToast = useCallback(() => setToast(null), []);

  // ===== NEW: Body Profile =====
  const startNewOutfit = () => {
    activeTools()?.clear();
    setEditing(null);
    setForm(EMPTY_FORM);
    setMannequin(userProfileRef.current);
    setBody3D(userBodyRef.current); // NEW: Body 3D
    setShowMannequin(true);
    window.history.replaceState(null, '', '/studio');
  };

  const openPicker = async () => {
    setPickerOpen(true);
    setSavedOutfits(null);
    try {
      const res = await outfitApi.list({ page: 1 });
      setSavedOutfits(res.data);
    } catch (err) {
      setPickerOpen(false);
      setError(getErrorMessage(err));
    }
  };

  const openOutfit = async (id: string) => {
    setOpeningId(id);
    try {
      // GET /outfits/:id populate day du item (co category) -> dung cho outfit cu.
      await applyOutfit(await outfitApi.get(id));
      window.history.replaceState(null, '', `/studio?outfit=${id}`);
      setPickerOpen(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setOpeningId(null);
    }
  };

  /** Xem thử dáng khác: bỏ số đo riêng để preset của dáng mới hiện rõ. */
  const previewShape = (shape: BodyShape) => setMannequin({ gender: mannequin.gender, shape });
  const previewGender = (gender: BodyGender) => setMannequin({ gender, shape: mannequin.shape });
  const isPreviewing = JSON.stringify(mannequin) !== JSON.stringify(userProfile);
  // ===== END NEW =====

  // ===== NEW: Body 3D =====
  const isBodyPreviewing = !sameBodyState({ ...body3D, showBmi: false }, { ...userBody, showBmi: false });

  /** Doi 2D <-> 3D: mon dang co duoc dat lai tu dong ben che do moi. */
  const switchMode = (target: StudioMode) => {
    if (target === mode) return;
    if (target === '3d' && !has3D) {
      setError('Trình duyệt này không hỗ trợ WebGL nên chỉ dùng được chế độ 2D.');
      return;
    }
    const ids = mode === '3d'
      ? stageRef.current?.itemIds() ?? []
      : canvasRef.current?.serialize().items.map((i) => i.item) ?? [];
    const list = ids.map((id) => knownItemsRef.current.get(id)).filter((x): x is ClothingItem => Boolean(x));
    pendingRef.current = list.length ? { kind: 'transfer', items: list } : null;
    setMode(target);
    if (list.length) setToast('Đã đổi chế độ — các món đồ được đặt lại tự động theo cơ thể.');
  };

  const saveBodyToProfile = async () => {
    setSavingBody(true);
    try {
      // Giu tuy chon "An BMI" cua trang Ho so (o Studio BMI luon mac dinh an).
      const saved = await bodyProfileApi.save(
        bodyStateToProfile({ ...body3D, showBmi: rawProfileRef.current?.showBmi ?? true })
      );
      rawProfileRef.current = saved;
      userBodyRef.current = body3D;
      setUserBody(body3D);
      const profile = resolveMannequinProfile(saved);
      userProfileRef.current = profile;
      setUserProfile(profile);
      setSaveBodyOpen(false);
      setToast('Đã lưu số đo vào hồ sơ.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingBody(false);
    }
  };
  // ===== END NEW =====

  const handleSave = async () => {
    // ===== NEW: Body 3D =====
    if (mode === '3d') {
      const stage = stageRef.current;
      if (!stage) return;
      const s = stage.serialize();
      if (s.items.length === 0) {
        setError('Hãy thêm ít nhất một món đồ lên người mẫu trước khi lưu.');
        return;
      }
      setSaving(true);
      setError('');
      try {
        const body = {
          name: form.name.trim(),
          items: s.legacyItems,
          canvasJSON: {},
          thumbnailDataUrl: stage.exportThumbnail(form.includeMannequin && showMannequin),
          occasions: form.occasions,
          isPublic: form.isPublic,
          mannequin: showMannequin ? bodyStateToMannequin(body3D) : null,
          scene3D: {
            version: 1 as const,
            bodySnapshot: bodyStateToSnapshot(body3D),
            showModel: showMannequin,
            items: s.items,
            camera: s.camera,
          },
        };
        if (editing) await outfitApi.update(editing.id, body);
        else await outfitApi.create(body);
        setSaveOpen(false);
        setToast(editing ? 'Đã cập nhật outfit!' : 'Đã lưu outfit vào bộ sưu tập!');
        startNewOutfit();
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setSaving(false);
      }
      return;
    }
    // ===== END NEW =====

    const canvas = canvasRef.current;
    if (!canvas) return;

    const { items: outfitItems, canvasJSON, mannequin: snapshot } = canvas.serialize();
    if (outfitItems.length === 0) {
      setError('Hãy thêm ít nhất một món đồ lên canvas trước khi lưu.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const body = {
        name: form.name.trim(),
        items: outfitItems,
        canvasJSON,
        thumbnailDataUrl: canvas.exportThumbnail(form.includeMannequin),
        occasions: form.occasions,
        isPublic: form.isPublic,
        mannequin: snapshot, // NEW: Body Profile
        // NEW: Body 3D - luu lai o 2D thi bo canh 3D cu (lan sau mo o 2D).
        ...(editing?.was3D ? { scene3D: null } : {}),
      };
      if (editing) await outfitApi.update(editing.id, body);
      else await outfitApi.create(body);

      setSaveOpen(false);
      setToast(editing ? 'Đã cập nhật outfit!' : 'Đã lưu outfit vào bộ sưu tập!');
      startNewOutfit();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Action nhan handle lam tham so (khong dong goi canvasRef) -> khong bi coi la doc ref luc render.
  // NEW: Body 3D - handle la canvas 2D hoac canh 3D tuy che do.
  const toolbar: { icon: typeof ArrowUp; label: string; run: (c: ToolHandle) => void; needSel: boolean }[] = [
    { icon: ArrowUp, label: 'Đưa lên trên', run: (c) => c.bringForward(), needSel: true },
    { icon: ArrowDown, label: 'Đưa xuống dưới', run: (c) => c.sendBackward(), needSel: true },
    { icon: FlipHorizontal, label: 'Lật ngang', run: (c) => c.flipSelected(), needSel: true },
    { icon: Trash2, label: mode === '3d' ? 'Xóa khỏi người mẫu' : 'Xóa khỏi canvas', run: (c) => c.removeSelected(), needSel: true },
    { icon: Layers, label: 'Tự sắp lớp theo loại', run: (c) => c.autoArrange(), needSel: false },
    { icon: Eraser, label: 'Xóa toàn bộ món đồ', run: (c) => c.clear(), needSel: false },
  ];
  const runTool = (run: (c: ToolHandle) => void) => {
    const handle = activeTools();
    if (handle) run(handle);
  };

  // ===== NEW: Body 3D =====
  const is3D = mode === '3d';
  const wardrobe = (
    <WardrobePicker
      category={category}
      onCategory={setCategory}
      loading={loadingItems}
      items={filtered}
      draggable={is3D}
      onPick={(item) => addToActive(item)}
      hint={is3D ? 'Kéo thả lên người mẫu hoặc bấm để thêm' : undefined}
    />
  );
  const bodyPanel = (
    <BodyControlsPanel
      value={body3D}
      onChange={setBody3D}
      header={
        <p className="rounded-lg bg-[#E2ECC8]/50 px-3 py-2 text-[11px] leading-snug text-[#2C4C45]">
          Đang xem thử: số đo ở đây chỉ áp dụng cho outfit này, không ghi vào hồ sơ.
        </p>
      }
      footer={
        <div className="flex flex-col gap-2 border-t border-dashed border-[#869BB2]/50 pt-3">
          <button
            type="button"
            onClick={() => setBody3D(userBodyRef.current)}
            disabled={!isBodyPreviewing}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#1F453E] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#1F453E] transition-colors hover:bg-[#E2ECC8]/50 disabled:opacity-40"
          >
            <RotateCcw size={12} /> Về số đo trong hồ sơ
          </button>
          <button
            type="button"
            onClick={() => setSaveBodyOpen(true)}
            disabled={!isBodyPreviewing}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#1F453E] bg-[#1F453E] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#16352F] disabled:opacity-40"
          >
            <Save size={12} /> Lưu số đo này vào hồ sơ
          </button>
        </div>
      }
    />
  );
  // ===== END NEW =====

  return (
    <ProtectedLayout fullBleed hideFooter>
      <div className="flex h-[calc(100dvh-64px)] flex-col overflow-hidden bg-[#FAF9F5] font-jakarta text-[#1F453E]">
        <ScallopBanner wide compact>
          <div>
            <h1 className="font-serif-display text-xl font-normal uppercase leading-tight tracking-wider text-[#1F453E] sm:text-2xl">
              Phối đồ
            </h1>
            <p className="mt-0.5 text-xs font-medium text-[#2C4C45]">
              {editing
                ? `Đang sửa: ${editing.name}`
                : is3D
                  ? 'Kéo món đồ từ tủ đồ thả lên người mẫu 3D để thử phối.'
                  : 'Bấm vào món đồ bên trái để thêm lên canvas, rồi kéo-thả để sắp xếp.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* ===== NEW: Body Profile ===== mo lai / phoi moi */}
            {editing && (
              <button
                onClick={startNewOutfit}
                className="inline-flex items-center gap-2 rounded-full border border-[#1F453E] bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#1F453E] transition-all hover:bg-[#E2ECC8]/50"
              >
                <FilePlus size={14} /> Phối mới
              </button>
            )}
            <button
              onClick={() => void openPicker()}
              className="inline-flex items-center gap-2 rounded-full border border-[#1F453E] bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#1F453E] transition-all hover:bg-[#E2ECC8]/50"
            >
              <FolderOpen size={14} /> Mở outfit
            </button>
            {/* ===== END NEW ===== */}
            <button
              onClick={() => setSaveOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-[#1F453E] bg-[#1F453E] px-5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-sm transition-all hover:bg-[#16352F]"
            >
              <Save size={14} /> {editing ? 'Cập nhật' : 'Lưu outfit'}
            </button>
          </div>
        </ScallopBanner>

        {error && !saveOpen && (
          <div className="mx-auto w-full max-w-7xl shrink-0 px-6 pt-3 lg:px-10">
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          </div>
        )}

        <div
          className={`mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-cols-1 items-stretch gap-6 overflow-hidden px-6 py-3 lg:grid-cols-12 lg:grid-rows-1 lg:px-10 ${
            is3D ? 'grid-rows-1' : 'grid-rows-[minmax(0,2fr)_minmax(0,3fr)]'
          }`}
        >
          {/* Sidebar: tu do (3D tren mobile: bottom sheet) */}
          <aside
            className={`h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#1F453E]/20 bg-white p-4 shadow-xs ${
              is3D ? 'hidden lg:col-span-3 lg:flex' : 'flex lg:col-span-4'
            }`}
          >
            {wardrobe}
          </aside>

          {/* Canvas / canh 3D + toolbar */}
          <section
            className={`flex h-full min-h-0 flex-col items-center justify-between overflow-hidden py-1 ${
              is3D ? (panelOpen ? 'lg:col-span-6' : 'lg:col-span-9') : 'lg:col-span-8'
            }`}
          >
            <div className="mb-2 flex shrink-0 flex-wrap items-center justify-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-full border border-[#1F453E]/25 bg-white p-1 shadow-sm">
                {toolbar.map(({ icon: Icon, label, run, needSel }) => (
                  <button
                    key={label}
                    onClick={() => runTool(run)}
                    disabled={needSel && !hasSelection}
                    title={label}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs text-[#1F453E] transition-colors hover:bg-[#E2ECC8] active:bg-[#1F453E] active:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                  >
                    <Icon size={13} />
                  </button>
                ))}
              </div>

              {/* ===== NEW: Body Profile ===== dieu khien mannequin */}
              <div className="inline-flex items-center gap-1 rounded-full border border-[#1F453E]/25 bg-white p-1 shadow-sm">
                <ToggleButton
                  active={showMannequin}
                  onClick={() => setShowMannequin((v) => !v)}
                  label={showMannequin ? 'Ẩn người mẫu' : 'Hiện người mẫu'}
                >
                  <PersonStanding size={13} />
                </ToggleButton>
                {/* Dang/gioi tinh nhanh cho canvas 2D; o 3D dung bang chinh thong so ben phai. */}
                {!is3D && (
                  <>
                    <select
                      value={mannequin.shape}
                      onChange={(e) => previewShape(e.target.value as BodyShape)}
                      title="Xem thử dáng khác (chỉ áp dụng cho outfit này, không lưu vào hồ sơ)"
                      className="h-7 rounded-full bg-transparent px-2 text-[11px] font-semibold text-[#1F453E] hover:bg-[#E2ECC8]/50 focus:outline-none"
                    >
                      {BODY_SHAPES.map((s) => (
                        <option key={s} value={s}>{BODY_SHAPE_LABELS[s]}</option>
                      ))}
                    </select>
                    <select
                      value={mannequin.gender}
                      onChange={(e) => previewGender(e.target.value as BodyGender)}
                      title="Xem thử dáng khác (chỉ áp dụng cho outfit này, không lưu vào hồ sơ)"
                      className="h-7 rounded-full bg-transparent px-2 text-[11px] font-semibold text-[#1F453E] hover:bg-[#E2ECC8]/50 focus:outline-none"
                    >
                      {BODY_GENDERS.map((g) => (
                        <option key={g} value={g}>{BODY_GENDER_LABELS[g]}</option>
                      ))}
                    </select>
                    {isPreviewing && (
                      <button
                        onClick={() => setMannequin(userProfile)}
                        title="Về dáng trong hồ sơ của tôi"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[#1F453E] transition-colors hover:bg-[#E2ECC8]"
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                  </>
                )}
                <ToggleButton
                  active={autoSnap}
                  onClick={() => setAutoSnap((v) => !v)}
                  label={autoSnap ? 'Tắt tự hút vào cơ thể' : 'Bật tự hút vào cơ thể'}
                >
                  <Magnet size={13} />
                </ToggleButton>
              </div>
              {/* ===== END NEW ===== */}

              {/* ===== NEW: Body 3D ===== che do 2D / 3D + mo bang tren mobile */}
              <div
                role="radiogroup"
                aria-label="Chế độ 2D / 3D"
                title="Chế độ 2D / 3D"
                className="inline-flex items-center gap-0.5 rounded-full border border-[#1F453E]/25 bg-white p-1 shadow-sm"
              >
                {(['2d', '3d'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    disabled={m === '3d' && !has3D}
                    onClick={() => switchMode(m)}
                    title={m === '3d' && !has3D ? 'Trình duyệt không hỗ trợ WebGL' : undefined}
                    className={`h-7 rounded-full px-3 text-[11px] font-bold transition-colors disabled:opacity-35 ${
                      mode === m ? 'bg-[#1F453E] text-white' : 'text-[#1F453E] hover:bg-[#E2ECC8]'
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
              {is3D && (
                <>
                  <button
                    type="button"
                    onClick={() => setPanelOpen((v) => !v)}
                    title={panelOpen ? 'Thu gọn bảng thông số' : 'Mở bảng thông số'}
                    className="hidden h-9 w-9 items-center justify-center rounded-full border border-[#1F453E]/25 bg-white text-[#1F453E] shadow-sm hover:bg-[#E2ECC8] lg:inline-flex"
                  >
                    {panelOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
                  </button>
                  <div className="inline-flex gap-1 lg:hidden">
                    <button
                      type="button"
                      onClick={() => setSheet('wardrobe')}
                      className="inline-flex items-center gap-1 rounded-full border border-[#1F453E]/25 bg-white px-3 py-1.5 text-[11px] font-bold text-[#1F453E] shadow-sm"
                    >
                      <Shirt size={13} /> Tủ đồ
                    </button>
                    <button
                      type="button"
                      onClick={() => setSheet('body')}
                      className="inline-flex items-center gap-1 rounded-full border border-[#1F453E]/25 bg-white px-3 py-1.5 text-[11px] font-bold text-[#1F453E] shadow-sm"
                    >
                      <SlidersHorizontal size={13} /> Thông số
                    </button>
                  </div>
                </>
              )}
              {/* ===== END NEW ===== */}
            </div>

            {is3D ? (
              // ===== NEW: Body 3D =====
              <div className="min-h-0 w-full flex-1">
                <Outfit3DStage
                  apiRef={stageRef}
                  body={body3D}
                  showModel={showMannequin}
                  autoSnap={autoSnap}
                  resolveItem={(id) => knownItemsRef.current.get(id)}
                  onSelectionChange={handleSelectionChange}
                  onReady={handleStageReady}
                />
              </div>
            ) : (
              /* Vung con lai giua toolbar va dong meo: canvas tu scale cho vua */
              <div ref={setFitEl} className="flex min-h-0 w-full flex-1 items-center justify-center">
                <div className="rounded-2xl border-2 border-[#1F453E]/15 bg-white p-2 shadow-[0_8px_30px_rgba(31,69,62,0.06)]">
                  <OutfitCanvas
                    ref={canvasRef}
                    onSelectionChange={handleSelectionChange}
                    scale={canvasScale}
                    mannequin={mannequin}
                    showMannequin={showMannequin}
                    autoSnap={autoSnap}
                    onReady={handleCanvasReady}
                  />
                </div>
              </div>
            )}

            <p className="mt-2 shrink-0 rounded-full border border-[#1F453E]/10 bg-[#E2ECC8]/50 px-3 py-1 text-center text-[11px] font-medium text-[#1F453E]">
              {is3D
                ? 'Mẹo: kéo để xoay, cuộn để phóng to. Món đồ tự hút vào cơ thể, giữ Shift khi kéo để đặt tự do, Ctrl + bấm để chọn nhiều, Delete để xóa.'
                : 'Mẹo: món đồ tự hút vào cơ thể khi kéo gần, giữ Shift để đặt tự do, Ctrl + bấm để chọn nhiều. Delete để xóa nhanh.'}
            </p>
          </section>

          {/* ===== NEW: Body 3D ===== bang chinh thong so (desktop) */}
          {is3D && panelOpen && (
            <aside className="hidden h-full min-h-0 overflow-y-auto rounded-2xl border border-[#1F453E]/20 bg-white p-4 shadow-xs lg:col-span-3 lg:block">
              <h2 className="mb-3 border-b border-[#E2ECC8] pb-2 font-serif-display text-base font-semibold text-[#1F453E]">
                Thông số người mẫu
              </h2>
              {bodyPanel}
            </aside>
          )}
          {/* ===== END NEW ===== */}
        </div>
      </div>

      {/* ===== NEW: Body 3D ===== bottom sheet tren mobile */}
      {is3D && (
        <BottomSheet
          open={sheet !== null}
          title={sheet === 'body' ? 'Thông số người mẫu' : 'Tủ đồ'}
          onClose={() => setSheet(null)}
        >
          {sheet === 'body' ? bodyPanel : <div className="flex h-[55dvh] flex-col">{wardrobe}</div>}
        </BottomSheet>
      )}

      <VModal open={saveBodyOpen} onClose={() => setSaveBodyOpen(false)} title="Lưu số đo này vào hồ sơ?">
        <p className="mb-5 text-sm text-[#2C4C45]">
          Giới tính, dáng, số đo, cân nặng và màu mô hình đang xem thử sẽ thay cho dữ liệu trong hồ sơ của bạn.
          Dữ liệu này chỉ mình bạn thấy.
        </p>
        <div className="flex gap-2">
          <VButton variant="outline" onClick={() => setSaveBodyOpen(false)} className="flex-1">
            Hủy
          </VButton>
          <VButton onClick={() => void saveBodyToProfile()} loading={savingBody} className="flex-1">
            Lưu vào hồ sơ
          </VButton>
        </div>
      </VModal>
      {/* ===== END NEW ===== */}

      {/* Modal luu outfit */}
      <VModal open={saveOpen} onClose={() => setSaveOpen(false)} title={editing ? 'Cập nhật outfit' : 'Lưu outfit'}>
        <div className="space-y-4">
          <VInput
            label="Tên outfit"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Đi làm ngày mưa"
          />

          <div>
            <VLabel>Dịp mặc</VLabel>
            <div className="flex flex-wrap gap-1.5">
              {OCCASIONS.map((o) => (
                <VChip
                  key={o}
                  active={form.occasions.includes(o)}
                  onClick={() =>
                    setForm({
                      ...form,
                      occasions: form.occasions.includes(o)
                        ? form.occasions.filter((x) => x !== o)
                        : [...form.occasions, o],
                    })
                  }
                >
                  {OCCASION_LABELS[o]}
                </VChip>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-[#1F453E]">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) =>
                // NEW: Body Profile - chia se cong khai thi mac dinh bo bong nguoi khoi thumbnail.
                setForm({
                  ...form,
                  isPublic: e.target.checked,
                  includeMannequin: e.target.checked ? false : form.includeMannequin,
                })
              }
              className="h-4 w-4 accent-[#1F453E]"
            />
            Chia sẻ công khai lên feed OOTD
          </label>

          {/* ===== NEW: Body Profile ===== */}
          <label
            className={`flex items-start gap-2 text-sm text-[#1F453E] ${showMannequin ? '' : 'opacity-50'}`}
          >
            <input
              type="checkbox"
              checked={showMannequin && form.includeMannequin}
              disabled={!showMannequin}
              onChange={(e) => setForm({ ...form, includeMannequin: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-[#1F453E]"
            />
            <span>
              Kèm người mẫu trong ảnh xem trước
              {form.isPublic && showMannequin && (
                <span className="block text-xs text-[#6B7B76]">
                  Outfit công khai: mặc định không kèm để dáng người của bạn luôn riêng tư.
                </span>
              )}
            </span>
          </label>
          {/* ===== END NEW ===== */}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <VButton variant="outline" onClick={() => setSaveOpen(false)} className="flex-1">
              Hủy
            </VButton>
            <VButton
              onClick={handleSave}
              loading={saving}
              disabled={!form.name.trim()}
              className="flex-1"
            >
              {editing ? 'Cập nhật' : 'Lưu'}
            </VButton>
          </div>
        </div>
      </VModal>

      {/* ===== NEW: Body Profile ===== chon outfit da luu de mo lai */}
      <VModal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Mở outfit đã lưu" wide>
        {savedOutfits === null ? (
          <div className="grid h-40 place-items-center">
            <VSpinner />
          </div>
        ) : savedOutfits.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#6B7B76]">Bạn chưa lưu outfit nào.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {savedOutfits.map((o) => (
              <button
                key={o._id}
                onClick={() => void openOutfit(o._id)}
                disabled={openingId !== null}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#FAF9F5] text-left transition-all hover:border-[#1F453E] disabled:opacity-60"
              >
                <div className="grid aspect-[6/7] place-items-center bg-white">
                  {o.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.thumbnailUrl} alt={o.name} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <Layers size={24} className="text-[#869BB2]" />
                  )}
                </div>
                <span className="flex items-center gap-1.5 truncate px-2.5 py-2 text-xs font-semibold">
                  {o.name}
                  {/* NEW: Body 3D */}
                  {o.scene3D && (
                    <span className="rounded-full bg-[#1F453E] px-1.5 text-[9px] font-bold text-white">3D</span>
                  )}
                </span>
                {openingId === o._id && (
                  <span className="absolute inset-0 grid place-items-center bg-white/60">
                    <VSpinner />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </VModal>
      {/* ===== END NEW ===== */}

      <VToast message={toast} onClose={closeToast} />
    </ProtectedLayout>
  );
}

// ===== NEW: Body 3D =====
/** Danh sach tu do (dung o sidebar va bottom sheet). Che do 3D: keo-tha duoc vao nguoi mau. */
function WardrobePicker({
  category,
  onCategory,
  loading,
  items,
  draggable,
  onPick,
  hint,
}: {
  category: Category | 'all';
  onCategory: (c: Category | 'all') => void;
  loading: boolean;
  items: ClothingItem[];
  draggable: boolean;
  onPick: (item: ClothingItem) => void;
  hint?: string;
}) {
  return (
    <>
      <h2 className="mb-2.5 shrink-0 border-b border-[#E2ECC8] pb-2 font-serif-display text-base font-semibold text-[#1F453E]">
        Tủ đồ
        {hint && <span className="ml-2 font-jakarta text-[10px] font-medium text-[#6B7B76]">{hint}</span>}
      </h2>

      <div className="mb-3 flex shrink-0 flex-wrap gap-1.5">
        <SidebarChip active={category === 'all'} onClick={() => onCategory('all')}>
          Tất cả
        </SidebarChip>
        {CATEGORIES.map((c) => (
          <SidebarChip key={c} active={category === c} onClick={() => onCategory(c)}>
            {CATEGORY_LABELS[c]}
          </SidebarChip>
        ))}
      </div>

      {/* Chi cuon ben trong khung nay, khong lam dai trang */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="grid h-full place-items-center">
            <VSpinner />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-[#869BB2]/50 bg-[#FAF9F5]/60 p-6 text-center">
            <p className="mb-3 text-xs text-[#6B7B76]">Chưa có món đồ nào ở mục này.</p>
            <Link
              href="/wardrobe"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#1F453E] bg-white px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#1F453E] transition-colors hover:bg-[#1F453E] hover:text-white"
            >
              <Plus size={14} /> Thêm vào tủ đồ
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pr-1">
            {items.map((item) => (
              <button
                key={item._id}
                onClick={() => onPick(item)}
                draggable={draggable}
                onDragStart={(e) => {
                  e.dataTransfer.setData(ITEM_DRAG_MIME, item._id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                title={draggable ? `Kéo "${item.name}" thả lên người mẫu, hoặc bấm để thêm` : `Thêm "${item.name}" lên canvas`}
                className={`grid aspect-square place-items-center rounded-xl border border-[#E2E8F0] bg-[#FAF9F5] p-2 transition-all hover:border-[#1F453E] hover:bg-[#E2ECC8]/30 ${
                  draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  loading="lazy"
                  draggable={false}
                  className="max-h-full max-w-full object-contain"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** Bang truot tu duoi len tren mobile. */
function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Đóng" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="mx-auto h-1 w-10 rounded-full bg-[#869BB2]/50" aria-hidden />
        </div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-serif-display text-base font-semibold text-[#1F453E]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-full p-1 text-[#1F453E] hover:bg-[#E2ECC8]">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
// ===== END NEW =====

/** Nut loc danh muc trong sidebar (nen kem, khac VChip o trang Tu do). */
function SidebarChip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
        active
          ? 'border-[#1F453E] bg-[#1F453E] text-white shadow-xs'
          : 'border-[#869BB2]/60 bg-[#FAF9F5] text-[#1F453E] hover:border-[#1F453E] hover:bg-[#E2ECC8]/40'
      }`}
    >
      {children}
    </button>
  );
}

// ===== NEW: Body Profile =====
/** Nut bat/tat tren toolbar canvas. */
function ToggleButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={active}
      className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
        active ? 'bg-[#1F453E] text-white' : 'text-[#1F453E] hover:bg-[#E2ECC8]'
      }`}
    >
      {children}
    </button>
  );
}
// ===== END NEW =====

/** Khung trang (p-2 + border-2) + vien net dut cua OutfitCanvas, tinh theo px. */
const CANVAS_FRAME = 22;

/**
 * Do vung trong con lai va tra ve ti le de canvas vua khit (toi da 1 = kich thuoc that).
 * Chi anh huong hien thi; Fabric van lam viec tren canvas CANVAS_WIDTH x CANVAS_HEIGHT.
 * Dung callback ref (state) thay vi useRef de khong doc ref trong luc render.
 */
function useFitScale() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const fit = Math.min(
        1,
        (width - CANVAS_FRAME) / CANVAS_WIDTH,
        (height - CANVAS_FRAME) / CANVAS_HEIGHT
      );
      setScale(Math.max(0.2, fit));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);

  return [setEl, scale] as const;
}
