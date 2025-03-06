import type { Metadata } from 'next';
import { Exo_2, Press_Start_2P } from 'next/font/google';
import './globals.css';
import { Background } from './components/Background';

// Game font for regular text
const exo2 = Exo_2({
  variable: '--font-exo2',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

// Pixel font for titles
const pixelFont = Press_Start_2P({
  variable: '--font-pixel',
  subsets: ['latin'],
  weight: ['400'],
});

export const metadata: Metadata = {
  title: 'Gesture Tower',
  description: 'A gesture-controlled tower building game',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body className={`${exo2.variable} ${pixelFont.variable} antialiased`}>
        <Background />
        {children}
      </body>
    </html>
  );
}
