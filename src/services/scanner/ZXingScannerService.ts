/**
 * Реализация сканера на основе ZXing библиотеки
 * Перенесенная и оптимизированная логика из существующего scanner.ts
 */

import { BrowserMultiFormatReader } from '@zxing/library'
import { ScannerService, ScanResult, ScannerCapabilities, FlashlightCapabilities, CameraPermissionStatus } from './ScannerService'
import { ZXING_FORMATS } from '@/constants/barcodeFormats'

// Расширенные интерфейсы для работы с камерой
interface ExtendedMediaTrackSettings extends MediaTrackSettings {
  torch?: boolean
}

interface ExtendedMediaTrackConstraints extends MediaTrackConstraints {
  torch?: boolean
  focusMode?: { ideal: string }
  exposureMode?: { ideal: string }
  whiteBalanceMode?: { ideal: string }
  focusDistance?: { ideal: number; max: number }
}

export class ZXingScannerService extends ScannerService {
  private reader: BrowserMultiFormatReader
  private flashlightTrack: MediaStreamTrack | null = null
  private currentVideoElement: HTMLVideoElement | null = null
  private autoScanInterval: NodeJS.Timeout | null = null
  private videoHealthInterval: NodeJS.Timeout | null = null
  private currentCameraId: string | null = null
  
  // ROI оптимизация
  private readonly ROI_CENTER_RATIO = 0.5 // 50% от центра экрана
  private readonly ROI_SIZE_RATIO = 0.6 // 60% размера экрана
  
  // Фильтр повторяющихся кадров
  private lastFrameHash: string | null = null
  private readonly FRAME_CHANGE_THRESHOLD = 0.05 // 5% изменений для считывания нового кадра
  private frameSkipCount = 0
  private readonly MAX_FRAME_SKIPS = 10 // Максимум пропусков подряд

  constructor(config = {}) {
    super(config)
    this.reader = new BrowserMultiFormatReader()
    
    // Оптимизированные настройки декодера для максимальной производительности
    const hints = new Map()
    // КРИТИЧНО: Отключаем TRY_HARDER для значительного ускорения
    hints.set(2, false) // TRY_HARDER = false
    hints.set(3, false) // PURE_BARCODE = false (не нужно для обычных штрихкодов)
    
    // Явно указываем только необходимые форматы для ускорения
    const optimizedFormats = [
      'QR_CODE',
      'CODE_128', 
      'EAN_13',
      'EAN_8',
      'CODE_39'
    ]
    hints.set(1, optimizedFormats) // POSSIBLE_FORMATS
    
    this.reader.hints = hints
    this.log('ZXing декодер инициализирован с оптимизированными настройками для производительности')
  }

  async initialize(): Promise<void> {
    this.log('Инициализация ZXing сканера...')
    // ZXing не требует дополнительной инициализации
  }

  async getCapabilities(): Promise<ScannerCapabilities> {
    // Используем только форматы штрих-кодов товаров (без QR)
    const supportedFormats = this.config.formats || [...ZXING_FORMATS]
    
    this.log('Поддерживаемые форматы штрих-кодов:', supportedFormats)
    
    return {
      supportedFormats,
      supportsFlashlight: true,
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

    this.currentVideoElement = videoElement
    this.isScanning = true

    try {
      this.log('Запуск сканирования...')
      
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
      
      // Проверяем поддержку фонарика
      await this.checkFlashlightSupport(stream)
      
      // Запускаем автоматическое сканирование
      if (this.config.autoScan) {
        this.setupAutoScanning(videoElement, onResult, onError)
      }
      
      // Мониторинг здоровья видеопотока
      this.setupVideoHealthMonitoring(videoElement, onError)
      
      this.log('Сканирование успешно запущено')
      
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
    this.log('Остановка сканирования...')
    
    this.isScanning = false
    
    if (this.autoScanInterval) {
      clearInterval(this.autoScanInterval)
      this.autoScanInterval = null
    }
    
    if (this.videoHealthInterval) {
      clearInterval(this.videoHealthInterval)
      this.videoHealthInterval = null
    }
    
    this.stopCurrentStream(this.currentVideoElement || undefined)
    this.currentVideoElement = null
    this.flashlightTrack = null
    
    this.log('Сканирование остановлено')
  }

  async scanFromImage(imageFile: File): Promise<ScanResult> {
    this.log('Сканирование из изображения...')
    
    try {
      const imageElement = await this.createImageElement(imageFile)
      const result = await this.reader.decodeFromImageElement(imageElement)
      
      return {
        text: result.getText(),
        format: result.getBarcodeFormat().toString(),
        timestamp: new Date()
      }
    } catch (error) {
      this.logError('Ошибка сканирования изображения:', error)
      throw new Error('Не удалось найти штрих-код в изображении')
    }
  }

  async switchCamera(): Promise<void> {
    if (!this.isScanning) {
      throw new Error('Scanner not active')
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
    
    this.log('Переключение на камеру:', nextCamera.label || nextCamera.deviceId)
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
        
        this.log(`Фонарик ${enabled ? 'включен' : 'выключен'}`)
      } else {
        throw new Error('Flashlight not supported')
      }
    } catch (error) {
      this.logError('Ошибка управления фонариком:', error)
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
        
        this.log(`Зум установлен на ${clampedZoom}x`)
      } else {
        throw new Error('Zoom not supported')
      }
    } catch (error) {
      this.logError('Ошибка управления зумом:', error)
      throw error
    }
  }

  dispose(): void {
    this.stopScanning()
    this.reader.reset()
  }

  // Методы для работы с фонариком
  async checkFlashlightSupport(stream?: MediaStream): Promise<FlashlightCapabilities> {
    const targetStream = stream || this.currentStream
    
    if (!targetStream) {
      return { supported: false, enabled: false }
    }

    const videoTrack = targetStream.getVideoTracks()[0]
    if (!videoTrack) {
      return { supported: false, enabled: false }
    }

    try {
      const capabilities = videoTrack.getCapabilities()
      const settings = videoTrack.getSettings() as ExtendedMediaTrackSettings
      
      if ('torch' in capabilities) {
        this.flashlightTrack = videoTrack
        return {
          supported: true,
          enabled: settings.torch || false,
          track: videoTrack
        }
      }
    } catch (error) {
      this.logError('Ошибка проверки поддержки фонарика:', error)
    }

    return { supported: false, enabled: false }
  }

  async toggleFlashlight(enable?: boolean): Promise<boolean> {
    if (!this.flashlightTrack) {
      this.log('Фонарик не поддерживается')
      return false
    }

    try {
      const settings = this.flashlightTrack.getSettings() as ExtendedMediaTrackSettings
      const currentState = settings.torch || false
      const newState = enable !== undefined ? enable : !currentState

      await this.flashlightTrack.applyConstraints({
        advanced: [{ torch: newState } as any]
      })

      this.log(`Фонарик ${newState ? 'включен' : 'выключен'}`)
      return newState
    } catch (error) {
      this.logError('Ошибка переключения фонарика:', error)
      return false
    }
  }

  // Приватные методы
  private async getCameraStream(deviceId?: string): Promise<MediaStream> {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    // Пробуем разные стратегии получения потока
    const strategies = [
      () => this.getOptimalCameraConstraints(deviceId, isMobile),
      () => this.getBasicCameraConstraints(deviceId),
      () => this.getMinimalCameraConstraints(deviceId)
    ]

    for (const getConstraints of strategies) {
      try {
        const constraints = getConstraints()
        this.log('Попытка получения камеры с ограничениями:', constraints)
        return await navigator.mediaDevices.getUserMedia(constraints)
      } catch (error) {
        this.logError('Ошибка получения камеры:', error)
      }
    }

    throw new Error('Не удалось получить доступ к камере')
  }

  private getOptimalCameraConstraints(deviceId?: string, isMobile: boolean = false): MediaStreamConstraints {
    const videoConstraints: ExtendedMediaTrackConstraints = {
      facingMode: isMobile ? { ideal: 'environment' } : undefined,
      // ОПТИМИЗАЦИЯ: Снижаем разрешение до HD для лучшей производительности
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
      frameRate: { ideal: 30, max: 30 }, // Ограничиваем FPS для стабильности
      
      // КРИТИЧЕСКАЯ ОПТИМИЗАЦИЯ: Фиксированная фокусировка для штрих-кодов на 20-30 см
      focusMode: { ideal: 'manual' }, // Ручной режим для фиксированной фокусировки
      focusDistance: { ideal: 0.25, max: 0.35 }, // Фиксированное расстояние 20-30 см (0.2-0.3 в диапазоне 0-1)
      
      // Дополнительные настройки камеры для лучшего сканирования
      exposureMode: { ideal: 'continuous' },
      whiteBalanceMode: { ideal: 'continuous' },
      
      // Дополнительные настройки для лучшего сканирования штрих-кодов
      aspectRatio: { ideal: 16/9 },
      resizeMode: { ideal: 'crop-and-scale' }
    }

    if (deviceId) {
      videoConstraints.deviceId = { exact: deviceId }
    }

    return { video: videoConstraints }
  }

  private getBasicCameraConstraints(deviceId?: string): MediaStreamConstraints {
    const videoConstraints: any = {
      // ОПТИМИЗАЦИЯ: Базовое разрешение еще ниже для слабых устройств
      width: { ideal: 960 },
      height: { ideal: 540 },
      frameRate: { ideal: 24 },
      
      // Фиксированная фокусировка для слабых устройств
      focusMode: { ideal: 'manual' },
      focusDistance: { ideal: 0.3 } // 30 см для слабых устройств
    }

    if (deviceId) {
      videoConstraints.deviceId = { exact: deviceId }
    }

    return { video: videoConstraints }
  }

  private getMinimalCameraConstraints(deviceId?: string): MediaStreamConstraints {
    const videoConstraints: any = {}
    
    if (deviceId) {
      videoConstraints.deviceId = { exact: deviceId }
    }

    return { video: videoConstraints }
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
    this.log('Настройка автоматического сканирования...')
    
    if (this.autoScanInterval) {
      clearInterval(this.autoScanInterval)
    }

    this.autoScanInterval = setInterval(async () => {
      if (!this.isScanning) {
        this.log('Сканирование остановлено, прекращаем автосканирование')
        return
      }

      try {
        this.log('Попытка автоматического сканирования...')
        const result = await this.captureFrame(videoElement)
        if (result) {
          this.log('Штрих-код обнаружен:', result)
          onResult(result)
        }
      } catch (error) {
        this.logError('Ошибка автоматического сканирования:', error)
        if (onError) {
          onError(error as Error)
        }
      }
    }, this.config.scanInterval)
  }

  private async captureFrame(videoElement: HTMLVideoElement): Promise<ScanResult | null> {
    this.log('Захват кадра для сканирования...')
    
    if (!videoElement || videoElement.readyState !== 4) {
      this.log(`Видео не готово для захвата кадра. ReadyState: ${videoElement?.readyState}`)
      return null
    }
    
    this.log(`Видео готово. Размеры: ${videoElement.videoWidth}x${videoElement.videoHeight}, ReadyState: ${videoElement.readyState}`)

    try {
      // Создаем canvas для захвата кадра
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      
      if (!context) {
        throw new Error('Не удалось создать 2D контекст canvas')
      }

      // КРИТИЧЕСКАЯ ОПТИМИЗАЦИЯ: Ограничиваем зону сканирования (ROI)
      const sourceWidth = videoElement.videoWidth
      const sourceHeight = videoElement.videoHeight
      
      // Вычисляем ROI - центральную область для сканирования
      const roiWidth = Math.floor(sourceWidth * this.ROI_SIZE_RATIO)
      const roiHeight = Math.floor(sourceHeight * this.ROI_SIZE_RATIO)
      const roiX = Math.floor((sourceWidth - roiWidth) * this.ROI_CENTER_RATIO)
      const roiY = Math.floor((sourceHeight - roiHeight) * this.ROI_CENTER_RATIO)
      
      // Устанавливаем размер canvas равным ROI
      canvas.width = roiWidth
      canvas.height = roiHeight
      
      this.log(`ROI оптимизация: исходный размер ${sourceWidth}x${sourceHeight}, ROI ${roiWidth}x${roiHeight} в позиции (${roiX}, ${roiY})`)
      
      // Рисуем только ROI область видео на canvas
      context.drawImage(
        videoElement,
        roiX, roiY, roiWidth, roiHeight, // Источник (ROI область)
        0, 0, roiWidth, roiHeight        // Назначение (весь canvas)
      )
      
      // ОПТИМИЗАЦИЯ: Фильтр повторяющихся кадров
      const currentFrameHash = this.calculateFrameHash(context, roiWidth, roiHeight)
      if (this.shouldSkipFrame(currentFrameHash)) {
        this.frameSkipCount++
        this.log(`Кадр пропущен (${this.frameSkipCount}/${this.MAX_FRAME_SKIPS}) - минимальные изменения`)
        return null
      }
      
      // Сбрасываем счетчик пропусков при обработке кадра
      this.frameSkipCount = 0
      this.lastFrameHash = currentFrameHash
      
      // Применяем предварительную обработку изображения
      this.enhanceImageForBarcode(context, roiWidth, roiHeight)
      
      // Создаем изображение из canvas
      const imageData = canvas.toDataURL('image/png')
      const image = new Image()
      
      return new Promise((resolve, reject) => {
        image.onload = async () => {
          try {
            this.log('ROI изображение загружено и обработано, начинаем декодирование...')
            const result = await this.reader.decodeFromImageElement(image)
            
            const scanResult: ScanResult = {
              text: result.getText(),
              format: result.getBarcodeFormat().toString(),
              timestamp: new Date()
            }
            
            this.log('Декодирование успешно:', scanResult)
            resolve(scanResult)
          } catch (decodeError) {
            // Не логируем NotFoundException как ошибку - это нормально
            if (decodeError instanceof Error && decodeError.name === 'NotFoundException') {
              this.log('Штрих-код не найден в ROI области')
            } else {
              this.logError('Ошибка декодирования:', decodeError)
            }
            resolve(null)
          }
        }
        
        image.onerror = () => {
          this.logError('Ошибка загрузки изображения')
          reject(new Error('Ошибка загрузки изображения'))
        }
        
        image.src = imageData
      })
      
    } catch (error) {
      this.logError('Ошибка захвата кадра:', error)
      return null
    }
  }

  /**
   * Вычисляет простой хеш кадра для определения изменений
   */
  private calculateFrameHash(context: CanvasRenderingContext2D, width: number, height: number): string {
    try {
      // Используем сэмплинг для быстрого вычисления хеша
      const sampleSize = 16 // 16x16 сетка для быстрого сравнения
      const stepX = Math.floor(width / sampleSize)
      const stepY = Math.floor(height / sampleSize)
      
      let hash = ''
      
      for (let y = 0; y < sampleSize; y++) {
        for (let x = 0; x < sampleSize; x++) {
          const pixelX = x * stepX
          const pixelY = y * stepY
          
          if (pixelX < width && pixelY < height) {
            const imageData = context.getImageData(pixelX, pixelY, 1, 1)
            const [r, g, b] = imageData.data
            
            // Конвертируем в оттенки серого и добавляем к хешу
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
            hash += gray.toString(16).padStart(2, '0')
          }
        }
      }
      
      return hash
    } catch (error) {
      this.logError('Ошибка вычисления хеша кадра:', error)
      return Date.now().toString() // Fallback - всегда разный хеш
    }
  }

  /**
   * Определяет, нужно ли пропустить кадр из-за минимальных изменений
   */
  private shouldSkipFrame(currentHash: string): boolean {
    // Если это первый кадр, не пропускаем
    if (!this.lastFrameHash) {
      return false
    }
    
    // Если достигли максимума пропусков, принудительно обрабатываем
    if (this.frameSkipCount >= this.MAX_FRAME_SKIPS) {
      this.log('Достигнут максимум пропусков кадров, принудительная обработка')
      return false
    }
    
    // Вычисляем процент различий между хешами
    const similarity = this.calculateHashSimilarity(this.lastFrameHash, currentHash)
    const changePercentage = 1 - similarity
    
    // Пропускаем кадр, если изменений меньше порога
    return changePercentage < this.FRAME_CHANGE_THRESHOLD
  }

  /**
   * Вычисляет схожесть между двумя хешами (0 = полностью разные, 1 = идентичные)
   */
  private calculateHashSimilarity(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) {
      return 0
    }
    
    let matches = 0
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] === hash2[i]) {
        matches++
      }
    }
    
    return matches / hash1.length
  }

  private setupVideoHealthMonitoring(
    videoElement: HTMLVideoElement,
    onError?: (error: Error) => void
  ): void {
    this.videoHealthInterval = setInterval(() => {
      if (!this.isScanning) return

      if (videoElement.readyState === 0 || videoElement.paused) {
        this.logError('Видеопоток прерван')
        if (onError) {
          onError(new Error('Видеопоток прерван'))
        }
      }
    }, 5000)
  }

  private createImageElement(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Ошибка загрузки изображения'))
        img.src = e.target?.result as string
      }
      
      reader.onerror = () => reject(new Error('Ошибка чтения файла'))
      reader.readAsDataURL(file)
    })
  }

  private enhanceImageForBarcode(context: CanvasRenderingContext2D, width: number, height: number): void {
    try {
      // Получаем данные изображения
      const imageData = context.getImageData(0, 0, width, height)
      const data = imageData.data
      
      // Применяем улучшения для лучшего распознавания штрих-кодов
      for (let i = 0; i < data.length; i += 4) {
        // Конвертируем в оттенки серого
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
        
        // Увеличиваем контрастность
        const contrast = 1.5
        const enhanced = Math.min(255, Math.max(0, (gray - 128) * contrast + 128))
        
        // Применяем бинаризацию для четкости
        const threshold = 128
        const binary = enhanced > threshold ? 255 : 0
        
        data[i] = binary     // R
        data[i + 1] = binary // G
        data[i + 2] = binary // B
        // data[i + 3] остается без изменений (альфа-канал)
      }
      
      // Записываем обработанные данные обратно
      context.putImageData(imageData, 0, 0)
      
      this.log('Предварительная обработка изображения завершена')
    } catch (error) {
      this.logError('Ошибка обработки изображения:', error)
      // Продолжаем без обработки в случае ошибки
    }
  }
}