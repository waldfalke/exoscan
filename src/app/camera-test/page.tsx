import CameraDiagnostics from '@/components/CameraDiagnostics';

export default function CameraTestPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <CameraDiagnostics />
    </div>
  );
}

export const metadata = {
  title: 'Camera Diagnostics - ExoScan',
  description: 'Test camera constraints and compatibility',
};