import { BrowserMultiFormatReader, Result } from '@zxing/library'

// Type for navigator with mediaDevices support
interface NavigatorWithMediaDevices extends Navigator {
  mediaDevices: MediaDevices
}

// Extended MediaTrackSettings interface to include torch property
interface ExtendedMediaTrackSettings extends MediaTrackSettings {
  torch?: boolean
}

// Extended MediaTrackConstraints interface to include torch property
interface ExtendedMediaTrackConstraints extends MediaTrackConstraints {
  torch?: boolean
}

export interface ScanResult {
  text: string
  format: string
  timestamp: Date
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

export class BarcodeScanner {
  private reader: BrowserMultiFormatReader
  private isScanning: boolean = false
  private currentStream: MediaStream | null = null
  private flashlightTrack: MediaStreamTrack | null = null

  constructor() {
    this.reader = new BrowserMultiFormatReader()
  }

  // Check if camera API is supported
  static isCameraSupported(): boolean {
    return !!(typeof navigator !== 'undefined' && (navigator as NavigatorWithMediaDevices).mediaDevices)
  }

  // Check if HTTPS is being used (required for camera on mobile)
  static isSecureContext(): boolean {
    return window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost'
  }

  // Check flashlight/torch support
  async checkFlashlightSupport(stream?: MediaStream): Promise<FlashlightCapabilities> {
    try {
      const targetStream = stream || this.currentStream
      if (!targetStream) {
        return { supported: false, enabled: false }
      }

      const videoTrack = targetStream.getVideoTracks()[0]
      if (!videoTrack) {
        return { supported: false, enabled: false }
      }

      const capabilities = videoTrack.getCapabilities()
      const settings = videoTrack.getSettings()
      
      // Check if torch is supported
      const torchSupported = 'torch' in capabilities
      const currentTorchState = 'torch' in settings ? Boolean((settings as ExtendedMediaTrackSettings).torch) : false

      if (torchSupported) {
        this.flashlightTrack = videoTrack
      }

      return {
        supported: torchSupported,
        enabled: currentTorchState,
        track: torchSupported ? videoTrack : undefined
      }
    } catch (error) {
      console.warn('Failed to check flashlight support:', error)
      return { supported: false, enabled: false }
    }
  }

  // Toggle flashlight/torch
  async toggleFlashlight(enable?: boolean): Promise<boolean> {
    try {
      if (!this.flashlightTrack) {
        console.warn('Flashlight track not available')
        return false
      }

      const capabilities = this.flashlightTrack.getCapabilities()
      if (!('torch' in capabilities)) {
        console.warn('Torch not supported on this device')
        return false
      }

      const settings = this.flashlightTrack.getSettings()
      const currentState = 'torch' in settings ? (settings as ExtendedMediaTrackSettings).torch : false
      const newState = enable !== undefined ? enable : !currentState

      await this.flashlightTrack.applyConstraints({
        advanced: [{ torch: newState } as ExtendedMediaTrackConstraints]
      })

      console.log(`Flashlight ${newState ? 'enabled' : 'disabled'}`)
      return newState
    } catch (error) {
      console.error('Failed to toggle flashlight:', error)
      return false
    }
  }

  // Get optimal camera constraints for scanning
  private getOptimalCameraConstraints(deviceId?: string, isMobile: boolean = false): MediaStreamConstraints {
    // Use more flexible constraints for desktop cameras
    const baseConstraints: MediaStreamConstraints = {
      video: {
        deviceId: deviceId ? { ideal: deviceId } : undefined,
        facingMode: deviceId ? undefined : { ideal: 'environment' },
        
        // More flexible resolution constraints for desktop compatibility
        width: isMobile 
          ? { ideal: 1920, min: 640 }
          : { ideal: 1920, min: 640 },
        height: isMobile 
          ? { ideal: 1080, min: 480 }
          : { ideal: 1080, min: 480 },
        
        // Flexible frame rate
        frameRate: { ideal: 30 }
      }
    }

    return baseConstraints
  }

  // Fallback constraints for when optimal constraints fail
  private getBasicCameraConstraints(deviceId?: string): MediaStreamConstraints {
    return {
      video: {
        deviceId: deviceId ? { ideal: deviceId } : undefined,
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 }
      }
    }
  }

  // Minimal constraints as last resort
  private getMinimalCameraConstraints(deviceId?: string): MediaStreamConstraints {
    return {
      video: deviceId ? { deviceId: { ideal: deviceId } } : true
    }
  }

  // Check camera permissions
  async checkCameraPermission(): Promise<CameraPermissionStatus> {
    if (!BarcodeScanner.isCameraSupported()) {
      return {
        granted: false,
        denied: true,
        prompt: false,
        error: 'Camera API not supported in this browser'
      }
    }

    if (!BarcodeScanner.isSecureContext()) {
      return {
        granted: false,
        denied: true,
        prompt: false,
        error: 'HTTPS required for camera access on mobile devices'
      }
    }

    try {
      // Check permission status if available
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName })
        return {
          granted: permission.state === 'granted',
          denied: permission.state === 'denied',
          prompt: permission.state === 'prompt'
        }
      }

      // Fallback: try to access camera briefly
      if (typeof navigator !== 'undefined' && (navigator as NavigatorWithMediaDevices).mediaDevices) {
        try {
          const stream = await (navigator as NavigatorWithMediaDevices).mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          })
          stream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
          return { granted: true, denied: false, prompt: false }
        } catch (error) {
          const err = error as Error
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            return { granted: false, denied: true, prompt: false, error: 'Camera permission denied' }
          }
          return { granted: false, denied: false, prompt: true, error: err.message }
        }
      }
      
      // If mediaDevices is not available, return unknown state
      return { granted: false, denied: false, prompt: true, error: 'Camera API not available' }
    } catch (error) {
      return {
        granted: false,
        denied: false,
        prompt: true,
        error: (error as Error).message
      }
    }
  }

  // Request camera permission explicitly
  async requestCameraPermission(): Promise<boolean> {
    try {
      if (typeof navigator === 'undefined' || !(navigator as NavigatorWithMediaDevices).mediaDevices) {
        console.error('❌ MediaDevices API не поддерживается')
        return false
      }

      console.log('📱 Запрос разрешения камеры для мобильного устройства...')
      
      // Try with environment camera first (back camera)
      try {
        const stream = await (navigator as NavigatorWithMediaDevices).mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280, min: 640, max: 1920 },
            height: { ideal: 720, min: 480, max: 1080 },
            frameRate: { ideal: 30, min: 15, max: 60 }
          }
        })
        
        console.log('✅ Разрешение получено для задней камеры')
        // Stop the stream immediately, we just wanted permission
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
        return true
      } catch (envError) {
        console.warn('⚠️ Задняя камера недоступна, пробуем переднюю:', envError)
        
        // Fallback to user camera (front camera)
        const stream = await (navigator as NavigatorWithMediaDevices).mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280, min: 640, max: 1920 },
            height: { ideal: 720, min: 480, max: 1080 },
            frameRate: { ideal: 30, min: 15, max: 60 }
          }
        })
        
        console.log('✅ Разрешение получено для передней камеры')
        // Stop the stream immediately, we just wanted permission
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
        return true
      }
    } catch (error) {
      console.error('❌ Ошибка запроса разрешения камеры:', error)
      const err = error as Error
      if (err.name === 'NotAllowedError') {
        console.error('❌ Пользователь отклонил доступ к камере')
      } else if (err.name === 'NotFoundError') {
        console.error('❌ Камера не найдена на устройстве')
      } else if (err.name === 'NotReadableError') {
        console.error('❌ Камера уже используется другим приложением')
      } else if (err.name === 'OverconstrainedError') {
        console.error('❌ Запрошенные параметры камеры не поддерживаются')
      }
      return false
    }
  }

  async startScanning(
    videoElement: HTMLVideoElement,
    onResult: (result: ScanResult) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    if (this.isScanning) {
      throw new Error('Scanner is already running')
    }

    try {
      this.isScanning = true
      console.log('📱 BarcodeScanner: Начинаем процесс сканирования')
      console.log('🔍 Информация о браузере:', {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine
      })

      // Check camera support and permissions first
      console.log('🔐 Проверка разрешений камеры...')
      const permissionStatus = await this.checkCameraPermission()
      console.log('🔐 Статус разрешений:', permissionStatus)
      
      if (!permissionStatus.granted) {
        if (permissionStatus.denied) {
          console.error('❌ Разрешение камеры отклонено:', permissionStatus.error)
          throw new Error(permissionStatus.error || 'Camera permission denied. Please enable camera access in your browser settings.')
        }
        
        // Try to request permission
        console.log('🔄 Запрос разрешения камеры...')
        const granted = await this.requestCameraPermission()
        if (!granted) {
          console.error('❌ Разрешение камеры не получено')
          throw new Error('Camera permission is required for scanning. Please allow camera access and try again.')
        }
        console.log('✅ Разрешение камеры получено')
      }

      // Check MediaDevices API availability
      if (!navigator.mediaDevices) {
        console.error('❌ MediaDevices API недоступен')
        throw new Error('MediaDevices API not available')
      }
      console.log('✅ MediaDevices API: OK')

      // Check getUserMedia availability
      if (!navigator.mediaDevices.getUserMedia) {
        console.error('❌ getUserMedia недоступен')
        throw new Error('getUserMedia not available')
      }
      console.log('✅ getUserMedia: OK')

      // Get available video devices
      console.log('📹 Поиск доступных камер...')
      const videoInputDevices = await this.reader.listVideoInputDevices()
      console.log('📹 Найдено камер:', videoInputDevices.length, videoInputDevices.map(d => ({
        id: d.deviceId,
        label: d.label,
        kind: d.kind
      })))
      
      if (videoInputDevices.length === 0) {
        console.error('❌ Камеры не найдены')
        throw new Error('No cameras found on this device')
      }

      // Prefer back camera for mobile devices (main camera only)
      const backCamera = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back') ||
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment') ||
        device.label.toLowerCase().includes('main')
      )
      
      const selectedDevice = backCamera || videoInputDevices[0]
      console.log('📷 Выбранная камера:', selectedDevice.label, backCamera ? '(основная)' : '(первая доступная)')

      // Detect mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      console.log('📱 Мобильное устройство:', isMobile)

      // Get optimal camera constraints
      const constraints = this.getOptimalCameraConstraints(selectedDevice.deviceId, isMobile)
      console.log('🎥 Настройки камеры:', constraints)

      // Start continuous decoding using decodeFromConstraints for proper continuous scanning
      console.log('🔍 Запуск непрерывного декодирования штрих-кодов...')
      
      // Clear any existing stream first
      console.log('🧹 Очистка существующего потока...')
      videoElement.srcObject = null
      
      // Check video element state
      console.log('📺 Состояние видео элемента:', {
        readyState: videoElement.readyState,
        videoWidth: videoElement.videoWidth,
        videoHeight: videoElement.videoHeight,
        paused: videoElement.paused,
        ended: videoElement.ended,
        muted: videoElement.muted,
        autoplay: videoElement.autoplay,
        playsInline: videoElement.playsInline
      })
      
      // Use decodeFromConstraints for continuous scanning with fallback logic
      console.log('🔄 Запуск декодирования с ограничениями...')
      
      const resultCallback = (result: Result) => {
        if (this.isScanning && result) { // Only process if still scanning and result is not null
          try {
            const text = result.getText()
            const format = result.getBarcodeFormat()
            
            if (text && format) {
              console.log('🎯 Штрих-код найден:', text, format.toString())
              const scanResult: ScanResult = {
                text: text,
                format: format.toString(),
                timestamp: new Date()
              }
              onResult(scanResult)
            }
          } catch (resultError) {
            console.warn('⚠️ Ошибка обработки результата сканирования:', resultError)
            if (onError) {
              onError(new Error(`Ошибка обработки результата: ${(resultError as Error).message}`))
            }
            // Continue scanning, don't stop on individual result processing errors
          }
        }
      }

      // Try different constraint levels with fallback
      let constraintsToTry = [
        { name: 'optimal', constraints },
        { name: 'basic', constraints: this.getBasicCameraConstraints(selectedDevice.deviceId) },
        { name: 'minimal', constraints: this.getMinimalCameraConstraints(selectedDevice.deviceId) }
      ]

      let lastError: Error | null = null
      
      for (const { name, constraints: currentConstraints } of constraintsToTry) {
        try {
          console.log(`🔄 Попытка запуска с ${name} ограничениями:`, currentConstraints)
          
          await this.reader.decodeFromConstraints(
            currentConstraints,
            videoElement,
            resultCallback
          )
          
          console.log(`✅ Декодирование запущено успешно с ${name} ограничениями`)
          
          // Check video element state after decoding starts
          setTimeout(() => {
            console.log('📺 Состояние видео элемента после запуска:', {
              readyState: videoElement.readyState,
              videoWidth: videoElement.videoWidth,
              videoHeight: videoElement.videoHeight,
              paused: videoElement.paused,
              ended: videoElement.ended,
              srcObject: videoElement.srcObject ? 'установлен' : 'не установлен'
            })
            
            if (videoElement.srcObject) {
              const stream = videoElement.srcObject as MediaStream
              this.currentStream = stream
              console.log('📡 Информация о потоке:', {
                active: stream.active,
                id: stream.id,
                tracks: stream.getTracks().map(track => ({
                  kind: track.kind,
                  label: track.label,
                  enabled: track.enabled,
                  readyState: track.readyState,
                  muted: track.muted
                }))
              })
            }
          }, 1000)
          
          // Success - break out of the loop
          break
          
        } catch (decodeError) {
          console.warn(`⚠️ Ошибка при запуске декодирования с ${name} ограничениями:`, decodeError)
          lastError = decodeError as Error
          
          // If this is an OverconstrainedError and we have more constraints to try, continue
          if ((decodeError as Error).name === 'OverconstrainedError' && name !== 'minimal') {
            console.log(`🔄 Пробуем следующий уровень ограничений...`)
            continue
          }
          
          // If this is the last attempt or a different error, throw
          if (name === 'minimal' || (decodeError as Error).name !== 'OverconstrainedError') {
            console.error('❌ Все попытки запуска декодирования неудачны')
            if (onError) {
              onError(new Error(`Ошибка декодирования: ${(decodeError as Error).message}`))
            }
            throw decodeError
          }
        }
      }
      
      console.log('✅ Непрерывное сканирование запущено')
      
    } catch (error) {
      console.error('❌ Критическая ошибка при запуске сканирования:', error)
      this.isScanning = false
      this.stopCurrentStream()
      
      const errorMessage = this.getErrorMessage(error as Error)
      console.error('❌ Обработанная ошибка:', errorMessage)
      const enhancedError = new Error(errorMessage)
      
      if (onError) {
        onError(enhancedError)
      }
      throw enhancedError
    }
  }

  private getErrorMessage(error: Error): string {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Camera access denied. Please enable camera permissions in your browser settings and refresh the page.'
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No camera found on this device.'
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Camera is already in use by another application. Please close other apps using the camera and try again.'
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return 'Camera does not support the required settings. Try using a different camera.'
      case 'NotSupportedError':
        return 'Camera is not supported on this device or browser.'
      case 'AbortError':
        return 'Camera access was interrupted.'
      case 'SecurityError':
        return 'Camera access blocked due to security restrictions. Make sure you are using HTTPS.'
      default:
        return error.message || 'Failed to access camera. Please check your device settings and try again.'
    }
  }

  private stopCurrentStream(): void {
    try {
      // Stop all tracks from the current stream if it exists
      if (this.currentStream) {
        this.currentStream.getTracks().forEach(track => {
          track.stop()
          console.log('🛑 Остановлен трек камеры:', track.kind)
        })
        this.currentStream = null
      }
    } catch (error) {
      console.error('❌ Ошибка при остановке потока:', error)
    }
  }

  async scanFromImage(imageFile: File): Promise<ScanResult> {
    try {
      // Validate file type
      if (!imageFile.type.startsWith('image/')) {
        throw new Error('Please select a valid image file')
      }

      // Check file size (limit to 10MB)
      if (imageFile.size > 10 * 1024 * 1024) {
        throw new Error('Image file is too large. Please select an image smaller than 10MB')
      }

      const result = await this.reader.decodeFromImageElement(
        await this.createImageElement(imageFile)
      )

      if (!result) {
        throw new Error('No barcode or QR code found in the image. Please try a clearer image.')
      }

      const text = result.getText()
      const format = result.getBarcodeFormat()

      if (!text || !format) {
        throw new Error('Invalid barcode data found. Please try a different image.')
      }

      return {
        text: text,
        format: format.toString(),
        timestamp: new Date()
      }
    } catch (error) {
      const err = error as Error
      if (err.message.includes('No MultiFormat Readers')) {
        throw new Error('No barcode or QR code found in the image. Please try a clearer image.')
      }
      throw new Error(`Failed to scan image: ${err.message}`)
    }
  }

  private createImageElement(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img)
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load image'))
      }
      
      img.src = url
    })
  }

  stopScanning(): void {
    if (this.isScanning) {
      console.log('🛑 Остановка сканирования...')
      this.isScanning = false
      this.reader.reset()
      this.stopCurrentStream()
      console.log('✅ Сканирование остановлено')
    }
  }

  isCurrentlyScanning(): boolean {
    return this.isScanning
  }

  async getVideoDevices(): Promise<MediaDeviceInfo[]> {
    try {
        if (typeof navigator === 'undefined' || !(navigator as NavigatorWithMediaDevices).mediaDevices) {
          return []
        }

        // Check permissions first
        const permissionStatus = await this.checkCameraPermission()
        if (!permissionStatus.granted && permissionStatus.denied) {
          console.warn('Camera permission denied, cannot enumerate devices')
          return []
        }

        const devices = await (navigator as NavigatorWithMediaDevices).mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(device => device.kind === 'videoinput')
        
        // If no labels are available, request permission to get device labels
        if (videoDevices.length > 0 && !videoDevices[0].label) {
          try {
            const stream = await (navigator as NavigatorWithMediaDevices).mediaDevices.getUserMedia({ video: true })
            stream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
            // Re-enumerate to get labels
            const devicesWithLabels = await (navigator as NavigatorWithMediaDevices).mediaDevices.enumerateDevices()
            return devicesWithLabels.filter(device => device.kind === 'videoinput')
          } catch (error) {
            console.warn('Could not get device labels:', error)
          }
        }
      
      return videoDevices
    } catch (error) {
      console.error('Error getting video devices:', error)
      return []
    }
  }

  // Get diagnostic information for troubleshooting
  async getDiagnosticInfo(): Promise<{
    cameraSupported: boolean
    secureContext: boolean
    permissionStatus: CameraPermissionStatus
    videoDevices: MediaDeviceInfo[]
    userAgent: string
    platform: string
  }> {
    const permissionStatus = await this.checkCameraPermission()
    const videoDevices = await this.getVideoDevices()

    return {
      cameraSupported: BarcodeScanner.isCameraSupported(),
      secureContext: BarcodeScanner.isSecureContext(),
      permissionStatus,
      videoDevices,
      userAgent: navigator.userAgent,
      platform: navigator.platform
    }
  }
}

// Export a singleton instance
export const barcodeScanner = new BarcodeScanner()