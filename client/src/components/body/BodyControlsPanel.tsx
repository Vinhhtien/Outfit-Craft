'use client';

// Bang chinh so do nguoi mau 2D (dung chung trang Ho so va Studio). Luu noi bo bang cm/kg;
// logic nam o lib/bodyMetrics.ts, hinh ve o lib/mannequin.ts (cap nhat ngay khi keo slider).
import { useId, useRef, useState, type ReactNode } from 'react';
import {
  CircleHelp, Hourglass, MoveHorizontal, MoveVertical, Circle, RotateCcw, Ruler, Shirt, Sparkles, Weight,
} from 'lucide-react';
import {
  METRIC_KEYS, applyShapePreset, resetToDefaults, setGender, setMetric, setShapeLabel, setWeight,
  sliderRange, validateMetric, type BodyState, type MetricKey,
} from '@/lib/bodyMetrics';
import { formatNumber, parseLocaleNumber } from '@/lib/units';
import { classifyShape } from '@/lib/mannequin';
import { MannequinPreview } from '@/components/profile/MannequinPreview';
import {
  BODY_GENDERS, BODY_GENDER_LABELS, BODY_SHAPES, BODY_SHAPE_LABELS, type BodyShape,
} from '@/types';

const METRIC_INFO: Record<MetricKey, { label: string; icon: typeof Ruler; help: string }> = {
  heightCm: {
    label: 'Chiều cao',
    icon: Ruler,
    help: 'Đứng thẳng, không mang giày, đo từ gót chân đến đỉnh đầu.',
  },
  weightKg: {
    label: 'Cân nặng',
    icon: Weight,
    help: 'Kéo cân nặng sẽ tự co giãn vòng ngực, eo, hông theo tỉ lệ ước lượng; sau đó bạn vẫn chỉnh từng vòng riêng được. Không bao giờ được chia sẻ hay gửi cho AI gợi ý.',
  },
  inseamCm: {
    label: 'Dài chân trong',
    icon: MoveVertical,
    help: 'Đo từ đáy háng đến mặt sàn, dọc theo mặt trong của chân, không mang giày.',
  },
  shoulderCm: {
    label: 'Ngang vai',
    icon: MoveHorizontal,
    help: 'Đo ngang lưng, từ đầu xương vai bên này sang đầu xương vai bên kia.',
  },
  bustCm: {
    label: 'Vòng ngực',
    icon: Shirt,
    help: 'Đo vòng quanh phần nở nhất của ngực, giữ thước song song với mặt đất.',
  },
  waistCm: {
    label: 'Vòng eo',
    icon: Hourglass,
    help: 'Đo vòng quanh phần nhỏ nhất của eo, thường cao hơn rốn khoảng 2–3 cm.',
  },
  hipCm: {
    label: 'Vòng hông',
    icon: Circle,
    help: 'Đo vòng quanh phần nở nhất của hông và mông, hai chân khép.',
  },
};

export const SHAPE_HINTS: Record<BodyShape, string> = {
  rectangle: 'Vai, eo và hông khá đồng đều',
  pear: 'Hông rộng hơn vai',
  apple: 'Vòng eo nổi bật so với vai và hông',
  hourglass: 'Vai và hông cân đối, eo nhỏ rõ',
  inverted_triangle: 'Vai rộng hơn hông',
};

const unitOf = (k: MetricKey) => (k === 'weightKg' ? 'kg' : 'cm');
const round1 = (v: number) => Math.round(v * 10) / 10;

/* ---------------- 1 dong thong so ---------------- */

function MetricRow({
  metric, value, heightCm, estimated, disabled, onChange, onSlide, onSlideEnd,
}: {
  metric: MetricKey;
  value: number;
  heightCm: number;
  /** Chua nhap: dang lay theo dang mau. */
  estimated: boolean;
  disabled?: boolean;
  /** Gia tri tu o nhap (va slider neu khong co onSlide). */
  onChange: (v: number) => void;
  /** Gia tri tu slider trong luc keo. */
  onSlide?: (v: number) => void;
  /** Tha slider / roi khoi slider. */
  onSlideEnd?: () => void;
}) {
  const id = useId();
  const info = METRIC_INFO[metric];
  const Icon = info.icon;
  const unit = unitOf(metric);
  const { min, max } = sliderRange(metric, heightCm);
  const [helpOpen, setHelpOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const n = round1(parseLocaleNumber(draft));
    const err = validateMetric(metric, n);
    if (err) {
      setError(err);
      return;
    }
    setDraft(null);
    setError(null);
    if (n !== value) onChange(n);
  };

  return (
    <div className="py-2">
      <div className="flex items-center gap-2">
        <Icon size={14} className="shrink-0 text-[#2C4C45]" aria-hidden />
        <label htmlFor={`${id}-range`} className="text-xs font-semibold text-[#1F453E]">
          {info.label}
        </label>
        <button
          type="button"
          onClick={() => setHelpOpen((v) => !v)}
          aria-expanded={helpOpen}
          aria-controls={`${id}-help`}
          aria-label={`Cách đo ${info.label.toLowerCase()}`}
          title={info.help}
          className="text-[#869BB2] transition-colors hover:text-[#1F453E]"
        >
          <CircleHelp size={13} />
        </button>
        {estimated && (
          <span className="rounded-full bg-[#E2ECC8]/70 px-1.5 text-[9px] font-semibold text-[#2C4C45]" title="Chưa nhập - đang lấy theo dáng mẫu">
            ước lượng
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1">
          <input
            id={`${id}-input`}
            inputMode="decimal"
            aria-label={`${info.label} (${unit})`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            disabled={disabled}
            value={draft ?? formatNumber(value)}
            onFocus={() => setDraft(formatNumber(value))}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setDraft(null);
                setError(null);
              }
            }}
            className={`w-16 rounded-md border px-1.5 py-0.5 text-right text-xs font-bold tabular-nums text-[#1F453E] focus:outline-none ${
              error ? 'border-red-500' : 'border-[#869BB2]/60 focus:border-[#1F453E]'
            }`}
          />
          <span className="w-5 text-xs text-[#2C4C45]">{unit}</span>
        </span>
      </div>
      {helpOpen && (
        <p id={`${id}-help`} role="note" className="mt-1.5 rounded-lg bg-[#E2ECC8]/50 px-2.5 py-1.5 text-[11px] text-[#2C4C45]">
          {info.help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-[11px] text-red-600">
          {error}
        </p>
      )}
      <input
        id={`${id}-range`}
        type="range"
        min={min}
        max={max}
        step={0.5}
        value={Math.min(max, Math.max(min, value))}
        disabled={disabled}
        aria-valuetext={`${formatNumber(value)} ${unit}`}
        onPointerUp={onSlideEnd}
        onBlur={onSlideEnd}
        onChange={(e) => {
          setDraft(null);
          setError(null);
          (onSlide ?? onChange)(Number(e.target.value));
        }}
        className="mt-1.5 w-full accent-[#1F453E]"
      />
    </div>
  );
}

/* ---------------- Bang chinh ---------------- */

export function BodyControlsPanel({
  value,
  onChange,
  disabled,
  header,
  footer,
}: {
  value: BodyState;
  onChange: (next: BodyState) => void;
  disabled?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  const id = useId();
  const s = value;
  const suggested = classifyShape(s.metrics);
  /** Trang thai luc bat dau keo slider can nang: moi buoc co gian 3 vong tinh tu day. */
  const weightBase = useRef<BodyState | null>(null);

  return (
    <div className="space-y-4 text-[#1F453E]">
      {header}

      {/* Gioi tinh */}
      <div role="radiogroup" aria-label="Kiểu người mẫu" className="grid grid-cols-3 gap-1 rounded-full border border-[#1F453E]/25 bg-[#FAF9F5] p-1">
        {BODY_GENDERS.map((g) => (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={s.gender === g}
            disabled={disabled}
            onClick={() => onChange(setGender(s, g))}
            className={`rounded-full px-2 py-1.5 text-xs font-bold transition-colors ${
              s.gender === g ? 'bg-[#1F453E] text-white' : 'text-[#1F453E] hover:bg-[#E2ECC8]/60'
            }`}
          >
            {BODY_GENDER_LABELS[g]}
          </button>
        ))}
      </div>

      <div className="divide-y divide-dashed divide-[#869BB2]/40">
        {METRIC_KEYS.map((k) => (
          <MetricRow
            key={k}
            metric={k}
            value={s.metrics[k]}
            heightCm={s.metrics.heightCm}
            estimated={!s.provided.includes(k)}
            disabled={disabled}
            onChange={(v) => onChange(setMetric(s, k, v))}
            {...(k === 'weightKg'
              ? {
                  onSlide: (v: number) => {
                    weightBase.current ??= s;
                    onChange(setWeight(s, v, weightBase.current));
                  },
                  onSlideEnd: () => {
                    weightBase.current = null;
                  },
                }
              : {})}
          />
        ))}
      </div>

      {/* Dang mau: bam -> dien bo so do mau theo chieu cao hien tai */}
      <div>
        <span id={`${id}-shape`} className="mb-1.5 block text-[11px] font-semibold">
          Dáng mẫu <span className="font-normal text-[#6B7B76]">(bấm để điền số đo mẫu theo chiều cao hiện tại)</span>
        </span>
        <div role="radiogroup" aria-labelledby={`${id}-shape`} className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
          {BODY_SHAPES.map((shape) => (
            <button
              key={shape}
              type="button"
              role="radio"
              aria-checked={s.shape === shape}
              disabled={disabled}
              title={SHAPE_HINTS[shape]}
              onClick={() => onChange(applyShapePreset(s, shape))}
              className={`flex flex-col items-center gap-0.5 rounded-xl border p-1.5 text-center transition-all ${
                s.shape === shape
                  ? 'border-[#1F453E] bg-[#E2ECC8]/50'
                  : 'border-[#E2E8F0] bg-[#FAF9F5] hover:border-[#1F453E]/60'
              }`}
            >
              <MannequinPreview profile={{ gender: s.gender, shape }} className="h-12 w-full" />
              <span className="text-[10px] font-semibold leading-tight">{BODY_SHAPE_LABELS[shape]}</span>
            </button>
          ))}
        </div>
        {suggested && suggested !== s.shape && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#1F453E]/20 bg-[#E2ECC8]/40 px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5">
              <Sparkles size={13} className="shrink-0" />
              Theo số đo, dáng của bạn có vẻ là <strong>{BODY_SHAPE_LABELS[suggested]}</strong>.
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(setShapeLabel(s, suggested))}
              title="Chỉ đổi nhãn dáng, giữ nguyên số đo của bạn"
              className="rounded-full border border-[#1F453E] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors hover:bg-[#1F453E] hover:text-white"
            >
              Dùng dáng này
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onChange(resetToDefaults(s))}
        disabled={disabled}
        title="Giữ chiều cao; vai và các vòng về số đo mẫu của dáng đang chọn, dài chân trong và cân nặng về mặc định"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F453E] underline underline-offset-2"
      >
        <RotateCcw size={12} /> Đặt lại mặc định
      </button>

      {footer}
    </div>
  );
}
