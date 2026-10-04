import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Arcana · Tarot AI',
  description: 'Một khoảng lặng để lắng nghe bản thân. Khám phá 78 lá Tarot, trải bài và diễn giải bằng AI dựa trên ý nghĩa chuẩn.',
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {
  return <html lang="vi"><body>{children}</body></html>;
}
