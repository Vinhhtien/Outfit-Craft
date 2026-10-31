'use client';
import { useCategoryLabels } from '@/store/categoryStore';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Save, Trash2, ArrowUp, ArrowDown, FlipHorizontal,
  Layers, Eraser, Plus,
  // ===== NEW: Body Profile =====
  PersonStanding, Magnet, FolderOpen, FilePlus, RotateCcw, SlidersHorizontal, X,
  // ===== END NEW =====
  BookmarkCheck, // NEW: Ghi nho fit
} from 'lucide-react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { ScallopBanner } from '@/components/layout/ScallopBanner';
import { OutfitCanvas, type OutfitCanvasHandle } from '@/components/canvas/OutfitCanvas';
import { VButton, VChip, VInput, VLabel, VModal, VSpinner, VToast } from '@/components/ui/vintage';
import { itemApi, outfitApi, bodyProfileApi } from '@/lib/services';
import { ErrorState, LoadingState } from '@/components/ui/AsyncState';
import { CloudImage } from '@/components/ui/CloudImage';
import { useAuthStore } from '@/store/authStore';
import { queueFitSave, flushFitSaves } from '@/store/fitSaveQueue';
import { getErrorMessage } from '@/lib/api';
import { CANVAS_WIDTH, CANVAS_HEIGHT, needsLayoutUpgrade } from '@/lib/fabricCanvas';
// ===== NEW: Body Profile =====
import { DEFAULT_MANNEQUIN, buildMannequin, resolveMannequinProfile } from '@/lib/mannequin';
import { scene3DToPlacements, shouldBuildFromScene3D } from '@/lib/legacyScene3D';
import { BodyControlsPanel } from '@/components/body/BodyControlsPanel';
import { DeleteConfirmModal } from '@/components/wardrobe/DeleteConfirmModal'; // NEW: Delete Outfit
import {
  bodyStateFromProfile, bodyStateToMannequin, bodyStateToProfile, sameBodyState, type BodyState,
} from '@/lib/bodyMetrics';
// ===== END NEW =====
import { CATEGORIES, OCCASIONS, OCCASION_LABELS } from '@/types';
import type { Category, ClothingItem, ItemFit, MannequinProfile, Occasion, Outfit } from '@/types';

const EMPTY_FORM = {
  name: '',
  occasions: [] as Occasion[],
  isPublic: false,
  /** Kem bong nguoi trong anh thumbnail. */
  includeMannequin: true,
};

export default function StudioPage() {
  const canvasRef = useRef<OutfitCanvasHandle>(null);
  const userId = useAuthStore((state) => state.user?.id);
  const busyRef = useRef(false);
  const [canvasBusy, setCanvasBusy] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [initialError, setInitialError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [pickerError, setPickerError] = useState('');
  const pickerRequest = useRef<AbortController | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const addRef = useRef(false);
  const saveRef = useRef(false);
  const creationKey = useRef('');
  useEffect(() => () => pickerRequest.current?.abort(), []);
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
  /** Số đo trong hồ sơ của user (mặc định rectangle/neutral). */
  const [userBody, setUserBody] = useState<BodyState>(() => bodyStateFromProfile(null));
  /** Số đo đang xem thử cho outfit này - chỉnh trên bảng không ghi vào hồ sơ. */
  const [body, setBody] = useState<BodyState>(userBody);
  const mannequin = useMemo(() => bodyStateToMannequin(body), [body]);
  const [showMannequin, setShowMannequin] = useState(true);
  const [bodySheetOpen, setBodySheetOpen] = useState(false);
  const [saveBodyOpen, setSaveBodyOpen] = useState(false);
  const [savingBody, setSavingBody] = useState(false);
  const savingBodyRef = useRef(false);
  const [bodySaveError, setBodySaveError] = useState('');
  const [autoSnap, setAutoSnap] = useState(true);

  /** Outfit đang mở để sửa (null = phối mới). */
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savedOutfits, setSavedOutfits] = useState<Outfit[] | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  // ===== NEW: Delete Outfit =====
  const [outfitToDelete, setOutfitToDelete] = useState<Outfit | null>(null);
  const [deletingOutfit, setDeletingOutfit] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const closeDeleteError = useCallback(() => setDeleteError(null), []);
  // ===== END NEW =====

  // ===== NEW: Ghi nho fit =====
  const [fitError, setFitError] = useState<string | null>(null);
  const closeFitError = useCallback(() => setFitError(null), []);
  const handleItemFit = useCallback((itemId: string, fit: ItemFit) => {
    if (!userId) return;
    queueFitSave(userId, itemId, fit);
    setItems((list) => list.map((item) => item._id === itemId ? { ...item, fit } : item));
  }, [userId]);

  useEffect(() => () => {
    if (userId) void flushFitSaves(userId);
  }, [userId]);
  /** Nut tren toolbar: ghi nho (de) vi tri + co hien tai cua mon dang chon. */
  const rememberSelectedFit = (c: OutfitCanvasHandle) => {
    const selected = c.getSelectedFit();
    if (!selected) {
      setFitError('Hãy chọn một món đồ để ghi nhớ vị trí & cỡ.');
      return;
    }
    if (!selected.fit) {
      setFitError('Món đồ đang đặt tự do. Kéo sát vào người mẫu (cổ áo khớp cổ, cạp quần khớp eo) rồi ghi nhớ lại.');
      return;
    }
    if (userId) queueFitSave(userId, selected.itemId, selected.fit, 0);
  };
  // ===== END NEW =====

  /** Outfit cho canvas san sang de nap. */
  const pendingRef = useRef<Outfit | null>(null);
  const readyRef = useRef(false);
  const userBodyRef = useRef<BodyState>(userBody);
  /** Hồ sơ như đã lưu (có thể thiếu số đo) - hình thế hệ cũ vẽ từ đúng dữ liệu này. */
  const userProfileRef = useRef<MannequinProfile>(DEFAULT_MANNEQUIN);

  const applyOutfit = useCallback(async (outfit: Outfit) => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('Khung phối đồ chưa sẵn sàng. Vui lòng chờ một lát.');
    const scene = outfit.scene3D;
    const fromScene = shouldBuildFromScene3D(outfit);
    // Outfit cu (khong co mannequin) hoac luu luc tat mannequin -> an mannequin, hien y nhu truoc.
    // Outfit 3D cu: an/hien theo showModel; dang lay tu snapshot (mannequin hoac bodySnapshot).
    const visible = fromScene && scene ? scene.showModel : Boolean(outfit.mannequin);
    const snapshot = outfit.mannequin ?? (fromScene ? scene?.bodySnapshot : undefined);
    const savedProfile = snapshot ? resolveMannequinProfile(snapshot) : userProfileRef.current;
    const nextBody = snapshot ? bodyStateFromProfile(savedProfile) : userBodyRef.current;
    const profile = bodyStateToMannequin(nextBody);

    if (fromScene && scene) {
      // Outfit cu phoi o che do 3D (da bo): canvasJSON rong -> dung lai tu scene3D (chi doc).
      await canvas.loadJSON({}, [], profile, visible);
      const byId = new Map(
        outfit.items
          .map((i) => i.item)
          .filter((it): it is ClothingItem => typeof it !== 'string' && Boolean(it))
          .map((it) => [it._id, it])
      );
      const placed = scene3DToPlacements(scene, (id) => byId.get(id)?.category, buildMannequin(profile).anchors);
      await canvas.addPlacedItems(placed.map((placement) => ({ item: byId.get(placement.itemId)!, placement })));
    } else {
      // Outfit luu theo hinh the he cu -> dat lai mon do len hinh hien tai.
      await canvas.loadJSON(
        outfit.canvasJSON ?? {},
        outfit.items,
        profile,
        visible,
        needsLayoutUpgrade(outfit) ? savedProfile : null
      );
    }
    setBody(nextBody);
    setShowMannequin(visible);
    setEditing({ id: outfit._id, name: outfit.name });
    setForm({
      name: outfit.name,
      occasions: outfit.occasions ?? [],
      isPublic: outfit.isPublic,
      includeMannequin: visible && !outfit.isPublic,
    });
  }, []);

  /** Mon do mang tu trang Goi y (?items=id1,id2) -> dat len canvas de thu ngay. */
  const pendingTryOnRef = useRef<ClothingItem[] | null>(null);

  /** Nap outfit dang cho khi canvas da san sang. */
  const flushPending = useCallback(() => {
    const tryOn = pendingTryOnRef.current;
    if (tryOn && readyRef.current) {
      pendingTryOnRef.current = null;
      setCanvasBusy(true);
      busyRef.current = true;
      void (async () => {
        try {
          for (const item of tryOn) await canvasRef.current?.addItem(item);
        } catch (err) {
          setError(getErrorMessage(err));
        } finally {
          busyRef.current = false;
          setCanvasBusy(false);
        }
      })();
      return;
    }
    const outfit = pendingRef.current;
    if (!outfit || !readyRef.current) return;
    pendingRef.current = null;
    setCanvasBusy(true);
    busyRef.current = true;
    applyOutfit(outfit).catch((err) => setError(getErrorMessage(err))).finally(() => { busyRef.current = false; setCanvasBusy(false); });
  }, [applyOutfit]);

  const handleCanvasReady = useCallback(() => {
    readyRef.current = true;
    flushPending();
  }, [flushPending]);
  // ===== END NEW =====

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    void (async () => {
      setInitializing(true);
      setLoadingItems(true);
      setInitialError('');
      try {
        const [response, raw] = await Promise.all([itemApi.list({ limit: 100 }, controller.signal), bodyProfileApi.get(controller.signal)]);
        if (controller.signal.aborted) return;
        setItems(response.data);
        userProfileRef.current = resolveMannequinProfile(raw);
        const mine = bodyStateFromProfile(raw);
        userBodyRef.current = mine;
        setUserBody(mine);
        const params = new URLSearchParams(window.location.search);
        const outfitId = params.get('outfit');
        const tryOnIds = [...new Set((params.get('items') ?? '').split(',').filter(Boolean))];
        if (!outfitId && tryOnIds.length > 0) {
          setBody(mine);
          const byId = new Map(response.data.map((it) => [it._id, it]));
          const tryOn = await Promise.all(tryOnIds.map((id) => byId.get(id) ?? itemApi.get(id, controller.signal)));
          if (controller.signal.aborted) return;
          window.history.replaceState(null, '', '/studio');
          pendingTryOnRef.current = tryOn;
          flushPending();
        } else if (!outfitId) setBody(mine);
        else {
          const outfit = await outfitApi.get(outfitId, controller.signal);
          if (controller.signal.aborted) return;
          pendingRef.current = outfit;
          flushPending();
        }
      } catch (err) {
        if (!controller.signal.aborted) setInitialError(getErrorMessage(err));
      } finally {
        if (!controller.signal.aborted) { setLoadingItems(false); setInitializing(false); }
      }
    })();
    return () => { controller.abort(); pendingRef.current = null; pendingTryOnRef.current = null; };
  }, [flushPending, userId, reloadVersion]);

  const addCanvasItem = async (item: ClothingItem) => {
    if (addRef.current || busyRef.current || initializing || initialError) return;
    addRef.current = true; setAddingItem(true); setError('');
    try {
      const added = await canvasRef.current?.addItem(item);
      if (added === false) setToast(`"${item.name}" đã có trên canvas - mỗi món chỉ thêm được 1 lần.`);
    }
    catch (err) { setError(getErrorMessage(err)); }
    finally { addRef.current = false; setAddingItem(false); }
  };

  const filtered =
    category === 'all' ? items : items.filter((i) => i.category === category);

  const handleSelectionChange = useCallback((v: boolean) => setHasSelection(v), []);
  const closeToast = useCallback(() => setToast(null), []);

  // ===== NEW: Body Profile =====
  const startNewOutfit = () => {
    if (busyRef.current || addRef.current || saveRef.current) return;
    creationKey.current = '';
    canvasRef.current?.clear();
    setEditing(null);
    setForm(EMPTY_FORM);
    setBody(userBodyRef.current);
    setShowMannequin(true);
    window.history.replaceState(null, '', '/studio');
  };

  const openPicker = async () => {
    pickerRequest.current?.abort();
    const request = new AbortController();
    pickerRequest.current = request;
    setPickerOpen(true);
    setPickerError('');
    setSavedOutfits(null);
    try {
      const all: Outfit[] = [];
      let page = 1;
      let pages = 1;
      do {
        const res = await outfitApi.list({ page }, request.signal);
        all.push(...res.data); pages = res.pagination?.pages ?? 1; page++;
      } while (page <= pages);
      if (!request.signal.aborted) setSavedOutfits(all);
    } catch (err) {
      if (!request.signal.aborted) setPickerError(getErrorMessage(err));
    }
  };

  const openOutfit = async (id: string) => {
    if (busyRef.current || addRef.current) return;
    busyRef.current = true;
    setCanvasBusy(true);
    setPickerError('');
    setOpeningId(id);
    try {
      // GET /outfits/:id populate day du item (co category) -> dung cho outfit cu.
      await applyOutfit(await outfitApi.get(id));
      window.history.replaceState(null, '', `/studio?outfit=${id}`);
      setPickerOpen(false);
    } catch (err) {
      setPickerError(getErrorMessage(err));
    } finally {
      busyRef.current = false;
      setCanvasBusy(false);
      setOpeningId(null);
    }
  };

  // ===== NEW: Delete Outfit =====
  const confirmDeleteOutfit = async () => {
    const target = outfitToDelete;
    if (!target) return;
    setDeletingOutfit(true);
    try {
      await outfitApi.remove(target._id);
      setSavedOutfits((list) => list?.filter((o) => o._id !== target._id) ?? null);
      // Dang sua dung outfit vua xoa: giu nguyen canvas, chuyen sang phoi moi de lan luu sau tao outfit moi.
      if (editing?.id === target._id) {
        setEditing(null);
        window.history.replaceState(null, '', '/studio');
      }
      setToast(`Đã xóa outfit "${target.name}".`);
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    } finally {
      setDeletingOutfit(false);
      setOutfitToDelete(null);
    }
  };
  // ===== END NEW =====

  /** Đang xem thử số đo khác hồ sơ. */
  const isPreviewing = !sameBodyState(body, userBody);

  const saveBodyToProfile = async () => {
    if (savingBodyRef.current) return;
    savingBodyRef.current = true;
    setBodySaveError('');
    setSavingBody(true);
    try {
      // PUT gop: chi gui so do da co / da chinh, phan con lai trong ho so giu nguyen.
      const saved = await bodyProfileApi.save(bodyStateToProfile(body));
      userProfileRef.current = resolveMannequinProfile(saved);
      const mine = bodyStateFromProfile(saved);
      userBodyRef.current = mine;
      setUserBody(mine);
      setBody(mine);
      setSaveBodyOpen(false);
      setToast('Đã lưu số đo vào hồ sơ.');
    } catch (err) {
      setBodySaveError(getErrorMessage(err));
    } finally {
      savingBodyRef.current = false;
      setSavingBody(false);
    }
  };
  // ===== END NEW =====

  const handleSave = async () => {
    if (saveRef.current || busyRef.current || addRef.current || initializing || initialError) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { items: outfitItems, canvasJSON, mannequin: snapshot } = canvas.serialize();
    if (outfitItems.length === 0) {
      setError('Hãy thêm ít nhất một món đồ lên canvas trước khi lưu.');
      return;
    }

    saveRef.current = true;
    setSaving(true);
    setError('');
    try {
      if (!creationKey.current) creationKey.current = crypto.randomUUID();
      const body = {
        ...(!editing ? { creationKey: creationKey.current } : {}),
        name: form.name.trim(),
        items: outfitItems,
        canvasJSON,
        thumbnailDataUrl: canvas.exportThumbnail(form.includeMannequin),
        occasions: form.occasions,
        isPublic: form.isPublic,
        mannequin: snapshot, // NEW: Body Profile
      };
      const saved = editing ? await outfitApi.update(editing.id, body) : await outfitApi.create(body);
      setEditing({ id: saved._id, name: saved.name });
      window.history.replaceState(null, '', `/studio?outfit=${saved._id}`);

      setSaveOpen(false);
      setToast(editing ? 'Đã cập nhật outfit!' : 'Đã lưu outfit vào bộ sưu tập!');
      creationKey.current = '';
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      saveRef.current = false;
      setSaving(false);
    }
  };

  // Action nhan handle lam tham so (khong dong goi canvasRef) -> khong bi coi la doc ref luc render.
  const toolbar: { icon: typeof ArrowUp; label: string; run: (c: OutfitCanvasHandle) => void; needSel: boolean }[] = [
    { icon: ArrowUp, label: 'Đưa lên trên', run: (c) => c.bringForward(), needSel: true },
    { icon: ArrowDown, label: 'Đưa xuống dưới', run: (c) => c.sendBackward(), needSel: true },
    { icon: FlipHorizontal, label: 'Lật ngang', run: (c) => c.flipSelected(), needSel: true },
    { icon: Trash2, label: 'Xóa khỏi canvas', run: (c) => c.removeSelected(), needSel: true },
    { icon: Layers, label: 'Tự sắp lớp theo loại', run: (c) => c.autoArrange(), needSel: false },
    { icon: Eraser, label: 'Xóa toàn bộ món đồ', run: (c) => c.clear(), needSel: false },
  ];
  const runTool = (run: (c: OutfitCanvasHandle) => void) => {
    const handle = canvasRef.current;
    if (handle) run(handle);
  };

  // ===== NEW: Body Profile =====
  const bodyPanel = (
    <BodyControlsPanel
      value={body}
      onChange={setBody}
      header={
        <p className="rounded-lg bg-[#E2ECC8]/50 px-3 py-2 text-[11px] leading-snug text-[#2C4C45]">
          Đang xem thử: số đo ở đây chỉ áp dụng cho outfit này, không ghi vào hồ sơ.
        </p>
      }
      footer={
        <div className="flex flex-col gap-2 border-t border-dashed border-[#869BB2]/50 pt-3">
          <button
            type="button"
            onClick={() => setBody(userBodyRef.current)}
            disabled={!isPreviewing}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#1F453E] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#1F453E] transition-colors hover:bg-[#E2ECC8]/50 disabled:opacity-40"
          >
            <RotateCcw size={12} /> Về số đo trong hồ sơ
          </button>
          <button
            type="button"
            onClick={() => setSaveBodyOpen(true)}
            disabled={!isPreviewing}
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

        {initialError && <div className="mx-auto w-full max-w-7xl px-6"><ErrorState message={initialError} onRetry={() => setReloadVersion((value) => value + 1)} /></div>}
        {(initializing || canvasBusy || addingItem) && <LoadingState compact label={addingItem ? 'Đang thêm ảnh lên canvas…' : 'Đang chuẩn bị khung phối đồ…'} />}
        {error && !saveOpen && (
          <div className="mx-auto w-full max-w-7xl shrink-0 px-6 pt-3 lg:px-10">
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="mx-auto grid min-h-0 w-full max-w-[90rem] flex-1 grid-cols-1 grid-rows-[minmax(0,2fr)_minmax(0,3fr)] items-stretch gap-5 overflow-hidden px-6 py-3 lg:grid-cols-12 lg:grid-rows-1 lg:px-10">
          {/* Sidebar: tu do */}
          <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#1F453E]/20 bg-white p-4 shadow-xs lg:col-span-3">
            <WardrobePicker
              category={category}
              onCategory={setCategory}
              loading={loadingItems}
              items={filtered}
              onPick={(item) => void addCanvasItem(item)}
            />
          </aside>

          {/* Canvas + toolbar */}
          <section className={`flex h-full min-h-0 flex-col items-center justify-between overflow-hidden py-1 lg:col-span-6 ${initializing || canvasBusy || addingItem || initialError ? 'pointer-events-none opacity-60' : ''}`}>
            <div className="mb-2 flex shrink-0 flex-wrap items-center justify-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-full border border-[#1F453E]/25 bg-white p-1 shadow-sm">
                {toolbar.map(({ icon: Icon, label, run, needSel }) => (
                  <button
                    key={label}
                    onClick={() => runTool(run)}
                    disabled={initializing || canvasBusy || addingItem || (needSel && !hasSelection)}
                    title={label}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs text-[#1F453E] transition-colors hover:bg-[#E2ECC8] active:bg-[#1F453E] active:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                  >
                    <Icon size={13} />
                  </button>
                ))}
                {/* NEW: Ghi nho fit - tach khoi mang toolbar vi doc ref (khong duoc nam trong du lieu render) */}
                <button
                  onClick={() => runTool(rememberSelectedFit)}
                  disabled={initializing || canvasBusy || addingItem || !hasSelection}
                  title="Ghi nhớ vị trí & cỡ món này cho lần sau"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs text-[#1F453E] transition-colors hover:bg-[#E2ECC8] active:bg-[#1F453E] active:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                >
                  <BookmarkCheck size={13} />
                </button>
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
                <ToggleButton
                  active={autoSnap}
                  onClick={() => setAutoSnap((v) => !v)}
                  label={autoSnap ? 'Tắt tự hút vào cơ thể' : 'Bật tự hút vào cơ thể'}
                >
                  <Magnet size={13} />
                </ToggleButton>
              </div>
              {/* Bang so do tren mobile (desktop luon hien o cot phai) */}
              <button
                type="button"
                onClick={() => setBodySheetOpen(true)}
                className="inline-flex items-center gap-1 rounded-full border border-[#1F453E]/25 bg-white px-3 py-1.5 text-[11px] font-bold text-[#1F453E] shadow-sm lg:hidden"
              >
                <SlidersHorizontal size={13} /> Số đo
              </button>
              {/* ===== END NEW ===== */}
            </div>

            {/* Vung con lai giua toolbar va dong meo: canvas tu scale cho vua */}
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
                  onItemFit={handleItemFit}
                />
              </div>
            </div>

            <p className="mt-2 shrink-0 rounded-full border border-[#1F453E]/10 bg-[#E2ECC8]/50 px-3 py-1 text-center text-[11px] font-medium text-[#1F453E]">
              Mẹo: lần đầu thử một món, kéo cho vừa (cổ áo khớp cổ, cạp quần khớp eo) - vị trí & cỡ được ghi nhớ cho lần sau. Giữ Shift để đặt tự do, Ctrl + bấm để chọn nhiều.
            </p>
          </section>

          {/* ===== NEW: Body Profile ===== bang so do (desktop) */}
          <aside className="hidden h-full min-h-0 overflow-y-auto rounded-2xl border border-[#1F453E]/20 bg-white p-4 shadow-xs lg:col-span-3 lg:block">
            <h2 className="mb-3 border-b border-[#E2ECC8] pb-2 font-serif-display text-base font-semibold text-[#1F453E]">
              Số đo người mẫu
            </h2>
            {bodyPanel}
          </aside>
          {/* ===== END NEW ===== */}
        </div>
      </div>

      {/* ===== NEW: Body Profile ===== bang so do (mobile) + xac nhan luu vao ho so */}
      <BottomSheet open={bodySheetOpen} title="Số đo người mẫu" onClose={() => setBodySheetOpen(false)}>
        {bodyPanel}
      </BottomSheet>

      <VModal open={saveBodyOpen} onClose={() => setSaveBodyOpen(false)} busy={savingBody} title="Lưu số đo này vào hồ sơ?">
        {bodySaveError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{bodySaveError}</p>}
        <p className="mb-5 text-sm text-[#2C4C45]">
          Giới tính, dáng và các số đo đang xem thử sẽ được ghi vào hồ sơ của bạn (số đo nào bạn chưa nhập thì
          hồ sơ giữ nguyên). Dữ liệu này chỉ mình bạn thấy.
        </p>
        <div className="flex gap-2">
          <VButton variant="outline" disabled={savingBody} onClick={() => setSaveBodyOpen(false)} className="flex-1">
            Hủy
          </VButton>
          <VButton onClick={() => void saveBodyToProfile()} loading={savingBody} className="flex-1">
            Lưu vào hồ sơ
          </VButton>
        </div>
      </VModal>
      {/* ===== END NEW ===== */}

      {/* Modal luu outfit */}
      <VModal open={saveOpen} onClose={() => setSaveOpen(false)} busy={saving} title={editing ? 'Cập nhật outfit' : 'Lưu outfit'}>
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
      <VModal open={pickerOpen} onClose={() => { pickerRequest.current?.abort(); setPickerOpen(false); }} busy={Boolean(openingId)} title="Mở outfit đã lưu" wide>
        {pickerError ? <ErrorState message={pickerError} onRetry={() => void openPicker()} /> : savedOutfits === null ? (
          <div className="grid h-40 place-items-center">
            <VSpinner />
          </div>
        ) : savedOutfits.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#6B7B76]">Bạn chưa lưu outfit nào.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {savedOutfits.map((o) => (
              // NEW: Delete Outfit - boc trong div de dat nut xoa canh nut mo (khong long button).
              <div key={o._id} className="group relative">
                <button
                  onClick={() => void openOutfit(o._id)}
                  disabled={openingId !== null}
                  className="relative flex w-full flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#FAF9F5] text-left transition-all hover:border-[#1F453E] disabled:opacity-60"
                >
                  <div className="grid aspect-[6/7] place-items-center bg-white">
                    {o.thumbnailUrl ? (
                      <CloudImage src={o.thumbnailUrl} alt={o.name} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <Layers size={24} className="text-[#869BB2]" />
                    )}
                  </div>
                  <span className="truncate px-2.5 py-2 pr-9 text-xs font-semibold">{o.name}</span>
                  {openingId === o._id && (
                    <span className="absolute inset-0 grid place-items-center bg-white/60">
                      <VSpinner />
                    </span>
                  )}
                </button>
                {/* ===== NEW: Delete Outfit ===== */}
                <button
                  type="button"
                  onClick={() => setOutfitToDelete(o)}
                  disabled={openingId !== null || deletingOutfit}
                  title={`Xóa outfit "${o.name}"`}
                  aria-label={`Xóa outfit ${o.name}`}
                  className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full text-[#8C2D19] transition-colors hover:bg-[#8C2D19] hover:text-white disabled:opacity-40"
                >
                  <Trash2 size={13} />
                </button>
                {/* ===== END NEW ===== */}
              </div>
            ))}
          </div>
        )}
      </VModal>
      {/* ===== END NEW ===== */}

      {/* ===== NEW: Delete Outfit ===== lop z-[65] de popup nam tren modal danh sach (z-[60]) */}
      <div className="relative z-[65]">
        <DeleteConfirmModal
          open={outfitToDelete !== null}
          title="Xóa outfit?"
          description={
            <>
              Outfit &ldquo;{outfitToDelete?.name}&rdquo; sẽ bị xóa vĩnh viễn, kèm bài đăng OOTD và lượt thích
              của outfit này (nếu có). Các món đồ trong tủ đồ không bị ảnh hưởng. Không thể hoàn tác.
            </>
          }
          confirmLabel="Xóa outfit"
          deleting={deletingOutfit}
          onCancel={() => setOutfitToDelete(null)}
          onConfirm={() => void confirmDeleteOutfit()}
        />
      </div>
      <VToast message={deleteError} variant="error" duration={4000} onClose={closeDeleteError} />
      {/* ===== END NEW ===== */}

      <VToast message={fitError} variant="error" duration={4000} onClose={closeFitError} /> {/* NEW: Ghi nho fit */}
      <VToast message={toast} onClose={closeToast} />
    </ProtectedLayout>
  );
}

/** Danh sach tu do o sidebar. */
function WardrobePicker({
  category,
  onCategory,
  loading,
  items,
  onPick,
}: {
  category: Category | 'all';
  onCategory: (c: Category | 'all') => void;
  loading: boolean;
  items: ClothingItem[];
  onPick: (item: ClothingItem) => void;
}) {
  const CATEGORY_LABELS = useCategoryLabels();
  return (
    <>
      <h2 className="mb-2.5 shrink-0 border-b border-[#E2ECC8] pb-2 font-serif-display text-base font-semibold text-[#1F453E]">
        Tủ đồ
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
                title={`Thêm "${item.name}" lên canvas`}
                className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-[#E2E8F0] bg-[#FAF9F5] p-2 transition-all hover:border-[#1F453E] hover:bg-[#E2ECC8]/30"
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
        <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-[#869BB2]/50" aria-hidden />
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
