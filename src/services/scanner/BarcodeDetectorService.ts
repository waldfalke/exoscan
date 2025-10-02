/**
 * Реализация сканера на основе нативного BarcodeDetector API
 * Обеспечивает лучшую производительность в поддерживаемых браузерах
 */

import { ScannerService, ScanResult, ScannerCapabilities, CameraPermissionStatus } from './ScannerService'

// Типы для BarcodeDetector API
interface DetectedBarcode {
  boundingBox: DOMRectReadOnly
  cornerPoints: Array<{ x: number; y: number }>
  format: string
  rawValue: string
}

interface BarcodeDetectorOptions {
  formats?: string[]
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: BarcodeDetectorOptions): BarcodeDetector
      getSupportedFormats(): Promise<string[]>
    }
  }
}

interface BarcodeDetector {
  detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>
}

export class BarcodeDetectorService extends ScannerService {
  private detector: BarcodeDetector | null = null
  private currentVideoElement: HTMLVideoElement | null = null
  private autoScanInterval: NodeJS.Timeout | null = null
  private supportedFormats: string[] = []
  private currentCameraId: string | null = null
  private isInitialized: boolean = false
  private isDisposed: boolean = false

  constructor(config = {}) {
    super(config)
  }

  async initialize(): Promise<void> {
    this.log('Инициализация BarcodeDetector сканера...')
    
    if (!this.isSupported()) {
      throw new Error('BarcodeDetector API не поддерживается в этом браузере')
    }

    try {
      // Получаем поддерживаемые форматы
      this.supportedFormats = await window.BarcodeDetector!.getSupportedFormats()
      this.log('Поддерживаемые форматы:', this.supportedFormats)

      // Создаем детектор с нужными форматами
      const formats = this.config.formats || this.supportedFormats
      this.detector = new window.BarcodeDetector!({ formats })
      
      this.isInitialized = true
      this.log('BarcodeDetector инициализирован успешно')
    } catch (error) {
      this.logError('Ошибка инициализации BarcodeDetector:', error)
      throw error
    }
  }

  static isSupported(): boolean {
    return 'BarcodeDetector' in window
  }

  private isSupported(): boolean {
    return BarcodeDetectorService.isSupported()
  }

  async getCapabilities(): Promise<ScannerCapabilities> {
    if (!this.detector) {
      await this.initialize()
    }

    return {
      supportedFormats: this.supportedFormats,
      supportsFlashlight: true, // Зависит от камеры
      supportsZoom: true,
      supportsFocus: true,
      maxZoom: 3
    }
  }

  async startScanning(
    videoElement: HTMLVideoElement,
    onResult: (result: ScanResult) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    if (this.isScanning) {
      this.log('Сканирование уже активно')
      return
    }

    if (!this.detector) {
      await this.initialize()
    }

    this.currentVideoElement = videoElement
    this.isScanning = true

    try {
      this.log('Запуск сканирования с BarcodeDetector...')
      
      // Получаем поток камеры
      const stream = await this.getCameraStream()
      this.currentStream = stream
      
      // Настраиваем видео элемент с мобильными атрибутами
      try {
        // Критически важные атрибуты для мобильных устройств
        videoElement.autoplay = true
        videoElement.muted = true
        videoElement.playsInline = true
        videoElement.setAttribute('playsinline', 'true')
        videoElement.setAttribute('webkit-playsinline', 'true')
        videoElement.controls = false
        
        this.log('Мобильные атрибуты видео установлены')
      } catch (attrErr) {
        this.logError('Ошибка установки атрибутов видео:', attrErr)
      }
      
      videoElement.srcObject = stream
      await this.waitForVideoReady(videoElement)
      
      // Запускаем автоматическое сканирование
      if (this.config.autoScan) {
        this.setupAutoScanning(videoElement, onResult, onError)
      }
      
      this.log('Сканирование с BarcodeDetector запущено успешно')
      
    } catch (error) {
      this.isScanning = false
      this.logError('Ошибка запуска сканирования:', error)
      if (onError) {
        onError(error as Error)
      }
      throw error
    }
  }

  stopScanning(): void {
    this.log('Остановка сканирования BarcodeDetector...')
    
    this.isScanning = false
    
    if (this.autoScanInterval) {
      clearInterval(this.autoScanInterval)
      this.autoScanInterval = null
    }
    
    this.stopCurrentStream(this.currentVideoElement || undefined)
    this.currentVideoElement = null
    
    this.log('Сканирование BarcodeDetector остановлено')
  }

  async scanFromImage(imageFile: File): Promise<ScanResult> {
    this.log('Сканирование изображения с BarcodeDetector...')
    
    if (!this.detector) {
      await this.initialize()
    }

    try {
      // Создаем ImageBitmap из файла
      const imageBitmap = await createImageBitmap(imageFile)
      
      // Детектируем штрих-коды
      const detectedCodes = await this.detector!.detect(imageBitmap)
      
      if (detectedCodes.length === 0) {
        throw new Error('Штрих-код не найден в изображении')
      }

      // Берем первый найденный код
      const code = detectedCodes[0]
      
      return {
        text: code.rawValue,
        format: code.format,
        timestamp: new Date(),
        boundingBox: {
          x: code.boundingBox.x,
          y: code.boundingBox.y,
          width: code.boundingBox.width,
          height: code.boundingBox.height
        },
        cornerPoints: code.cornerPoints
      }
    } catch (error) {
      this.logError('Ошибка сканирования изображения:', error)
      throw error
    }
  }

  async switchCamera(): Promise<void> {
    if (!this.isInitialized || this.isDisposed) {
      throw new Error('Scanner not initialized')
    }

    const cameras = await this.getAvailableCameras()
    if (cameras.length <= 1) {
      throw new Error('No additional cameras available')
    }

    const currentIndex = cameras.findIndex((camera: MediaDeviceInfo) => camera.deviceId === this.currentCameraId)
    const nextIndex = (currentIndex + 1) % cameras.length
    const nextCamera = cameras[nextIndex]

    // Stop current stream
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop())
      this.currentStream = null
    }

    // Start with new camera
    this.currentCameraId = nextCamera.deviceId
    
    if (this.config.enableDiagnostics) {
      console.log('🔄 BarcodeDetector: Switched to camera:', nextCamera.label || nextCamera.deviceId)
    }
  }

  getCurrentCameraId(): string | null {
    return this.currentCameraId
  }

  async getAvailableCameras(): Promise<MediaDeviceInfo[]> {
    try {
      return await this.getVideoDevices()
    } catch (error) {
      this.logError('Ошибка получения списка камер:', error)
      return []
    }
  }

  async getCameraPermissionStatus(): Promise<CameraPermissionStatus> {
    return await this.checkCameraPermission()
  }

  async setFlashlight(enabled: boolean): Promise<void> {
    if (!this.currentStream) {
      throw new Error('No active camera stream')
    }

    const track = this.currentStream.getVideoTracks()[0]
    if (!track) {
      throw new Error('No video track available')
    }

    try {
      const capabilities = track.getCapabilities()
      if ('torch' in capabilities && capabilities.torch) {
        await track.applyConstraints({
          advanced: [{ torch: enabled } as any]
        })
        
        if (this.config.enableDiagnostics) {
          console.log(`🔦 BarcodeDetector: Flashlight ${enabled ? 'enabled' : 'disabled'}`)
        }
      } else {
        throw new Error('Flashlight not supported')
      }
    } catch (error) {
      if (this.config.enableDiagnostics) {
        console.error('❌ BarcodeDetector: Flashlight error:', error)
      }
      throw error
    }
  }

  async setZoom(level: number): Promise<void> {
    if (!this.currentStream) {
      throw new Error('No active camera stream')
    }

    const track = this.currentStream.getVideoTracks()[0]
    if (!track) {
      throw new Error('No video track available')
    }

    try {
      const capabilities = track.getCapabilities()
      if ('zoom' in capabilities && capabilities.zoom) {
        const zoomCapability = capabilities.zoom as { min: number; max: number }
        const { min, max } = zoomCapability
        const clampedZoom = Math.max(min, Math.min(max, level))
        
        await track.applyConstraints({
          advanced: [{ zoom: clampedZoom } as any]
        })
        
        if (this.config.enableDiagnostics) {
          console.log(`🔍 BarcodeDetector: Zoom set to ${clampedZoom}x`)
        }
      } else {
        throw new Error('Zoom not supported')
      }
    } catch (error) {
      if (this.config.enableDiagnostics) {
        console.error('❌ BarcodeDetector: Zoom error:', error)
      }
      throw error
    }
  }

  async dispose(): Promise<void> {
    this.stopScanning()
    
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop())
      this.currentStream = null
    }
    
    this.detector = null
    this.isDisposed = true
    
    if (this.config.enableDiagnostics) {
      console.log('🗑️ BarcodeDetector Scanner disposed')
    }
  }

  // Приватные методы
  private async getCameraStream(): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 30 }
      }
    }

    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (error) {
      this.logError('Ошибка получения камеры:', error)
      // Fallback к базовым ограничениям
      return await navigator.mediaDevices.getUserMedia({ video: true })
    }
  }

  private async waitForVideoReady(videoElement: HTMLVideoElement): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Таймаут ожидания готовности видео'))
      }, 10000)

      const cleanup = () => {
        clearTimeout(timeout)
        videoElement.removeEventListener('loadedmetadata', onLoadedMetadata)
        videoElement.removeEventListener('canplay', onCanPlay)
        videoElement.removeEventListener('error', onError)
      }

      const onLoadedMetadata = () => {
        this.log('Метаданные видео загружены')
        // Не завершаем сразу, ждем canplay
      }

      const onCanPlay = () => {
        this.log('Видео готово к воспроизведению')
        cleanup()
        
        // Попытка воспроизведения с обработкой ошибок
        videoElement.play().then(() => {
          this.log('Видео успешно запущено')
          resolve()
        }).catch((playError) => {
          this.logError('Ошибка воспроизведения видео:', playError)
          // Для некоторых браузеров автовоспроизведение может быть заблокировано
          // но видео все равно готово к использованию
          resolve()
        })
      }

      const onError = (error: any) => {
        this.logError('Ошибка видео элемента:', error)
        cleanup()
        reject(error)
      }

      // Проверяем, готово ли видео уже
      if (videoElement.readyState >= 3) { // HAVE_FUTURE_DATA
        this.log('Видео уже готово')
        onCanPlay()
        return
      }

      videoElement.addEventListener('loadedmetadata', onLoadedMetadata)
      videoElement.addEventListener('canplay', onCanPlay)
      videoElement.addEventListener('error', onError)
    })
  }

  private setupAutoScanning(
    videoElement: HTMLVideoElement,
    onResult: (result: ScanResult) => void,
    onError?: (error: Error) => void
  ): void {
    this.log('Настройка автоматического сканирования BarcodeDetector...')
    
    if (this.autoScanInterval) {
      clearInterval(this.autoScanInterval)
    }

    this.autoScanInterval = setInterval(async () => {
      if (!this.isScanning) {
        this.log('Сканирование остановлено, прекращаем автосканирование')
        return
      }

      try {
        this.log('Попытка автоматического сканирования BarcodeDetector...')
        const result = await this.captureFrame(videoElement)
        if (result) {
          this.log('Штрих-код обнаружен BarcodeDetector:', result)
          onResult(result)
        }
      } catch (error) {
        this.logError('Ошибка автоматического сканирования BarcodeDetector:', error)
        if (onError) {
          onError(error as Error)
        }
      }
    }, this.config.scanInterval)
  }

  private async captureFrame(videoElement: HTMLVideoElement): Promise<ScanResult | null> {
    this.log('Захват кадра для BarcodeDetector...')
    
    if (!videoElement || videoElement.readyState !== 4) {
      this.log('Видео не готово для захвата кадра')
      return null
    }

    if (!this.detector) {
      this.logError('BarcodeDetector не инициализирован')
      return null
    }

    try {
      // Создаем ImageBitmap напрямую из видео элемента
      const imageBitmap = await createImageBitmap(videoElement)
      
      this.log(`Размеры кадра: ${imageBitmap.width}x${imageBitmap.height}`)
      
      // Детектируем штрих-коды
      const detectedCodes = await this.detector.detect(imageBitmap)
      
      // Освобождаем ресурсы
      imageBitmap.close()
      
      if (detectedCodes.length === 0) {
        this.log('Штрих-код не найден в кадре')
        return null
      }

      // Берем первый найденный код
      const code = detectedCodes[0]
      
      const scanResult: ScanResult = {
        text: code.rawValue,
        format: code.format,
        timestamp: new Date(),
        boundingBox: {
          x: code.boundingBox.x,
          y: code.boundingBox.y,
          width: code.boundingBox.width,
          height: code.boundingBox.height
        },
        cornerPoints: code.cornerPoints
      }
      
      this.log('BarcodeDetector декодирование успешно:', scanResult)
      return scanResult
      
    } catch (error) {
      this.logError('Ошибка захвата кадра BarcodeDetector:', error)
      return null
    }
  }
}