import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Scanner from '../Scanner';

// Mock MediaDevices API
const mockGetUserMedia = jest.fn();
const mockEnumerateDevices = jest.fn();
const mockStreamTracks: any[] = [];

// Create a mock MediaStream with proper track management
const createMockStream = () => {
  const mockTrack = {
    stop: jest.fn(),
    kind: 'video',
    getSettings: jest.fn().mockReturnValue({ width: 640, height: 480 })
  };
  
  // Add track to global tracking array
  mockStreamTracks.push(mockTrack);
  
  return {
    getTracks: jest.fn().mockReturnValue([mockTrack]),
    getVideoTracks: jest.fn().mockReturnValue([mockTrack]),
    addTrack: jest.fn(),
    removeTrack: jest.fn(),
    clone: jest.fn(),
    id: 'mock-stream-id'
  };
};

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: mockEnumerateDevices,
  },
  writable: true,
});

// Mock HTMLVideoElement
Object.defineProperty(global.HTMLVideoElement.prototype, 'play', {
  value: jest.fn().mockResolvedValue(undefined),
  writable: true,
});

Object.defineProperty(global.HTMLVideoElement.prototype, 'pause', {
  value: jest.fn(),
  writable: true,
});

Object.defineProperty(global.HTMLVideoElement.prototype, 'readyState', {
  value: 4, // HAVE_ENOUGH_DATA
  writable: true,
});

// Mock srcObject setter to trigger loadedmetadata event
Object.defineProperty(global.HTMLVideoElement.prototype, 'srcObject', {
  set: function(stream) {
    this._srcObject = stream;
    // Simulate loadedmetadata event after a short delay
    setTimeout(() => {
      this.dispatchEvent(new Event('loadedmetadata'));
    }, 10);
  },
  get: function() {
    return this._srcObject;
  },
  configurable: true,
});

// Mock canvas contextHTMLCanvasElement
Object.defineProperty(global.HTMLCanvasElement.prototype, 'getContext', {
  value: jest.fn().mockReturnValue({
    drawImage: jest.fn(),
    getImageData: jest.fn().mockReturnValue({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
    }),
  }),
  writable: true,
});

// Mock ZXing library
jest.mock('@zxing/library', () => ({
  BrowserMultiFormatReader: jest.fn().mockImplementation(() => ({
    decodeFromCanvas: jest.fn().mockResolvedValue({
      getText: () => 'test-barcode-123',
      getBarcodeFormat: () => 'EAN_13',
    }),
    reset: jest.fn(),
    listVideoInputDevices: jest.fn().mockResolvedValue([
      { 
        deviceId: 'camera1', 
        kind: 'videoinput', 
        label: 'Back Camera',
        groupId: 'group1'
      },
      { 
        deviceId: 'camera2', 
        kind: 'videoinput', 
        label: 'Front Camera',
        groupId: 'group2'
      }
    ]),
  })),
  BarcodeFormat: {
    EAN_13: 'EAN_13',
    CODE_128: 'CODE_128',
  },
}));

describe('Scanner Component - Baseline Tests', () => {
  const mockOnScan = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockStreamTracks.length = 0; // Clear tracked streams
    
    // Setup mock to return new stream each time
    mockGetUserMedia.mockImplementation(() => 
      Promise.resolve(createMockStream())
    );
    
    mockEnumerateDevices.mockResolvedValue([
      { deviceId: 'camera1', kind: 'videoinput', label: 'Camera 1' }
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render scanner interface when active', async () => {
      render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      // Wait for the component to initialize
      await waitFor(() => {
        expect(screen.getByTestId('scanner-video')).toBeInTheDocument();
      });
    });

    it('should not render when inactive', async () => {
      const { container } = render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={false} />);
      
      expect(container.firstChild).toBeNull();
    });

    it('should show loading state during camera initialization', async () => {
      // Override the beforeEach mock setup for this specific test
      mockGetUserMedia.mockReset();
      // Make getUserMedia hang to test loading state
      mockGetUserMedia.mockImplementation(() => new Promise(() => {}));
      
      render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Инициализация сканера...')).toBeInTheDocument();
      });
    });
  });

  describe('MediaStream Lifecycle', () => {
    it('should initialize camera successfully', async () => {
      render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith({
          video: expect.objectContaining({
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 30, max: 60 }
          })
        });
      });
    });

    it('should handle camera permission denied', async () => {
      // Override the beforeEach mock setup for this specific test
      mockGetUserMedia.mockReset();
      const permissionError = new DOMException('Permission denied', 'NotAllowedError');
      mockGetUserMedia.mockRejectedValue(permissionError);
      
      render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          expect.any(Error)
        );
      });
    });

    it('should cleanup MediaStream on component unmount', async () => {
      const mockTrack = { stop: jest.fn() };
      const mockStream = {
        getTracks: jest.fn().mockReturnValue([mockTrack]),
        getVideoTracks: jest.fn().mockReturnValue([mockTrack]),
      };
      
      mockGetUserMedia.mockResolvedValue(mockStream);
      
      const { unmount } = render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });
      
      unmount();
      
      expect(mockTrack.stop).toHaveBeenCalled();
    });
  });

  describe('React Strict Mode Behavior', () => {
    it('should handle double mounting without errors', async () => {
      // First mount
      const { unmount } = render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={false} />);
      unmount();
      
      // Second mount (simulating Strict Mode behavior)
      render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      // Should not throw errors or call getUserMedia multiple times unnecessarily
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
      });
    });

    it('should not create multiple MediaStreams on re-renders', async () => {
      const { rerender } = render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
      });
      
      // Force re-render
      rerender(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      // Should not call getUserMedia again
      expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
    });
  });

  describe('useEffect Race Conditions', () => {
    it('should handle rapid isActive changes', async () => {
      const { rerender } = render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={false} />);
      
      // Rapid isActive changes
      rerender(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      rerender(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={false} />);
      rerender(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      // Should not cause multiple concurrent getUserMedia calls
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle camera not found error', async () => {
      // Override the beforeEach mock setup for this specific test
      mockGetUserMedia.mockReset();
      const notFoundError = new DOMException('Camera not found', 'NotFoundError');
      mockGetUserMedia.mockRejectedValue(notFoundError);
      
      render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          expect.any(Error)
        );
      });
    });

    it('should handle generic camera errors', async () => {
      // Override the beforeEach mock setup for this specific test
      mockGetUserMedia.mockReset();
      mockGetUserMedia.mockRejectedValue(new Error('Generic error'));
      
      render(<Scanner onScan={mockOnScan} onError={mockOnError} isActive={true} />);
      
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          expect.any(Error)
        );
      });
    });
  });
});