import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';

export default function DashboardPlaceholder() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <Navbar />
      <div className="flex-grow pt-24 pb-12 flex items-center justify-center">
        <div className="text-center p-8 bg-gray-900 border border-gray-800 rounded-xl max-w-lg w-full">
          <div className="w-16 h-16 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <LayoutDashboard className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Dashboard (Coming Soon)</h1>
          <p className="text-gray-400 mb-8">
            The interactive live-alert dashboard will be implemented in Phase 3. It will feature animated metrics, real-time WebSocket alerts, and dynamic confusion matrices.
          </p>
          <Link href="/" className="px-6 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors">
            Return Home
          </Link>
        </div>
      </div>
      <Footer />
    </main>
  );
}
