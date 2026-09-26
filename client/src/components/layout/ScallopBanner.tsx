/**
 * Dai banner ke soc xanh com + vien day luon song (moi duong luon trung 1 soc 28px).
 * `wide`: can le theo khung max-w-7xl (trang Studio) thay vi max-w-6xl.
 * `compact`: banner thap (padding nho, vien luon song 12px) cho trang can vua 1 man hinh.
 * `innerClassName`: thay the be rong + padding mac dinh cua khung noi dung.
 */
export function ScallopBanner({
  children,
  wide,
  compact,
  innerClassName,
}: {
  children: React.ReactNode;
  wide?: boolean;
  compact?: boolean;
  innerClassName?: string;
}) {
  const scallopH = compact ? 12 : 16;
  const scallopRy = compact ? 10 : 14;
  const layout =
    innerClassName ??
    `${wide ? 'max-w-7xl px-6 lg:px-10' : 'max-w-6xl px-4'} ${
      compact ? 'items-center py-2.5' : 'items-end pb-8 pt-10'
    }`;

  return (
    <section className="shrink-0">
      <div className="bg-[repeating-linear-gradient(90deg,#E2ECC8_0px,#E2ECC8_28px,#EAF2D3_28px,#EAF2D3_56px)]">
        <div className={`mx-auto flex flex-wrap justify-between gap-4 ${layout}`}>
          {children}
        </div>
      </div>
      <svg className="block w-full" style={{ height: scallopH }} aria-hidden="true">
        <defs>
          <pattern id="banner-scallop" width="56" height={scallopH} patternUnits="userSpaceOnUse">
            <path
              d={`M0 0 A14 ${scallopRy} 0 0 0 28 0`}
              fill="#E2ECC8"
              stroke="#1F453E"
              strokeWidth="1.5"
            />
            <path
              d={`M28 0 A14 ${scallopRy} 0 0 0 56 0`}
              fill="#EAF2D3"
              stroke="#1F453E"
              strokeWidth="1.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height={scallopH} fill="url(#banner-scallop)" />
      </svg>
    </section>
  );
}
