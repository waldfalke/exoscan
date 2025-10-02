/**
 * Константы для поддерживаемых форматов штрих-кодов товаров
 * 
 * Система поддерживает только штрих-коды товаров и исключает QR коды
 * в соответствии с требованиями системного контракта ExoScan v1.0
 * 
 * @see ExoScan_System_Contract_v1.0.md - Раздел "Сканирование и валидация"
 */

/**
 * Стандартные форматы штрих-кодов товаров
 * Используются для валидации и отображения в UI
 */
export const PRODUCT_BARCODE_FORMATS = Object.freeze([
  'EAN-13',      // EAN-13 - основной международный формат для товаров
  'EAN-8',       // EAN-8 - короткий формат EAN для малых товаров
  'UPC-A',       // UPC-A - американский универсальный код товара
  'Code-128',    // Code-128 - универсальный линейный формат
] as const);

/**
 * Форматы для BarcodeDetector API (нативный браузерный API)
 * Используют lowercase с подчеркиваниями
 */
export const BARCODE_DETECTOR_FORMATS = [
  'ean_13',      // EAN-13 для BarcodeDetector API
  'ean_8',       // EAN-8 для BarcodeDetector API
  'upc_a',       // UPC-A для BarcodeDetector API
  'code_128',    // Code-128 для BarcodeDetector API
] as const;

/**
 * Форматы для ZXing библиотеки
 * Используют UPPERCASE с подчеркиваниями
 */
export const ZXING_FORMATS = [
  'EAN_13',      // EAN-13 для ZXing библиотеки
  'EAN_8',       // EAN-8 для ZXing библиотеки
  'UPC_A',       // UPC-A для ZXing библиотеки
  'CODE_128',    // Code-128 для ZXing библиотеки
] as const;

/**
 * Маппинг между стандартными форматами и форматами BarcodeDetector API
 */
export const PRODUCT_TO_DETECTOR_FORMAT_MAP = {
  'EAN-13': 'ean_13',
  'EAN-8': 'ean_8',
  'UPC-A': 'upc_a',
  'Code-128': 'code_128',
} as const;

/**
 * Маппинг между стандартными форматами и форматами ZXing
 */
export const PRODUCT_TO_ZXING_FORMAT_MAP = {
  'EAN-13': 'EAN_13',
  'EAN-8': 'EAN_8',
  'UPC-A': 'UPC_A',
  'Code-128': 'CODE_128',
} as const;

/**
 * Обратный маппинг от ZXing форматов к стандартным
 */
export const ZXING_TO_PRODUCT_FORMAT_MAP = {
  'EAN_13': 'EAN-13',
  'EAN_8': 'EAN-8',
  'UPC_A': 'UPC-A',
  'CODE_128': 'Code-128',
} as const;

/**
 * Обратный маппинг от BarcodeDetector форматов к стандартным
 */
export const DETECTOR_TO_PRODUCT_FORMAT_MAP = {
  'ean_13': 'EAN-13',
  'ean_8': 'EAN-8',
  'upc_a': 'UPC-A',
  'code_128': 'Code-128',
} as const;

// Type definitions
export type ProductBarcodeFormat = typeof PRODUCT_BARCODE_FORMATS[number];
export type BarcodeDetectorFormat = typeof BARCODE_DETECTOR_FORMATS[number];
export type ZXingFormat = typeof ZXING_FORMATS[number];

/**
 * Утилитарные функции для конвертации форматов
 */
export const BarcodeFormatUtils = {
  /**
   * Конвертирует стандартный формат в формат BarcodeDetector API
   */
  toDetectorFormat(format: ProductBarcodeFormat): BarcodeDetectorFormat {
    return PRODUCT_TO_DETECTOR_FORMAT_MAP[format];
  },

  /**
   * Конвертирует стандартный формат в формат ZXing
   */
  toZXingFormat(format: ProductBarcodeFormat): ZXingFormat {
    return PRODUCT_TO_ZXING_FORMAT_MAP[format];
  },

  /**
   * Конвертирует формат ZXing в стандартный формат
   */
  fromZXingFormat(format: ZXingFormat): ProductBarcodeFormat {
    return ZXING_TO_PRODUCT_FORMAT_MAP[format];
  },

  /**
   * Конвертирует формат BarcodeDetector в стандартный формат
   */
  fromDetectorFormat(format: BarcodeDetectorFormat): ProductBarcodeFormat {
    return DETECTOR_TO_PRODUCT_FORMAT_MAP[format];
  },

  /**
   * Проверяет, является ли формат поддерживаемым штрих-кодом товара
   */
  isProductBarcodeFormat(format: string): format is ProductBarcodeFormat {
    return PRODUCT_BARCODE_FORMATS.includes(format as ProductBarcodeFormat);
  },

  /**
   * Проверяет, что формат НЕ является QR кодом
   */
  isNotQRCode(format: string): boolean {
    const qrFormats = ['QR', 'QR_CODE', 'qr_code', 'qr', 'QR-Code'];
    return !qrFormats.includes(format);
  }
} as const;