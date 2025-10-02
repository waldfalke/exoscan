import { 
  PRODUCT_BARCODE_FORMATS, 
  BARCODE_DETECTOR_FORMATS, 
  ZXING_FORMATS,
  PRODUCT_TO_DETECTOR_FORMAT_MAP,
  PRODUCT_TO_ZXING_FORMAT_MAP,
  ZXING_TO_PRODUCT_FORMAT_MAP,
  DETECTOR_TO_PRODUCT_FORMAT_MAP,
  BarcodeFormatUtils,
  type ProductBarcodeFormat,
  type BarcodeDetectorFormat,
  type ZXingFormat
} from '../barcodeFormats'

describe('Barcode Formats Configuration', () => {
  describe('PRODUCT_BARCODE_FORMATS', () => {
    it('should contain only standard product barcode formats', () => {
      expect(PRODUCT_BARCODE_FORMATS).toEqual([
        'EAN-13',
        'EAN-8', 
        'UPC-A',
        'Code-128'
      ])
    })

    it('should not contain QR codes or other non-product formats', () => {
      const qrFormats = ['QR', 'QR_CODE', 'qr_code', 'qr', 'QR-Code']
      qrFormats.forEach(qrFormat => {
        expect(PRODUCT_BARCODE_FORMATS).not.toContain(qrFormat)
      })
    })

    it('should be readonly array', () => {
      expect(() => {
        // @ts-expect-error - testing readonly behavior
        PRODUCT_BARCODE_FORMATS.push('invalid')
      }).toThrow()
    })
  })

  describe('BARCODE_DETECTOR_FORMATS', () => {
    it('should contain BarcodeDetector API format names in lowercase', () => {
      expect(BARCODE_DETECTOR_FORMATS).toEqual([
        'ean_13',
        'ean_8',
        'upc_a',
        'code_128'
      ])
    })

    it('should not contain QR codes', () => {
      const qrFormats = ['qr_code', 'QR', 'qr', 'QR_CODE']
      qrFormats.forEach(qrFormat => {
        expect(BARCODE_DETECTOR_FORMATS).not.toContain(qrFormat)
      })
    })

    it('should use lowercase with underscores naming convention', () => {
      BARCODE_DETECTOR_FORMATS.forEach(format => {
        expect(format).toMatch(/^[a-z0-9_]+$/)
      })
    })
  })

  describe('ZXING_FORMATS', () => {
    it('should contain ZXing library format names in uppercase', () => {
      expect(ZXING_FORMATS).toEqual([
        'EAN_13',
        'EAN_8',
        'UPC_A',
        'CODE_128'
      ])
    })

    it('should not contain QR codes', () => {
      const qrFormats = ['QR_CODE', 'QR', 'qr_code']
      qrFormats.forEach(qrFormat => {
        expect(ZXING_FORMATS).not.toContain(qrFormat)
      })
    })

    it('should use uppercase with underscores naming convention', () => {
      ZXING_FORMATS.forEach(format => {
        expect(format).toMatch(/^[A-Z0-9_]+$/)
      })
    })
  })

  describe('Format Mappings', () => {
    it('should correctly map product formats to detector formats', () => {
      expect(PRODUCT_TO_DETECTOR_FORMAT_MAP).toEqual({
        'EAN-13': 'ean_13',
        'EAN-8': 'ean_8',
        'UPC-A': 'upc_a',
        'Code-128': 'code_128'
      })
    })

    it('should correctly map product formats to ZXing formats', () => {
      expect(PRODUCT_TO_ZXING_FORMAT_MAP).toEqual({
        'EAN-13': 'EAN_13',
        'EAN-8': 'EAN_8',
        'UPC-A': 'UPC_A',
        'Code-128': 'CODE_128'
      })
    })

    it('should have bidirectional mapping for ZXing formats', () => {
      Object.entries(PRODUCT_TO_ZXING_FORMAT_MAP).forEach(([product, zxing]) => {
        expect(ZXING_TO_PRODUCT_FORMAT_MAP[zxing as ZXingFormat]).toBe(product)
      })
    })

    it('should have bidirectional mapping for detector formats', () => {
      Object.entries(PRODUCT_TO_DETECTOR_FORMAT_MAP).forEach(([product, detector]) => {
        expect(DETECTOR_TO_PRODUCT_FORMAT_MAP[detector as BarcodeDetectorFormat]).toBe(product)
      })
    })
  })

  describe('Format Consistency', () => {
    it('should have same number of formats across all constants', () => {
      expect(PRODUCT_BARCODE_FORMATS.length).toBe(BARCODE_DETECTOR_FORMATS.length)
      expect(BARCODE_DETECTOR_FORMATS.length).toBe(ZXING_FORMATS.length)
      expect(ZXING_FORMATS.length).toBe(4)
    })

    it('should have complete mapping coverage', () => {
      expect(Object.keys(PRODUCT_TO_DETECTOR_FORMAT_MAP)).toHaveLength(4)
      expect(Object.keys(PRODUCT_TO_ZXING_FORMAT_MAP)).toHaveLength(4)
      expect(Object.keys(ZXING_TO_PRODUCT_FORMAT_MAP)).toHaveLength(4)
      expect(Object.keys(DETECTOR_TO_PRODUCT_FORMAT_MAP)).toHaveLength(4)
      
      // Проверяем, что все маппинги имеют одинаковое количество элементов
      expect(Object.keys(PRODUCT_TO_DETECTOR_FORMAT_MAP)).toHaveLength(PRODUCT_BARCODE_FORMATS.length)
      expect(Object.keys(PRODUCT_TO_ZXING_FORMAT_MAP)).toHaveLength(PRODUCT_BARCODE_FORMATS.length)
      expect(Object.keys(ZXING_TO_PRODUCT_FORMAT_MAP)).toHaveLength(ZXING_FORMATS.length)
      expect(Object.keys(DETECTOR_TO_PRODUCT_FORMAT_MAP)).toHaveLength(BARCODE_DETECTOR_FORMATS.length)
    })
  })

  describe('BarcodeFormatUtils', () => {
    describe('toDetectorFormat', () => {
      it('should convert product formats to detector formats', () => {
        expect(BarcodeFormatUtils.toDetectorFormat('EAN-13')).toBe('ean_13')
        expect(BarcodeFormatUtils.toDetectorFormat('EAN-8')).toBe('ean_8')
        expect(BarcodeFormatUtils.toDetectorFormat('UPC-A')).toBe('upc_a')
        expect(BarcodeFormatUtils.toDetectorFormat('Code-128')).toBe('code_128')
      })
    })

    describe('toZXingFormat', () => {
      it('should convert product formats to ZXing formats', () => {
        expect(BarcodeFormatUtils.toZXingFormat('EAN-13')).toBe('EAN_13')
        expect(BarcodeFormatUtils.toZXingFormat('EAN-8')).toBe('EAN_8')
        expect(BarcodeFormatUtils.toZXingFormat('UPC-A')).toBe('UPC_A')
        expect(BarcodeFormatUtils.toZXingFormat('Code-128')).toBe('CODE_128')
      })
    })

    describe('fromZXingFormat', () => {
      it('should convert ZXing formats to product formats', () => {
        expect(BarcodeFormatUtils.fromZXingFormat('EAN_13')).toBe('EAN-13')
        expect(BarcodeFormatUtils.fromZXingFormat('EAN_8')).toBe('EAN-8')
        expect(BarcodeFormatUtils.fromZXingFormat('UPC_A')).toBe('UPC-A')
        expect(BarcodeFormatUtils.fromZXingFormat('CODE_128')).toBe('Code-128')
      })
    })

    describe('fromDetectorFormat', () => {
      it('should convert detector formats to product formats', () => {
        expect(BarcodeFormatUtils.fromDetectorFormat('ean_13')).toBe('EAN-13')
        expect(BarcodeFormatUtils.fromDetectorFormat('ean_8')).toBe('EAN-8')
        expect(BarcodeFormatUtils.fromDetectorFormat('upc_a')).toBe('UPC-A')
        expect(BarcodeFormatUtils.fromDetectorFormat('code_128')).toBe('Code-128')
      })
    })

    describe('isProductBarcodeFormat', () => {
      it('should return true for valid product barcode formats', () => {
        expect(BarcodeFormatUtils.isProductBarcodeFormat('EAN-13')).toBe(true)
        expect(BarcodeFormatUtils.isProductBarcodeFormat('EAN-8')).toBe(true)
        expect(BarcodeFormatUtils.isProductBarcodeFormat('UPC-A')).toBe(true)
        expect(BarcodeFormatUtils.isProductBarcodeFormat('Code-128')).toBe(true)
      })

      it('should return false for invalid or QR formats', () => {
        expect(BarcodeFormatUtils.isProductBarcodeFormat('QR')).toBe(false)
        expect(BarcodeFormatUtils.isProductBarcodeFormat('QR_CODE')).toBe(false)
        expect(BarcodeFormatUtils.isProductBarcodeFormat('invalid')).toBe(false)
        expect(BarcodeFormatUtils.isProductBarcodeFormat('')).toBe(false)
      })
    })

    describe('isNotQRCode', () => {
      it('should return true for non-QR formats', () => {
        expect(BarcodeFormatUtils.isNotQRCode('EAN-13')).toBe(true)
        expect(BarcodeFormatUtils.isNotQRCode('EAN_13')).toBe(true)
        expect(BarcodeFormatUtils.isNotQRCode('ean_13')).toBe(true)
        expect(BarcodeFormatUtils.isNotQRCode('CODE_128')).toBe(true)
      })

      it('should return false for QR code formats', () => {
        expect(BarcodeFormatUtils.isNotQRCode('QR')).toBe(false)
        expect(BarcodeFormatUtils.isNotQRCode('QR_CODE')).toBe(false)
        expect(BarcodeFormatUtils.isNotQRCode('qr_code')).toBe(false)
        expect(BarcodeFormatUtils.isNotQRCode('qr')).toBe(false)
        expect(BarcodeFormatUtils.isNotQRCode('QR-Code')).toBe(false)
      })
    })
  })

  describe('Type Safety', () => {
    it('should provide proper TypeScript types', () => {
      const productFormat: ProductBarcodeFormat = 'EAN-13'
      const detectorFormat: BarcodeDetectorFormat = 'ean_13'
      const zxingFormat: ZXingFormat = 'EAN_13'

      expect(typeof productFormat).toBe('string')
      expect(typeof detectorFormat).toBe('string')
      expect(typeof zxingFormat).toBe('string')
    })
  })
})