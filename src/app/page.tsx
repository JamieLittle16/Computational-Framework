'use client';

import ComputationalFramework from '@/components/computational-framework/ComputationalFramework';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function Home() {
    return (
        <main className="min-h-screen">
            <ErrorBoundary>
                <ComputationalFramework />
            </ErrorBoundary>
        </main>
    );
}
