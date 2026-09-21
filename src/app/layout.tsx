import type { Metadata, Viewport } from 'next';
import { Inter, Poppins } from 'next/font/google';
import './globals.css';

/**
 * Poppins carries the dashboard and Inter the login card, as in the
 * prototype. Loaded through next/font so they are served from this app rather
 * than fetched from a third party on every visit.
 */
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CHIGARI Almajiri Education Information System',
  description:
    'Concept prototype for the Chigari Foundation Almajiri Education Information System. Sample data only.',
  icons: { icon: '/favicon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * Applies the saved theme before first paint.
 *
 * The dashboard remembers dark or light in localStorage, as the prototype
 * does. Reading it here rather than in an effect avoids a flash of the wrong
 * theme on load.
 */
const THEME_BOOTSTRAP = `
(function () {
  try {
    var saved = localStorage.getItem('cf-theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.dataset.theme = saved;
    }
  } catch (e) {
    /* Storage can be unavailable; the default theme still applies. */
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className={`${poppins.variable} ${inter.variable}`}>{children}</body>
    </html>
  );
}
