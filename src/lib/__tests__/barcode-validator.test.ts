import { validateBarcode, getSupportedFormats, normalizeISBN13ToEAN13 } from '../barcode-validator';

describe('Barcode Validator', () => {
  describe('EAN-13 validation', () => {
    it('should validate correct EAN-13', () => {
      const result = validateBarcode('4006381333931');
      expect(result.valid).toBe(true);
      expect(result.format).toBe('EAN-13');
    });

    it('should reject EAN-13 with invalid checksum', () => {
      const result = validateBarcode('4006381333932');
      expect(result.valid).toBe(false);
      expect(result.format).toBe('EAN-13');
      expect(result.reason).toContain('Invalid checksum');
    });

    it('should reject EAN-13 with wrong length', () => {
      const result = validateBarcode('40063813339');
      expect(result.valid).toBe(false);
      expect(result.format).toBe('UNKNOWN');
      expect(result.reason).toContain('Unsupported barcode format');
    });
  });

  describe('ISBN-13 validation', () => {
    it('should validate correct ISBN-13 with 978 prefix', () => {
      const result = validateBarcode('9781234567897');
      expect(result.valid).toBe(true);
      expect(result.format).toBe('ISBN-13');
    });

    it('should validate correct ISBN-13 with 979 prefix', () => {
      const result = validateBarcode('9791234567896');
      expect(result.valid).toBe(true);
      expect(result.format).toBe('ISBN-13');
    });

    it('should reject ISBN-13 with invalid checksum', () => {
      const result = validateBarcode('9781234567890');
      expect(result.valid).toBe(false);
      expect(result.format).toBe('ISBN-13');
      expect(result.reason).toContain('Invalid checksum');
    });

    it('should reject non-ISBN EAN-13', () => {
      const result = validateBarcode('4006381333931');
      expect(result.valid).toBe(true);
      expect(result.format).toBe('EAN-13');
    });
  });

  describe('EAN-8 validation', () => {
    it('should validate correct EAN-8', () => {
      const result = validateBarcode('12345670');
      expect(result.valid).toBe(true);
      expect(result.format).toBe('EAN-8');
    });

    it('should reject EAN-8 with invalid checksum', () => {
      const result = validateBarcode('12345671');
      expect(result.valid).toBe(false);
      expect(result.format).toBe('EAN-8');
      expect(result.reason).toContain('Invalid checksum');
    });

    it('should reject EAN-8 with wrong length', () => {
      const result = validateBarcode('1234567');
      expect(result.valid).toBe(false);
      expect(result.format).toBe('UNKNOWN');
      expect(result.reason).toContain('Unsupported barcode format');
    });
  });

  describe('UPC-A validation', () => {
    it('should validate correct UPC-A', () => {
      const result = validateBarcode('123456789012');
      expect(result.valid).toBe(true);
      expect(result.format).toBe('UPC-A');
    });

    it('should reject UPC-A with invalid checksum', () => {
      const result = validateBarcode('123456789013');
      expect(result.valid).toBe(false);
      expect(result.format).toBe('UPC-A');
      expect(result.reason).toContain('Invalid checksum');
    });

    it('should reject UPC-A with wrong length', () => {
      const result = validateBarcode('12345678901');
      expect(result.valid).toBe(false);
      expect(result.format).toBe('UNKNOWN');
      expect(result.reason).toContain('Unsupported barcode format');
    });
  });

  describe('Input sanitization', () => {
    it('should handle whitespace in barcode', () => {
      const result = validateBarcode(' 4006381333931 ');
      expect(result.valid).toBe(true);
      expect(result.format).toBe('EAN-13');
    });

    it('should handle empty barcode', () => {
      const result = validateBarcode('');
      expect(result.valid).toBe(false);
      expect(result.format).toBe('UNKNOWN');
      expect(result.reason).toContain('cannot be empty');
    });

    it('should handle non-numeric barcode', () => {
      const result = validateBarcode('abc123def456');
      expect(result.valid).toBe(false);
      expect(result.format).toBe('UNKNOWN');
      expect(result.reason).toContain('Unsupported barcode format');
    });
  });

  describe('Unsupported formats', () => {
    it('should reject unsupported length', () => {
      const result = validateBarcode('12345');
      expect(result.valid).toBe(false);
      expect(result.format).toBe('UNKNOWN');
      expect(result.reason).toContain('Unsupported barcode format');
    });
  });

  describe('Utility functions', () => {
    it('should return supported formats', () => {
      const formats = getSupportedFormats();
      expect(formats).toEqual(['EAN-13', 'ISBN-13', 'EAN-8', 'UPC-A']);
    });

    it('should normalize ISBN-13 to EAN-13', () => {
      const normalized = normalizeISBN13ToEAN13('9780134685991');
      expect(normalized).toBe('9780134685991');
    });
  });
});