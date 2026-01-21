"use client";

import React, { useEffect, useState } from 'react';

export default function Home() {
  const [Component, setComponent] = useState<any>(null);

  useEffect(() => {
    // Explicitly import only on client mount to bypass SSR resolution issues with WASM in Turbopack
    const loadComponent = async () => {
      try {
        const mod = await import('@/components/WhirlpoolApp');
        setComponent(() => mod.WhirlpoolApp);
      } catch (err) {
        console.error('Failed to load WhirlpoolApp:', err);
      }
    };
    loadComponent();
  }, []);

  if (!Component) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-mono text-zinc-500 uppercase tracking-widest text-xs">
        Loading Whirlpool Interface...
      </div>
    );
  }

  return <Component />;
}
