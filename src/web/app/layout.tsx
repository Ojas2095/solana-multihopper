import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'MultiHopper | Solana Multi-Hop DEX Router',
  description: 'Algorithmic multi-hop route finder and simulator on Solana',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
