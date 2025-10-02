/**
 * Фабрика сканеров - автоматически выбирает лучшую доступную реализацию
 */

import { ScannerService, ScannerConfig } from './ScannerService'
import { ZXingScannerService } from './ZXingScannerService'
import { BarcodeDetectorService } from './BarcodeDetectorService'

export * from './ScannerService'
export * from './ZXingScannerService'
export * from './BarcodeDetectorService'

export type ScannerType = 'auto' | 'zxing' | 'barcode-detector'

export interface ScannerFactoryConfig extends ScannerConfig {
  preferredType?: ScannerType
  fallbackToZXing?: boolean
}

export class ScannerFactory {
  /**
   * Создает экземпляр сканера на основе доступности API и предпочтений
   */
  static async createScanner(config: ScannerFactoryConfig = {}): Promise<ScannerService> {
    const {
      preferredType = 'auto',
      fallbackToZXing = true,
      ...scannerConfig
    } = config

    // Включаем диагностику для отладки если не указано иное
    const finalConfig = {
      ...scannerConfig,
      enableDiagnostics: scannerConfig.enableDiagnostics ?? true
    }

    console.log('🏭 ScannerFactory: Создание сканера...', {
      preferredType,
      fallbackToZXing,
      config: finalConfig
    })

    // Если указан конкретный тип
    if (preferredType !== 'auto') {
      return await ScannerFactory.createSpecificScanner(preferredType, finalConfig)
    }

    // Автоматический выбор лучшего доступного сканера
    return await ScannerFactory.createBestAvailableScanner(finalConfig, fallbackToZXing)
  }

  /**
   * Создает сканер определенного типа
   */
  private static async createSpecificScanner(
    type: Exclude<ScannerType, 'auto'>,
    config: ScannerConfig
  ): Promise<ScannerService> {
    switch (type) {
      case 'barcode-detector':
        if (!BarcodeDetectorService.isSupported()) {
          throw new Error('BarcodeDetector API не поддерживается в этом браузере')
        }
        const barcodeDetectorService = new BarcodeDetectorService(config)
        await barcodeDetectorService.initialize()
        console.log('✅ ScannerFactory: Создан BarcodeDetectorService')
        return barcodeDetectorService

      case 'zxing':
        const zxingService = new ZXingScannerService(config)
        await zxingService.initialize()
        console.log('✅ ScannerFactory: Создан ZXingScannerService')
        return zxingService

      default:
        throw new Error(`Неизвестный тип сканера: ${type}`)
    }
  }

  /**
   * Автоматически выбирает лучший доступный сканер
   */
  private static async createBestAvailableScanner(
    config: ScannerConfig,
    fallbackToZXing: boolean
  ): Promise<ScannerService> {
    console.log('🔍 ScannerFactory: Автоматический выбор сканера...')

    // Проверяем доступность различных API
    const availability = await ScannerFactory.checkAvailability()
    console.log('📊 ScannerFactory: Доступность API:', availability)

    // Приоритет: BarcodeDetector > ZXing
    if (availability.barcodeDetector) {
      try {
        console.log('🎯 ScannerFactory: Выбран BarcodeDetector (нативный API)')
        const service = new BarcodeDetectorService(config)
        await service.initialize()
        return service
      } catch (error) {
        console.warn('⚠️ ScannerFactory: Ошибка инициализации BarcodeDetector:', error)
        if (!fallbackToZXing) {
          throw error
        }
      }
    }

    // Fallback к ZXing
    if (fallbackToZXing) {
      console.log('🔄 ScannerFactory: Fallback к ZXing')
      const service = new ZXingScannerService(config)
      await service.initialize()
      return service
    }

    throw new Error('Ни один сканер не доступен')
  }

  /**
   * Проверяет доступность различных API сканирования
   */
  static async checkAvailability(): Promise<{
    barcodeDetector: boolean
    zxing: boolean
    camera: boolean
    secureContext: boolean
  }> {
    return {
      barcodeDetector: BarcodeDetectorService.isSupported(),
      zxing: true, // ZXing всегда доступен
      camera: ScannerService.isCameraSupported(),
      secureContext: ScannerService.isSecureContext()
    }
  }

  /**
   * Получает информацию о возможностях различных сканеров
   */
  static async getScannerCapabilities(): Promise<{
    barcodeDetector?: {
      supported: boolean
      formats?: string[]
    }
    zxing: {
      supported: boolean
      formats: string[]
    }
  }> {
    const result: any = {
      zxing: {
        supported: true,
        formats: [
          'QR_CODE', 'DATA_MATRIX', 'UPC_E', 'UPC_A', 'EAN_8', 'EAN_13',
          'CODE_128', 'CODE_39', 'CODE_93', 'CODABAR', 'ITF', 'RSS14',
          'RSS_EXPANDED', 'PDF_417', 'AZTEC', 'MAXICODE'
        ]
      }
    }

    if (BarcodeDetectorService.isSupported()) {
      try {
        const formats = await window.BarcodeDetector!.getSupportedFormats()
        result.barcodeDetector = {
          supported: true,
          formats
        }
      } catch (error) {
        result.barcodeDetector = {
          supported: false
        }
      }
    } else {
      result.barcodeDetector = {
        supported: false
      }
    }

    return result
  }

  /**
   * Создает рекомендуемый сканер для производственного использования
   */
  static async createProductionScanner(config: ScannerConfig = {}): Promise<ScannerService> {
    return await ScannerFactory.createScanner({
      ...config,
      preferredType: 'auto',
      fallbackToZXing: true,
      enableDiagnostics: false // Отключаем диагностику в продакшене
    })
  }

  /**
   * Создает сканер для разработки с расширенной диагностикой
   */
  static async createDevelopmentScanner(config: ScannerConfig = {}): Promise<ScannerService> {
    return await ScannerFactory.createScanner({
      ...config,
      preferredType: 'auto',
      fallbackToZXing: true,
      enableDiagnostics: true,
      scanInterval: 200 // Более частое сканирование для отладки
    })
  }
}

// Экспортируем готовый экземпляр для быстрого использования
let defaultScannerInstance: ScannerService | null = null

/**
 * Получает глобальный экземпляр сканера (ленивая инициализация)
 */
export async function getDefaultScanner(): Promise<ScannerService> {
  if (!defaultScannerInstance) {
    defaultScannerInstance = await ScannerFactory.createProductionScanner()
  }
  return defaultScannerInstance
}

/**
 * Сбрасывает глобальный экземпляр сканера
 */
export function resetDefaultScanner(): void {
  if (defaultScannerInstance) {
    defaultScannerInstance.dispose()
    defaultScannerInstance = null
  }
}