'use client';

// ===== NEW: Body 3D =====
// Bang chinh thong so nguoi mau (dung chung trang Ho so va Studio). Luu noi bo luon bang cm/kg,
// chi doi don vi khi hien thi (lib/units.ts). Logic so do nam o lib/bodyMetrics.ts.
import { useId, useState, type ReactNode } from 'react';
import {
  CircleHelp, Hourglass, MoveVertical, Circle, RotateCcw, Ruler, Shirt, Sparkles, Weight,
} from 'lucide-react';
import {
  BMI_LABELS, BMI_SCALE, BMI_THRESHOLDS, CIRCUMFERENCE_KEYS, METRIC_KEYS,
  applyMetricChange, bmi, bmiCategory, bmiPosition, defaultMetrics, shapePresetMetrics,
  type BodyState, type MetricKey, type SliderMode,
} from '@/lib/bodyMetrics';
import {
  displayRange, formatMeasure, formatNumber, fromDisplay, metricKind, parseLocaleNumber,
  roundTo, sliderStep, toDisplay, unitLabel,
} from '@/lib/units';
import { classifyShape } from '@/lib/mannequin';
import { MannequinPreview } from '@/components/profile/MannequinPreview';
import {
  BODY_GENDERS, BODY_GENDER_LABELS, BODY_MEASUREMENT_RANGES, BODY_SHAPES, BODY_SHAPE_LABELS,
  type BodyGender, type BodyShape, type UnitPreference,
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
    help: 'Chỉ dùng để mô phỏng độ đầy đặn của mô hình. Không bao giờ được chia sẻ hay gửi cho AI gợi ý.',
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
  inseamCm: {
    label: 'Dài chân trong',
    icon: MoveVertical,
    help: 'Đo từ đáy háng đến mắt cá chân, dọc theo mặt trong của chân.',
  },
};

export const SHAPE_HINTS: Record<BodyShape, string> = {
  rectangle: 'Vai, eo và hông khá đồng đều',
  pear: 'Hông rộng hơn vai',
  apple: 'Vòng eo nổi bật so với vai và hông',
  hourglass: 'Vai và hông cân đối, eo nhỏ rõ',
  inverted_triangle: 'Vai rộng hơn hông',
};

const BMI_COLORS = {
  underweight: '#8FB3D9',
  normal: '#9CC59A',
  overweight: '#E8C27A',
  obese: '#E39A86',
} as const;

const SELECT =
  'w-full rounded-lg border border-[#869BB2] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1F453E] focus:border-[#1F453E] focus:outline-none';

/* ---------------- 1 dong thong so ---------------- */

function MetricRow({
  metric, value, unit, disabled, onChange,
}: {
  metric: MetricKey;
  value: number;
  unit: UnitPreference;
  disabled?: boolean;
  onChange: (cmOrKg: number) => void;
}) {
  const id = useId();
  const info = METRIC_INFO[metric];
  const Icon = info.icon;
  const kind = metricKind(metric);
  const { min, max } = displayRange(metric, unit);
  const display = toDisplay(value, kind, unit);
  const [helpOpen, setHelpOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const n = parseLocaleNumber(draft);
    setDraft(null);
    if (Number.isFinite(n)) onChange(roundTo(fromDisplay(n, kind, unit), 1));
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
        <div className="ml-auto">
          {draft === null ? (
            <button
              type="button"
              onClick={() => setDraft(formatNumber(display))}
              disabled={disabled}
              title="Bấm để nhập số"
              className="rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums text-[#1F453E] underline decoration-dotted underline-offset-4 hover:bg-[#E2ECC8]/60"
            >
              {formatMeasure(value, kind, unit)}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1">
              <input
                autoFocus
                inputMode="decimal"
                aria-label={`${info.label} (${unitLabel(kind, unit)})`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit();
                  if (e.key === 'Escape') setDraft(null);
                }}
                className="w-16 rounded-md border border-[#1F453E] px-1.5 py-0.5 text-right text-xs font-bold tabular-nums text-[#1F453E] focus:outline-none"
              />
              <span className="text-xs text-[#2C4C45]">{unitLabel(kind, unit)}</span>
            </span>
          )}
        </div>
      </div>
      {helpOpen && (
        <p id={`${id}-help`} role="note" className="mt-1.5 rounded-lg bg-[#E2ECC8]/50 px-2.5 py-1.5 text-[11px] text-[#2C4C45]">
          {info.help}
        </p>
      )}
      <input
        id={`${id}-range`}
        type="range"
        min={min}
        max={max}
        step={sliderStep(kind, unit)}
        value={Math.min(max, Math.max(min, display))}
        disabled={disabled}
        onChange={(e) => onChange(roundTo(fromDisplay(Number(e.target.value), kind, unit), 1))}
        className="mt-1.5 w-full accent-[#1F453E]"
      />
    </div>
  );
}

/* ---------------- BMI ---------------- */

function BmiBlock({ state, onToggle }: { state: BodyState; onToggle: (show: boolean) => void }) {
  const value = bmi(state.metrics.heightCm, state.metrics.weightKg);
  const cat = bmiCategory(value);
  const span = BMI_SCALE.max - BMI_SCALE.min;
  const pct = (v: number) => `${((v - BMI_SCALE.min) / span) * 100}%`;

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#FAF9F5] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#1F453E]">BMI</span>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-[#2C4C45]">
          <input
            type="checkbox"
            checked={!state.showBmi}
            onChange={(e) => onToggle(!e.target.checked)}
            className="h-3.5 w-3.5 accent-[#1F453E]"
          />
          Ẩn BMI
        </label>
      </div>
      {state.showBmi && (
        <>
          <p className="mt-1 text-sm text-[#1F453E]">
            <strong className="tabular-nums">{formatNumber(value)}</strong>
            <span className="ml-2 text-xs text-[#2C4C45]">
              {cat === 'normal' ? 'Cân nặng bình thường' : BMI_LABELS[cat]}
            </span>
          </p>
          <div className="relative mt-2 h-2 overflow-hidden rounded-full" aria-hidden>
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to right,
                  ${BMI_COLORS.underweight} 0 ${pct(BMI_THRESHOLDS.underweight)},
                  ${BMI_COLORS.normal} ${pct(BMI_THRESHOLDS.underweight)} ${pct(BMI_THRESHOLDS.overweight)},
                  ${BMI_COLORS.overweight} ${pct(BMI_THRESHOLDS.overweight)} ${pct(BMI_THRESHOLDS.obese)},
                  ${BMI_COLORS.obese} ${pct(BMI_THRESHOLDS.obese)} 100%)`,
              }}
            />
          </div>
          <div className="relative h-2" aria-hidden>
            <span
              className="absolute top-0 h-0 w-0 -translate-x-1/2 border-x-[5px] border-b-[6px] border-x-transparent border-b-[#1F453E]"
              style={{ left: `${bmiPosition(value) * 100}%` }}
            />
          </div>
          <div className="mt-0.5 flex justify-between text-[10px] text-[#6B7B76]">
            {(['underweight', 'normal', 'overweight', 'obese'] as const).map((c) => (
              <span key={c}>{BMI_LABELS[c]}</span>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-[#6B7B76]">
            BMI chỉ là chỉ số tham khảo chung, không phản ánh đầy đủ sức khỏe hay vóc dáng của mỗi người.
          </p>
        </>
      )}
    </div>
  );
}

/* ---------------- Bang chinh ---------------- */

export function BodyControlsPanel({
  value,
  onChange,
  disabled,
  showShoulderField = false,
  header,
  footer,
}: {
  value: BodyState;
  onChange: (next: BodyState) => void;
  disabled?: boolean;
  /** O nhap "Ngang vai" tuy chon (trang Ho so). */
  showShoulderField?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  const id = useId();
  const [mode, setMode] = useState<SliderMode>('single');
  const s = value;

  const mark = (keys: MetricKey[]) => METRIC_KEYS.filter((k) => s.provided.includes(k) || keys.includes(k));

  const setMetric = (key: MetricKey, v: number) => {
    const { metrics, changed } = applyMetricChange(s.metrics, key, v, mode);
    onChange({ ...s, metrics, provided: mark(changed) });
  };

  const setGender = (gender: BodyGender) => {
    // Chua nhap so do nao -> dung mac dinh cua gioi tinh moi; da nhap thi giu so cua nguoi dung.
    const metrics = s.provided.length ? s.metrics : defaultMetrics(gender, s.shape);
    onChange({ ...s, gender, metrics });
  };

  const applyPreset = (shape: BodyShape) => {
    const preset = shapePresetMetrics(shape, s.gender, s.metrics.heightCm);
    onChange({ ...s, shape, metrics: { ...s.metrics, ...preset }, provided: mark([...CIRCUMFERENCE_KEYS]) });
  };

  const reset = () => {
    onChange({
      ...s,
      shape: 'rectangle',
      metrics: defaultMetrics(s.gender, 'rectangle'),
      provided: [],
      shoulderCm: undefined,
    });
  };

  const suggested = classifyShape({ ...s.metrics, ...(s.shoulderCm ? { shoulderCm: s.shoulderCm } : {}) });
  const shoulderRange = BODY_MEASUREMENT_RANGES.shoulderCm;

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
            onClick={() => setGender(g)}
            className={`rounded-full px-2 py-1.5 text-xs font-bold transition-colors ${
              s.gender === g ? 'bg-[#1F453E] text-white' : 'text-[#1F453E] hover:bg-[#E2ECC8]/60'
            }`}
          >
            {BODY_GENDER_LABELS[g]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold">Đơn vị đo</span>
          <select
            value={s.unit}
            disabled={disabled}
            onChange={(e) => onChange({ ...s, unit: e.target.value as UnitPreference })}
            className={SELECT}
          >
            <option value="metric">Hệ mét (cm, kg)</option>
            <option value="imperial">Hệ Anh (in, lb)</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold">Cách chỉnh</span>
          <select value={mode} disabled={disabled} onChange={(e) => setMode(e.target.value as SliderMode)} className={SELECT}>
            <option value="single">Chỉnh từng thông số</option>
            <option value="balance">Tự cân đối</option>
          </select>
        </label>
      </div>
      {mode === 'balance' && (
        <p className="-mt-2 text-[10px] leading-snug text-[#6B7B76]">
          Tự cân đối là ước lượng gần đúng để mô hình trông tự nhiên, không phải công thức y khoa.
        </p>
      )}

      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold">Màu mô hình</span>
        <input
          type="range"
          min={0}
          max={360}
          step={1}
          value={s.hue}
          disabled={disabled}
          onChange={(e) => onChange({ ...s, hue: Number(e.target.value) })}
          aria-label="Màu mô hình"
          className="hue-slider h-3 w-full cursor-pointer appearance-none rounded-full"
          style={{
            background:
              'linear-gradient(to right, hsl(0,28%,64%), hsl(60,28%,64%), hsl(120,28%,64%), hsl(180,28%,64%), hsl(240,28%,64%), hsl(300,28%,64%), hsl(360,28%,64%))',
          }}
        />
      </label>

      <div className="divide-y divide-dashed divide-[#869BB2]/40">
        {METRIC_KEYS.map((k) => (
          <MetricRow key={k} metric={k} value={s.metrics[k]} unit={s.unit} disabled={disabled} onChange={(v) => setMetric(k, v)} />
        ))}
      </div>

      {showShoulderField && (
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold">
            Ngang vai (tùy chọn, {unitLabel('length', s.unit)})
          </span>
          <input
            inputMode="decimal"
            disabled={disabled}
            placeholder="Để trống: tự ước lượng"
            defaultValue={s.shoulderCm ? formatNumber(toDisplay(s.shoulderCm, 'length', s.unit)) : ''}
            key={`${s.unit}-${s.shoulderCm ?? ''}`}
            onBlur={(e) => {
              const n = parseLocaleNumber(e.target.value);
              const cm = Number.isFinite(n) ? roundTo(fromDisplay(n, 'length', s.unit), 1) : undefined;
              const ok = cm !== undefined && cm >= shoulderRange.min && cm <= shoulderRange.max;
              onChange({ ...s, shoulderCm: ok ? cm : undefined });
            }}
            className="w-full rounded-lg border border-[#869BB2] bg-white px-2.5 py-1.5 text-xs text-[#1F453E] placeholder:text-[#869BB2] focus:border-[#1F453E] focus:outline-none"
          />
          <span className="mt-0.5 block text-[10px] text-[#6B7B76]">
            Khoảng hợp lệ {formatMeasure(shoulderRange.min, 'length', s.unit)} – {formatMeasure(shoulderRange.max, 'length', s.unit)}.
          </span>
        </label>
      )}

      <button
        type="button"
        onClick={reset}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F453E] underline underline-offset-2"
      >
        <RotateCcw size={12} /> Đặt lại mặc định
      </button>

      <BmiBlock state={s} onToggle={(showBmi) => onChange({ ...s, showBmi })} />

      {/* Dang: bam -> dien bo so do mau theo chieu cao hien tai */}
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
              onClick={() => applyPreset(shape)}
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
              Dáng của bạn có vẻ là <strong>{BODY_SHAPE_LABELS[suggested]}</strong>.
            </span>
            <button
              type="button"
              onClick={() => onChange({ ...s, shape: suggested })}
              className="rounded-full border border-[#1F453E] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors hover:bg-[#1F453E] hover:text-white"
            >
              Dùng dáng này
            </button>
          </div>
        )}
      </div>

      {footer}
    </div>
  );
}
// ===== END NEW =====
