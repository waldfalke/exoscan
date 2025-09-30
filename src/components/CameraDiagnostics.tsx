'use client';

import { useState, useRef, useCallback } from 'react';

interface DiagnosticLog {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

interface CameraConstraints {
  video: MediaTrackConstraints;
}

export default function CameraDiagnostics() {
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const addLog = useCallback((message: string, type: DiagnosticLog['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const stopCamera = useCallback(() => {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      setCurrentStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      addLog('Camera stopped', 'info');
    }
  }, [currentStream, addLog]);

  const getOptimalConstraints = (): CameraConstraints => ({
    video: {
      width: { ideal: 1920, min: 640 },
      height: { ideal: 1080, min: 480 },
      frameRate: { ideal: 30 }
    }
  });

  const getBasicConstraints = (): CameraConstraints => ({
    video: {
      width: { ideal: 1280, min: 640 },
      height: { ideal: 720, min: 480 }
    }
  });

  const getMinimalConstraints = (): CameraConstraints => ({
    video: true
  });

  const testConstraints = async (constraints: CameraConstraints, name: string) => {
    try {
      addLog(`Testing ${name} constraints...`, 'info');
      addLog(`Constraints: ${JSON.stringify(constraints, null, 2)}`, 'info');
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCurrentStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Get actual settings
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      const capabilities = videoTrack.getCapabilities();
      
      addLog(`✅ ${name} constraints successful!`, 'success');
      addLog(`Stream info: ${videoTrack.label} (${settings.width}x${settings.height})`, 'info');
      addLog(`Actual settings: ${JSON.stringify(settings, null, 2)}`, 'info');
      addLog(`Capabilities: ${JSON.stringify(capabilities, null, 2)}`, 'info');
      
      return true;
    } catch (error) {
      if (error instanceof Error) {
        addLog(`❌ ${name} constraints failed: ${error.name} - ${error.message}`, 'error');
        if (error.name === 'OverconstrainedError') {
          const constraintError = error as OverconstrainedError;
          addLog(`Overconstrained property: ${constraintError.constraint}`, 'error');
        }
      }
      return false;
    }
  };

  const runFallbackTest = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    clearLogs();
    addLog('Starting camera fallback test...', 'info');

    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addLog('❌ getUserMedia not supported', 'error');
        return;
      }

      // Test optimal constraints
      let success = await testConstraints(getOptimalConstraints(), 'Optimal');
      if (success) {
        setTimeout(() => stopCamera(), 2000);
        return;
      }

      // Test basic constraints
      success = await testConstraints(getBasicConstraints(), 'Basic');
      if (success) {
        setTimeout(() => stopCamera(), 2000);
        return;
      }

      // Test minimal constraints
      success = await testConstraints(getMinimalConstraints(), 'Minimal');
      if (success) {
        setTimeout(() => stopCamera(), 2000);
        return;
      }

      addLog('❌ All constraint levels failed', 'error');
    } catch (error) {
      addLog(`❌ Unexpected error: ${error}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const testIndividualConstraints = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    clearLogs();
    addLog('Testing individual constraint levels...', 'info');

    try {
      // Test each level individually
      await testConstraints(getOptimalConstraints(), 'Optimal');
      setTimeout(async () => {
        stopCamera();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await testConstraints(getBasicConstraints(), 'Basic');
        setTimeout(async () => {
          stopCamera();
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          await testConstraints(getMinimalConstraints(), 'Minimal');
          setTimeout(() => {
            stopCamera();
            setIsRunning(false);
          }, 2000);
        }, 2000);
      }, 2000);
    } catch (error) {
      addLog(`❌ Test error: ${error}`, 'error');
      setIsRunning(false);
    }
  };

  const listCameras = async () => {
    try {
      addLog('Listing available cameras...', 'info');
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length === 0) {
        addLog('❌ No video input devices found', 'error');
        return;
      }

      addLog(`Found ${videoDevices.length} video device(s):`, 'info');
      videoDevices.forEach((device, index) => {
        addLog(`${index + 1}. ${device.label || `Camera ${index + 1}`} (${device.deviceId})`, 'info');
      });
    } catch (error) {
      addLog(`❌ Error listing cameras: ${error}`, 'error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Camera Diagnostics</h1>
        <p className="text-gray-600 mb-6">
          Test camera constraints and compatibility across different devices.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            onClick={runFallbackTest}
            disabled={isRunning}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {isRunning ? 'Testing...' : 'Test Fallback Logic'}
          </button>
          
          <button
            onClick={testIndividualConstraints}
            disabled={isRunning}
            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {isRunning ? 'Testing...' : 'Test All Levels'}
          </button>
          
          <button
            onClick={listCameras}
            disabled={isRunning}
            className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
          >
            List Cameras
          </button>
          
          <button
            onClick={stopCamera}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Stop Camera
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Video Preview */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Camera Preview</h3>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-64 bg-gray-100 rounded-lg object-cover"
            />
          </div>

          {/* Logs */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Diagnostic Logs</h3>
              <button
                onClick={clearLogs}
                className="text-sm bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="h-64 overflow-y-auto bg-gray-50 rounded-lg p-4 font-mono text-sm">
              {logs.length === 0 ? (
                <p className="text-gray-500">No logs yet. Run a test to see results.</p>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={index}
                    className={`mb-1 ${
                      log.type === 'error' ? 'text-red-600' :
                      log.type === 'success' ? 'text-green-600' :
                      'text-gray-700'
                    }`}
                  >
                    <span className="text-gray-500">{log.timestamp}:</span> {log.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Constraint Information */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Constraint Levels</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Optimal</h3>
            <pre className="text-xs text-blue-800 overflow-x-auto">
{JSON.stringify(getOptimalConstraints(), null, 2)}
            </pre>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-900 mb-2">Basic</h3>
            <pre className="text-xs text-green-800 overflow-x-auto">
{JSON.stringify(getBasicConstraints(), null, 2)}
            </pre>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="font-semibold text-yellow-900 mb-2">Minimal</h3>
            <pre className="text-xs text-yellow-800 overflow-x-auto">
{JSON.stringify(getMinimalConstraints(), null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}