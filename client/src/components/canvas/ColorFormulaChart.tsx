import { COLOR_FORMULA, type Swatch } from '@/lib/colorFormula';
import type { ColorGroup } from '@/types';

/** 2 cham chong nhau: mau chinh o tren, mau phoi o duoi (giong bang goc). */
function Pair({ base, partner }: { base: Swatch; partner: Swatch }) {
  const dot = 'block h-6 w-6 rounded-full border border-black/10 sm:h-7 sm:w-7';
  return (
    <span className="flex flex-col items-center" title={`${base.label} + ${partner.label}`}>
      <span className={dot} style={{ backgroundColor: base.hex }} />
      <span className={`${dot} -mt-2.5`} style={{ backgroundColor: partner.hex }} />
      <span className="sr-only">{`${base.label} phối với ${partner.label}`}</span>
    </span>
  );
}

/** Bang "cong thuc phoi do da nang". highlight: nhom mau cua mon dang chon tren canvas. */
export function ColorFormulaChart({ highlight }: { highlight?: ColorGroup | null }) {
  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-[#6B7B76]">
        Mỗi cặp chấm trên cùng một hàng là hai màu phối hài hoà với nhau (ví dụ áo màu trên, quần màu dưới, hoặc
        ngược lại). Đen, trắng, xám, be và xanh navy là màu trung tính, đi được với mọi màu.
      </p>
      <ul className="divide-y divide-dashed divide-[#869BB2]/40">
        {COLOR_FORMULA.map(({ group, name, base, partners }) => {
          const active = highlight === group;
          return (
            <li
              key={group}
              className={`flex items-center gap-2 rounded-lg px-2 py-2.5 sm:gap-3 ${active ? 'bg-[#E2ECC8]/70' : ''}`}
            >
              <span className={`w-16 shrink-0 text-xs font-bold uppercase tracking-wide sm:w-20 ${active ? 'text-[#1F453E]' : 'text-[#2C4C45]'}`}>
                {name}
              </span>
              <span className="grid flex-1 grid-cols-8 justify-items-center gap-1">
                {partners.map((partner) => <Pair key={partner.label} base={base} partner={partner} />)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
