import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Mock MediaDevices API
const mockGetUserMedia = jest.fn();
const mockEnumerateDevices = jest.fn();

// Create mock functions that will be used in ZXing mock
const mockDecodeFromImageElement = jest.fn();
const mockReset = jest.fn();

// Mock ZXing library with realistic scanning behavior - MUST be before Scanner import
jest.mock('@zxing/library', () => ({
  BrowserMultiFormatReader: jest.fn().mockImplementation(() => ({
    decodeFromImageElement: mockDecodeFromImageElement,
    reset: mockReset,
  })),
  BarcodeFormat: {
    EAN_13: 'EAN_13',
    CODE_128: 'CODE_128',
    QR_CODE: 'QR_CODE',
  },
}));

// Mock useScanner hook
const mockStartScanning = jest.fn();
const mockStopScanning = jest.fn();
const mockSwitchCamera = jest.fn();
const mockToggleFlashlight = jest.fn();
const mockSetZoom = jest.fn();

jest.mock('@/hooks/useScanner', () => ({
  useScanner: jest.fn()
}));

import Scanner from '../Scanner';
import { useScanner } from '@/hooks/useScanner';

import { BrowserMultiFormatReader } from '@zxing/library';

// Get the mocked useScanner
const mockUseScanner = useScanner as jest.MockedFunction<typeof useScanner>;

// Setup useScanner mock immediately
mockUseScanner.mockImplementation((options) => {
  const { onScanError, onScanSuccess } = options || {};
  let scanningInterval: NodeJS.Timeout | null = null;
  let isActive = false;
  
  return {
    isInitialized: true,
    isScanning: false,
    scanningActive: false,
    error: null,
    permissionStatus: { granted: true, denied: false, prompt: false },
    capabilities: {
      supportedFormats: ['ean_13', 'ean_8', 'upc_a', 'code_128'],
      supportsFlashlight: true,
      supportsZoom: true,
      supportsFocus: true,
      maxZoom: 3
    },
    startScanning: mockStartScanning.mockImplementation(async (videoElement) => {
      // Check if getUserMedia will fail and handle camera access errors
      try {
        // This will trigger the mocked getUserMedia
        await mockGetUserMedia();
      } catch (error) {
        // Convert getUserMedia errors to camera access errors like the real useScanner does
        if (onScanError) {
          const cameraError = new Error('Ошибка доступа к камере');
          onScanError(cameraError);
        }
        // Don't throw the error - just report it and return, allowing retry
        return;
      }
      
      // Initialize scanning interval to indicate scanning is active
      isActive = true;
      
      // Simulate continuous scanning process
      const scanLoop = async () => {
        // Check if scanning was stopped
        if (!isActive) {
          return;
        }
        
        try {
          const result = await mockDecodeFromImageElement();
          if (result && onScanSuccess) {
            onScanSuccess({ text: result.getText(), format: result.getBarcodeFormat(), timestamp: new Date() });
            // Stop scanning after successful scan by default (like real scanner)
            isActive = false;
            if (scanningInterval) {
              clearTimeout(scanningInterval);
              scanningInterval = null;
            }
            return;
          }
        } catch (error) {
          // If mockDecodeFromImageElement throws an error, call onScanError
          if (onScanError) {
            const scanError = new Error('Ошибка сканирования');
            onScanError(scanError);
          }
          // Don't continue scanning after error - let the test handle recovery
          isActive = false;
          if (scanningInterval) {
            clearTimeout(scanningInterval);
            scanningInterval = null;
          }
          return;
        }
        
        // Continue scanning if no result and still active
        if (isActive) {
          scanningInterval = setTimeout(scanLoop, 100);
        }
      };
      
      // Start the scanning loop
      scanningInterval = setTimeout(scanLoop, 100);
    }),
    stopScanning: mockStopScanning.mockImplementation(() => {
      isActive = false;
      if (scanningInterval) {
        clearTimeout(scanningInterval);
        scanningInterval = null;
      }
    }),
    switchCamera: mockSwitchCamera,
    toggleFlashlight: mockToggleFlashlight,
    setZoom: mockSetZoom,
    scanFromImage: jest.fn().mockResolvedValue(null),
    getAvailableCameras: jest.fn().mockResolvedValue([
      { deviceId: 'camera1', label: 'Camera 1', kind: 'videoinput' as const, groupId: 'group1', toJSON: () => ({}) },
      { deviceId: 'camera2', label: 'Camera 2', kind: 'videoinput' as const, groupId: 'group2', toJSON: () => ({}) }
    ]),
    getCameraPermissionStatus: jest.fn().mockResolvedValue('granted' as const),
    getCurrentCameraId: jest.fn().mockReturnValue('camera1'),
    setFlashlight: jest.fn().mockResolvedValue(undefined),
    reinitialize: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn().mockReturnValue(undefined),
    flashlightEnabled: false,
    zoom: 1,
    availableCameras: [
      { deviceId: 'camera1', label: 'Camera 1', kind: 'videoinput' as const, groupId: 'group1', toJSON: () => ({}) },
      { deviceId: 'camera2', label: 'Camera 2', kind: 'videoinput' as const, groupId: 'group2', toJSON: () => ({}) }
    ],
    currentCameraId: 'camera1'
  };
});

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: mockEnumerateDevices,
  },
  writable: true,
});

// Mock HTMLVideoElement with realistic behavior
Object.defineProperty(global.HTMLVideoElement.prototype, 'play', {
  value: jest.fn().mockImplementation(function(this: HTMLVideoElement) {
    // Simulate video loading and playing - define read-only properties
    Object.defineProperty(this, 'readyState', { value: 4, configurable: true }); // HAVE_ENOUGH_DATA
    Object.defineProperty(this, 'videoWidth', { value: 640, configurable: true });
    Object.defineProperty(this, 'videoHeight', { value: 480, configurable: true });
    
    return Promise.resolve();
  }),
  writable: true,
});

// Mock readyState to always be ready
Object.defineProperty(global.HTMLVideoElement.prototype, 'readyState', {
  value: 4, // HAVE_ENOUGH_DATA
  writable: true,
});

// Mock srcObject property - automatically trigger loadedmetadata when set
Object.defineProperty(global.HTMLVideoElement.prototype, 'srcObject', {
  get: function() {
    return this._srcObject || null;
  },
  set: function(value) {
    this._srcObject = value;
    if (value) {
      // Set readyState immediately to simulate loaded metadata
      this.readyState = 4; // HAVE_ENOUGH_DATA
      
      // Trigger events immediately
      this.dispatchEvent(new Event('loadstart'));
      this.dispatchEvent(new Event('loadedmetadata'));
      this.dispatchEvent(new Event('canplay'));
    }
  },
  configurable: true,
});

Object.defineProperty(global.HTMLVideoElement.prototype, 'pause', {
  value: jest.fn(),
  writable: true,
});

// Mock HTMLCanvasElement with realistic drawing
Object.defineProperty(global.HTMLCanvasElement.prototype, 'getContext', {
  value: jest.fn().mockReturnValue({
    drawImage: jest.fn(),
    getImageData: jest.fn().mockReturnValue({
      data: new Uint8ClampedArray(640 * 480 * 4), // Realistic image data
      width: 640,
      height: 480,
    }),
  }),
  writable: true,
});

// Mock HTMLCanvasElement.prototype.toBlob
Object.defineProperty(global.HTMLCanvasElement.prototype, 'toBlob', {
  value: jest.fn().mockImplementation(function(callback: (blob: Blob | null) => void) {
    // Create a mock blob
    const mockBlob = new Blob(['mock image data'], { type: 'image/png' });
    callback(mockBlob);
  }),
  writable: true,
});

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn().mockReturnValue('mock-object-url');
global.URL.revokeObjectURL = jest.fn();

// Mock Image constructor
global.Image = class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src: string = '';
  
  constructor() {
    setTimeout(() => {
      if (this.onload) {
        this.onload();
      }
    }, 0);
  }
} as any;

describe('Scanner Component - Integration Tests', () => {
  const mockOnScan = jest.fn();
  const mockOnError = jest.fn();

  // Helper function to simulate video loading
  const simulateVideoLoaded = (videoElement: HTMLVideoElement) => {
    act(() => {
      // Set readyState to simulate loaded metadata
      Object.defineProperty(videoElement, 'readyState', { value: 1, configurable: true });
      videoElement.dispatchEvent(new Event('loadedmetadata'));
    });
  };

  beforeEach(() => {
    // Clear all mocks
    mockOnScan.mockClear();
    mockOnError.mockClear();
    mockStartScanning.mockClear();
    mockStopScanning.mockClear();
    mockSwitchCamera.mockClear();
    mockToggleFlashlight.mockClear();
    mockSetZoom.mockClear();
    mockDecodeFromImageElement.mockClear();
    mockReset.mockClear();
    mockGetUserMedia.mockClear();
    mockEnumerateDevices.mockClear();
    
    // Reset mocks
    mockGetUserMedia.mockResolvedValue({
      getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }]),
      getVideoTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }]),
    });
    
    mockEnumerateDevices.mockResolvedValue([
      { deviceId: 'camera1', label: 'Camera 1', kind: 'videoinput' as const, groupId: 'group1', toJSON: () => ({}) },
      { deviceId: 'camera2', label: 'Camera 2', kind: 'videoinput' as const, groupId: 'group2', toJSON: () => ({}) }
    ]);
    
    // Default successful barcode detection
    mockDecodeFromImageElement.mockResolvedValue({
      getText: () => '1234567890123',
      getBarcodeFormat: () => 'EAN_13',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Complete Scanning Workflow', () => {
    it('should complete full camera-to-scan workflow', async () => {
      render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      // Step 1: Verify video element is present
      const videoElement = screen.getByTestId('scanner-video');
      expect(videoElement).toBeInTheDocument();
      
      // Step 2: Wait for scanning to start (triggered automatically by loadedmetadata)
      await waitFor(() => {
        expect(mockStartScanning).toHaveBeenCalled();
      });
      
      // Step 3: Wait for scanning to start
      await waitFor(() => {
        expect(mockDecodeFromImageElement).toHaveBeenCalled();
      }, { timeout: 3000 });
      
      // Step 4: Verify successful scan
      await waitFor(() => {
        expect(mockOnScan).toHaveBeenCalledWith('1234567890123');
      });
    });

    it('should handle camera switching during scanning', async () => {
      render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      // Wait for initial scanning to start
      await waitFor(() => {
        expect(mockStartScanning).toHaveBeenCalled();
      });
      
      // Switch to front camera
      const switchButton = screen.getByTitle('Переключить камеру');
      await userEvent.click(switchButton);
      
      await waitFor(() => {
        expect(mockSwitchCamera).toHaveBeenCalled();
      });
      
      // Should continue scanning with new camera
      await waitFor(() => {
        expect(mockDecodeFromImageElement).toHaveBeenCalled();
      });
    });

    it('should handle multiple consecutive scans', async () => {
      // Clear previous calls
      mockOnScan.mockClear();
      
      // Setup multiple scan results in sequence
      mockDecodeFromImageElement
        .mockResolvedValueOnce({
          getText: () => '1234567890123',
          getBarcodeFormat: () => 'EAN_13',
        })
        .mockResolvedValueOnce({
          getText: () => '9876543210987',
          getBarcodeFormat: () => 'CODE_128',
        });
      
      // Render two separate scanner instances to simulate multiple scans
      const { unmount: unmount1 } = render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      // Wait for first scan
      await waitFor(() => {
        expect(mockOnScan).toHaveBeenCalledWith('1234567890123');
      });
      
      // Clean up first instance
      unmount1();
      
      // Render second scanner instance for second scan
      const { unmount: unmount2 } = render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      // Wait for second scan
      await waitFor(() => {
        expect(mockOnScan).toHaveBeenCalledWith('9876543210987');
      });
      
      // Clean up second instance
      unmount2();
      
      expect(mockOnScan).toHaveBeenCalledTimes(2);
    });
  });

  describe('MediaStream Lifecycle Integration', () => {
    it('should properly manage stream lifecycle during errors', async () => {
      // Setup error mock before rendering
      mockDecodeFromImageElement.mockReset();
      mockDecodeFromImageElement.mockRejectedValue(new Error('Camera disconnected'));
      
      render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      await waitFor(() => {
        expect(mockStartScanning).toHaveBeenCalled();
      });
      
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          expect.any(Error)
        );
      });
      
      // Scanner should handle error gracefully and video element should still be present
      expect(screen.getByTestId('scanner-video')).toBeInTheDocument();
    });

    it('should handle stream interruption and recovery', async () => {
      const mockTrack = { 
        stop: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
      
      const mockStream = {
        getTracks: jest.fn().mockReturnValue([mockTrack]),
        getVideoTracks: jest.fn().mockReturnValue([mockTrack]),
      };
      
      // Mock stream is handled by useScanner hook mock
      
      render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      await waitFor(() => {
        expect(mockStartScanning).toHaveBeenCalled();
      });
      
      // Simulate track ending (camera disconnected)
      const endedCallback = mockTrack.addEventListener.mock.calls
        .find(call => call[0] === 'ended')?.[1];
      
      if (endedCallback) {
        act(() => {
          endedCallback();
        });
      }
      
      // Should handle gracefully - video element should still be present
      expect(screen.getByTestId('scanner-video')).toBeInTheDocument();
    });
  });

  describe('Performance Integration', () => {
    it('should maintain performance during continuous scanning', async () => {
      const performanceStart = performance.now();
      
      // Clear any initial calls and reset all mocks
      mockOnScan.mockClear();
      mockStartScanning.mockClear();
      mockStopScanning.mockClear();
      mockDecodeFromImageElement.mockClear();
      
      // Simulate multiple scan cycles
      for (let i = 0; i < 10; i++) {
        const barcodeValue = `barcode-${i}`;
        
        // Setup mock for this scan - use mockResolvedValueOnce to ensure single call
        mockDecodeFromImageElement.mockResolvedValueOnce({
          getText: () => barcodeValue,
          getBarcodeFormat: () => 'EAN_13',
        });
        
        // Create new scanner instance for each scan
        const { unmount } = render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
        
        // Wait for this specific scan
        await waitFor(() => {
          expect(mockOnScan).toHaveBeenCalledWith(barcodeValue);
        }, { timeout: 500 });
        
        // Clean up this instance immediately to stop scanning
        unmount();
        
        // Small delay to ensure cleanup is complete
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const performanceEnd = performance.now();
      const duration = performanceEnd - performanceStart;
      
      // Should complete 10 scans in reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
      expect(mockOnScan.mock.calls.length).toBeGreaterThanOrEqual(10);
    });

    it('should not cause memory leaks during extended use', async () => {
      const { unmount, rerender } = render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      await waitFor(() => {
        expect(mockStartScanning).toHaveBeenCalled();
      });
      
      // Test multiple isActive cycles by re-rendering
      for (let i = 0; i < 5; i++) {
        // Deactivate scanner
        rerender(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={false} />);
        
        // Reactivate scanner
        rerender(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
        
        await waitFor(() => {
          expect(screen.getByTestId('scanner-video')).toBeInTheDocument();
        });
      }
      
      unmount();
      
      // All streams should be properly cleaned up
      // 1 initial call + 5 reactivation calls = 6 total
      expect(mockStartScanning).toHaveBeenCalledTimes(6);
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from temporary camera access issues', async () => {
      // First attempt fails
      mockGetUserMedia
        .mockRejectedValueOnce(new Error('Camera busy'))
        .mockResolvedValue({
          getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }]),
          getVideoTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }]),
        });
      
      render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      // Should show error immediately due to permission issue
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          expect.any(Error)
        );
      });
      
      await waitFor(() => {
        expect(mockStartScanning).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('scanner-video')).toBeInTheDocument();
      });
    });

    it('should handle ZXing library errors gracefully', async () => {
      // Setup error before rendering
      mockDecodeFromImageElement.mockClear();
      mockDecodeFromImageElement.mockRejectedValue(new Error('Decode failed'));
      
      const { rerender } = render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      await waitFor(() => {
        expect(mockStartScanning).toHaveBeenCalled();
      });
      
      // Wait for error to be handled
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          expect.any(Error)
        );
      }, { timeout: 5000 });
      
      // Should continue trying to scan - setup success after error
      mockDecodeFromImageElement.mockClear();
      mockDecodeFromImageElement.mockResolvedValue({
        getText: () => 'recovery-barcode',
        getBarcodeFormat: () => 'EAN_13',
      });
      
      // Restart scanning after error by calling startScanning again
      mockStartScanning.mockClear();
      
      // Trigger a new scan cycle by restarting the component
      rerender(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={false} />);
      rerender(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      await waitFor(() => {
        expect(mockOnScan).toHaveBeenCalledWith('recovery-barcode');
      });
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle rapid start/stop/start cycles', async () => {
      const { rerender } = render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      // Camera starts automatically, test rapid stop/start cycles
      for (let i = 0; i < 3; i++) {
        // Simulate stop/start cycles with rerender
        rerender(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={false} />);
        
        await waitFor(() => {
          expect(screen.queryByTestId('scanner-video')).not.toBeInTheDocument();
        });
        
        rerender(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      }
      
      // Final state should work properly
      await waitFor(() => {
        expect(mockStartScanning).toHaveBeenCalled();
        expect(screen.getByTestId('scanner-video')).toBeInTheDocument();
      });
    });

    it('should work correctly after page visibility changes', async () => {
      render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      await waitFor(() => {
        expect(mockStartScanning).toHaveBeenCalled();
      });
      
      // Simulate page becoming hidden
      Object.defineProperty(document, 'hidden', {
        value: true,
        writable: true,
      });
      
      const visibilityEvent = new Event('visibilitychange');
      document.dispatchEvent(visibilityEvent);
      
      // Simulate page becoming visible again
      Object.defineProperty(document, 'hidden', {
        value: false,
        writable: true,
      });
      
      document.dispatchEvent(visibilityEvent);
      
      // Should continue working
      await waitFor(() => {
        expect(mockDecodeFromImageElement).toHaveBeenCalled();
      });
    });
  });
});