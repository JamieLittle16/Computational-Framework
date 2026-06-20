import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: 'Computational Framework',
    description:
        'An interactive node-based editor for composing mathematical operations into computation graphs, with per-node modular arithmetic and AI-assisted node generation.',
    openGraph: {
        title: 'Computational Framework',
        description:
            'Build computation graphs visually — connect arithmetic nodes, enable modular math per-node, and generate circuits with AI.',
        type: 'website',
        url: 'https://computational-framework.vercel.app',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Computational Framework',
        description: 'Visual node-based arithmetic graph editor with modular math and AI generation.',
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
(function () {
  try {
    var theme = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = theme ? theme === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', isDark);
  } catch (e) {}
})();
`,
                    }}
                />
            </head>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                {children}
            </body>
        </html>
    );
}
