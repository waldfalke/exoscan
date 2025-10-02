/**
 * Абстрактный интерфейс для сервисов сканирования штрих-кодов
 * Позволяет легко переключаться между различными реализациями
 */

export interface ScanResult {
  text: string
  format: string
  timestamp: Date
  confidence?: number
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
  cornerPoints?: Array<{ x: number; y: number }>
}

export interface ScannerCapabilities {
  supportedFormats: string[]
  supportsFlashlight: boolean
  supportsZoom: boolean
  supportsFocus: boolean
  maxZoom: number
  zoom?: {
    supported: boolean;
    min: number;
    max: number;
    step: number;
  };
  torch?: {
    supported: boolean;
  };
  flashlight?: {
    supported: boolean;
  };
  focus?: {
    supported: boolean;
    modes: string[];
  };
}

export interface ScannerConfig {
  autoScan?: boolean
  scanInterval?: number
  formats?: string[]
  enableDiagnostics?: boolean
  preferredFormats?: string[]
  scanRegion?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface CameraPermissionStatus {
  granted: boolean
  denied: boolean
  prompt: boolean
  error?: string
}

export interface FlashlightCapabilities {
  supported: boolean
  enabled: boolean
  track?: MediaStreamTrack
}

/**
 * Абстрактный класс для всех сканеров штрих-кодов
 */
export abstract class ScannerService {
  protected config: ScannerConfig
  protected isScanning: boolean = false
  protected currentStream: MediaStream | null = null

  constructor(config: Partial<ScannerConfig> = {}) {
    this.config = {
      autoScan: true,
      scanInterval: 300, // Увеличен интервал для лучшей производительности на мобильных устройствах
      enableDiagnostics: false,
      ...config
    }
  }

  // Абстрактные методы, которые должны быть реализованы в наследниках
  abstract initialize(): Promise<void>
  abstract startScanning(
    videoElement: HTMLVideoElement,
    onResult: (result: ScanResult) => void,
    onError?: (error: Error) => void
  ): Promise<void>
  abstract stopScanning(): void
  abstract scanFromImage(imageFile: File): Promise<ScanResult>
  abstract getCapabilities(): Promise<ScannerCapabilities>
  abstract dispose(): void
  abstract switchCamera(): Promise<void>
  abstract getCurrentCameraId(): string | null
  abstract setFlashlight(enabled: boolean): Promise<void>
  abstract setZoom(level: number): Promise<void>
  abstract getAvailableCameras(): Promise<MediaDeviceInfo[]>
  abstract getCameraPermissionStatus(): Promise<CameraPermissionStatus>

  // Общие методы для всех реализаций
  isCurrentlyScanning(): boolean {
    return this.isScanning
  }

  updateConfig(newConfig: Partial<ScannerConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  getConfig(): ScannerConfig {
    return { ...this.config }
  }

  // Статические методы для проверки поддержки
  static isCameraSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  }

  static isSecureContext(): boolean {
    return window.isSecureContext || window.location.protocol === 'http:' && window.location.hostname === 'localhost'
  }

  // Методы для работы с камерой (общие для всех реализаций)
  async checkCameraPermission(): Promise<CameraPermissionStatus> {
    if (!ScannerService.isCameraSupported()) {
      return {
        granted: false,
        denied: true,
        prompt: false,
        error: 'Camera not supported'
      }
    }

    try {
      const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName })
      return {
        granted: permissions.state === 'granted',
        denied: permissions.state === 'denied',
        prompt: permissions.state === 'prompt'
      }
    } catch (error) {
      // Fallback для браузеров без поддержки Permissions API
      return {
        granted: false,
        denied: false,
        prompt: true
      }
    }
  }

  async requestCameraPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(track => track.stop())
      return true
    } catch (error) {
      console.error('Camera permission denied:', error)
      return false
    }
  }

  async getVideoDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter(device => device.kind === 'videoinput')
    } catch (error) {
      console.error('Error getting video devices:', error)
      return []
    }
  }

  protected stopCurrentStream(videoElement?: HTMLVideoElement): void {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop())
      this.currentStream = null
    }

    if (videoElement) {
      videoElement.srcObject = null
    }
  }

  protected log(message: string, ...args: any[]): void {
    if (this.config.enableDiagnostics) {
      console.log(`[${this.constructor.name}] ${message}`, ...args)
    }
  }

  protected logError(message: string, error?: any): void {
    if (this.config.enableDiagnostics) {
      console.error(`[${this.constructor.name}] ${message}`, error)
    }
  }
}