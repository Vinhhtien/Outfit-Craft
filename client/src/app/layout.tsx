import type { Metadata } from 'next';
import { Geist, Pacifico, Playfair_Display, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/layout/AuthProvider';

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin', 'vietnamese'] });
const pacifico = Pacifico({ variable: '--font-pacifico', weight: '400', subsets: ['latin'] });
const playfair = Playfair_Display({
  variable: '--font-playfair',
  weight: ['400', '500', '600'],
  subsets: ['latin', 'vietnamese'],
});
const jakarta = Plus_Jakarta_Sans({ variable: '--font-plus-jakarta', subsets: ['latin', 'vietnamese'] });

export const metadata: Metadata = {
  title: 'OutfitCraft — Tủ đồ số của bạn',
  description:
    'Số hóa tủ quần áo, tách nền tự động, phối đồ kéo-thả và gợi ý trang phục theo thời tiết.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${geist.variable} ${pacifico.variable} ${playfair.variable} ${jakarta.variable} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
