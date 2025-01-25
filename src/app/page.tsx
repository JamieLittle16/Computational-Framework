'use client';

import ComputationalFramework from '@/components/computational-framework/ComputationalFramework';
import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('contextmenu', handleContextMenu);

    // Cleanup
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  return (
    <main className="min-h-screen">
      <ComputationalFramework />
    </main>
  );
}
