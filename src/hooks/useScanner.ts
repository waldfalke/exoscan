/**
 * React хук для работы со сканером штрих-кодов
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  ScannerService, 
  ScanResult, 
  ScannerCapabilities, 
  CameraPermissionStatus,
  ScannerFactory,
  ScannerFactoryConfig 
} from '@/services/scanner'

export interface UseScannerOptions extends ScannerFactoryConfig {
  autoStart?: boolean
  autoScan?: boolean
  scanInterval?: number
  enableDiagnostics?: boolean
  onScanSuccess?: (result: ScanResult) => void
  onScanError?: (error: Error) => void
  onPermissionChange?: (status: CameraPermissionStatus) => void
}

export interface UseScannerReturn {
  // Состояние сканера
  isInitialized: boolean
  isScanning: boolean
  scanningActive: boolean
  error: Error | null
  capabilities: ScannerCapabilities | null
  permissionStatus: CameraPermissionStatus

  // Методы управления
  startScanning: (videoElement: HTMLVideoElement) => Promise<void>
  stopScanning: () => Promise<void>
  scanFromImage: (imageFile: File) => Promise<ScanResult>
  
  // Управление камерой
  switchCamera: () => Promise<void>
  toggleFlashlight: () => Promise<void>
  setZoom: (zoom: number) => Promise<void>
  getAvailableCameras: () => Promise<MediaDeviceInfo[]>
  getCameraPermissionStatus: () => Promise<CameraPermissionStatus>
  getCurrentCameraId: () => string | null
  setFlashlight: (enabled: boolean) => Promise<void>
  
  // Утилиты
  reinitialize: () => Promise<void>
  dispose: () => void
  
  // Состояние камеры
  flashlightEnabled: boolean
  zoom: number
  availableCameras: MediaDeviceInfo[]
  currentCameraId: string | null
}

export function useScanner(options: UseScannerOptions = {}): UseScannerReturn {
  const {
    autoStart = false,
    onScanSuccess,
    onScanError,
    onPermissionChange,
    ...scannerConfig
  } = options

  // Состояние
  const [isInitialized, setIsInitialized] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanningActive, setScanningActive] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [capabilities, setCapabilities] = useState<ScannerCapabilities | null>(null)
  const [permissionStatus, setPermissionStatus] = useState<CameraPermissionStatus>({
    granted: false,
    denied: false,
    prompt: true
  })
  const [flashlightEnabled, setFlashlightEnabled] = useState(false)
  const [zoom, setZoomState] = useState(1)
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null)

  // Ссылки
  const scannerRef = useRef<ScannerService | null>(null)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)

  // Инициализация сканера
  const initializeScanner = useCallback(async () => {
    try {
      setError(null)
      console.log('🔄 useScanner: Инициализация сканера...')

      const scanner = await ScannerFactory.createScanner(scannerConfig)
      scannerRef.current = scanner

      // Получаем возможности
      const caps = await scanner.getCapabilities()
      setCapabilities(caps)

      // Получаем доступные камеры
      const cameras = await scanner.getAvailableCameras()
      setAvailableCameras(cameras)

      // Проверяем разрешения
      const permission = await scanner.getCameraPermissionStatus()
      setPermissionStatus(permission)

      setIsInitialized(true)
      console.log('✅ useScanner: Сканер инициализирован', { caps, cameras, permission })

      // Автозапуск если включен
      if (autoStart && videoElementRef.current) {
        await startScanning(videoElementRef.current)
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Ошибка инициализации сканера')
      setError(error)
      onScanError?.(error)
      console.error('❌ useScanner: Ошибка инициализации:', error)
    }
  }, [scannerConfig, autoStart, onScanError])

  // Запуск сканирования
  const startScanning = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!scannerRef.current || !isInitialized) {
      throw new Error('Сканер не инициализирован')
    }

    try {
      setError(null)
      setIsScanning(true)
      videoElementRef.current = videoElement

      console.log('▶️ useScanner: Запуск сканирования...')
      console.log('🔍 useScanner: Диагностика перед запуском:', {
        scannerType: scannerRef.current.constructor.name,
        videoElement: {
          readyState: videoElement.readyState,
          videoWidth: videoElement.videoWidth,
          videoHeight: videoElement.videoHeight,
          srcObject: !!videoElement.srcObject,
          autoplay: videoElement.autoplay,
          muted: videoElement.muted,
          playsInline: videoElement.playsInline
        },
        capabilities,
        permissionStatus
      })

      await scannerRef.current.startScanning(
        videoElement,
        (result: ScanResult) => {
          setScanningActive(true)
          onScanSuccess?.(result)
          console.log('✅ useScanner: Успешное сканирование:', result)
        },
        (error: Error) => {
          setScanningActive(false)
          setError(error)
          onScanError?.(error)
          console.error('❌ useScanner: Ошибка сканирования:', error)
        }
      )

      // Обновляем состояние камеры
      const currentCamera = await scannerRef.current.getCurrentCameraId()
      setCurrentCameraId(currentCamera)

      console.log('✅ useScanner: Сканирование запущено успешно')

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Ошибка запуска сканирования')
      console.error('❌ useScanner: Детальная ошибка запуска:', {
        error: error.message,
        stack: error.stack,
        videoElement: {
          readyState: videoElement.readyState,
          srcObject: !!videoElement.srcObject
        }
      })
      setError(error)
      setIsScanning(false)
      onScanError?.(error)
      throw error
    }
  }, [isInitialized, onScanSuccess, onScanError, capabilities, permissionStatus])

  // Остановка сканирования
  const stopScanning = useCallback(async () => {
    if (!scannerRef.current) return

    try {
      console.log('⏹️ useScanner: Остановка сканирования...')
      await scannerRef.current.stopScanning()
      setIsScanning(false)
      setScanningActive(false)
      setFlashlightEnabled(false)
      setZoomState(1)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Ошибка остановки сканирования')
      setError(error)
      console.error('❌ useScanner: Ошибка остановки:', error)
    }
  }, [])

  // Сканирование из изображения
  const scanFromImage = useCallback(async (imageFile: File): Promise<ScanResult> => {
    if (!scannerRef.current || !isInitialized) {
      throw new Error('Сканер не инициализирован')
    }

    try {
      setError(null)
      console.log('📷 useScanner: Сканирование из изображения...', imageFile.name)
      
      const result = await scannerRef.current.scanFromImage(imageFile)
      console.log('✅ useScanner: Результат сканирования изображения:', result)
      
      onScanSuccess?.(result)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Ошибка сканирования изображения')
      setError(error)
      onScanError?.(error)
      throw error
    }
  }, [isInitialized, onScanSuccess, onScanError])

  // Переключение камеры
  const switchCamera = useCallback(async () => {
    if (!scannerRef.current || !isScanning) return

    try {
      await scannerRef.current.switchCamera()
      const newCameraId = await scannerRef.current.getCurrentCameraId()
      setCurrentCameraId(newCameraId)
      console.log('🔄 useScanner: Камера переключена на:', newCameraId)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Ошибка переключения камеры')
      setError(error)
      console.error('❌ useScanner: Ошибка переключения камеры:', error)
    }
  }, [isScanning])

  // Переключение фонарика
  const toggleFlashlight = useCallback(async () => {
    if (!scannerRef.current || !isScanning) return

    try {
      const newState = !flashlightEnabled
      await scannerRef.current.setFlashlight(newState)
      setFlashlightEnabled(newState)
      console.log('🔦 useScanner: Фонарик:', newState ? 'включен' : 'выключен')
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Ошибка управления фонариком')
      setError(error)
      console.error('❌ useScanner: Ошибка фонарика:', error)
    }
  }, [flashlightEnabled, isScanning])

  // Установка зума
  const setZoom = useCallback(async (newZoom: number) => {
    if (!scannerRef.current || !isScanning) {
      console.log('⚠️ useScanner: Зум недоступен - сканер не готов')
      return
    }

    // Проверяем поддержку зума
    if (!capabilities?.zoom?.supported) {
      console.log('⚠️ useScanner: Зум не поддерживается камерой')
      return
    }

    try {
      await scannerRef.current.setZoom(newZoom)
      setZoomState(newZoom)
      console.log('🔍 useScanner: Зум установлен:', newZoom)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Ошибка установки зума')
      // Не устанавливаем error в состояние для зума - это не критично
      console.warn('⚠️ useScanner: Зум не поддерживается:', error.message)
    }
  }, [isScanning, capabilities])

  // Получение доступных камер
  const getAvailableCameras = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    if (!scannerRef.current) {
      throw new Error('Сканер не инициализирован')
    }
    
    try {
      const cameras = await scannerRef.current.getAvailableCameras()
      setAvailableCameras(cameras)
      return cameras
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Ошибка получения камер')
      setError(error)
      throw error
    }
  }, [])

  // Получение статуса разрешений камеры
  const getCameraPermissionStatus = useCallback(async (): Promise<CameraPermissionStatus> => {
    if (!scannerRef.current) {
      throw new Error('Сканер не инициализирован')
    }
    
    try {
      const status = await scannerRef.current.getCameraPermissionStatus()
      setPermissionStatus(status)
      return status
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Ошибка получения статуса разрешений')
      setError(error)
      throw error
    }
  }, [])

  // Получение ID текущей камеры
  const getCurrentCameraId = useCallback((): string | null => {
    if (!scannerRef.current) {
      return null
    }
    
    return scannerRef.current.getCurrentCameraId()
  }, [])

  // Установка состояния фонарика
  const setFlashlight = useCallback(async (enabled: boolean): Promise<void> => {
    if (!scannerRef.current || !isScanning) {
      throw new Error('Сканер не активен')
    }

    try {
      await scannerRef.current.setFlashlight(enabled)
      setFlashlightEnabled(enabled)
      console.log('🔦 useScanner: Фонарик установлен:', enabled)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Ошибка установки фонарика')
      setError(error)
      throw error
    }
  }, [isScanning])

  // Переинициализация
  const reinitialize = useCallback(async () => {
    if (scannerRef.current) {
      await stopScanning()
      scannerRef.current.dispose()
      scannerRef.current = null
    }
    
    setIsInitialized(false)
    setError(null)
    await initializeScanner()
  }, [stopScanning, initializeScanner])

  // Освобождение ресурсов
  const dispose = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.dispose()
      scannerRef.current = null
    }
    
    setIsInitialized(false)
    setIsScanning(false)
    setScanningActive(false)
    setError(null)
    setCapabilities(null)
    setFlashlightEnabled(false)
    setZoomState(1)
    setAvailableCameras([])
    setCurrentCameraId(null)
    
    console.log('🗑️ useScanner: Ресурсы освобождены')
  }, [])

  // Инициализация при монтировании
  useEffect(() => {
    console.log('🚀 useScanner: Запуск автоинициализации...')
    initializeScanner().catch(err => {
      console.error('❌ useScanner: Ошибка автоинициализации:', err)
    })
    
    return () => {
      console.log('🧹 useScanner: Очистка при размонтировании')
      if (scannerRef.current) {
        scannerRef.current.dispose()
        scannerRef.current = null
      }
    }
  }, []) // Только при монтировании, без зависимостей

  // Отслеживание изменений разрешений
  useEffect(() => {
    if (onPermissionChange) {
      onPermissionChange(permissionStatus)
    }
  }, [permissionStatus, onPermissionChange])

  return {
    // Состояние
    isInitialized,
    isScanning,
    scanningActive,
    error,
    capabilities,
    permissionStatus,
    
    // Методы управления
    startScanning,
    stopScanning,
    scanFromImage,
    
    // Управление камерой
    switchCamera,
    toggleFlashlight,
    setZoom,
    getAvailableCameras,
    getCameraPermissionStatus,
    getCurrentCameraId,
    setFlashlight,
    
    // Утилиты
    reinitialize,
    dispose,
    
    // Состояние камеры
    flashlightEnabled,
    zoom,
    availableCameras,
    currentCameraId
  }
}