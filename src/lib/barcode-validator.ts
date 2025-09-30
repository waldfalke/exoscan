/**
 * Barcode validation utilities
 * Supports EAN-13, ISBN-13, EAN-8, UPC-A formats with checksum validation
 */

export type BarcodeFormat = 'EAN-13' | 'ISBN-13' | 'EAN-8' | 'UPC-A' | 'UNKNOWN';

export interface ValidationResult {
  valid: boolean;
  format: BarcodeFormat;
  normalized?: string;
  reason?: string;
}

/**
 * Calculate EAN-13 checksum digit
 */
function calculateEAN13Checksum(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const digit = parseInt(digits[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Calculate EAN-8 checksum digit
 */
function calculateEAN8Checksum(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const digit = parseInt(digits[i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Calculate UPC-A checksum digit
 */
function calculateUPCAChecksum(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const digit = parseInt(digits[i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Validate EAN-13 barcode
 */
function validateEAN13(barcode: string): ValidationResult {
  if (!/^\d{13}$/.test(barcode)) {
    return {
      valid: false,
      format: 'EAN-13',
      reason: 'EAN-13 must be exactly 13 digits'
    };
  }

  const digits = barcode.slice(0, 12);
  const checkDigit = parseInt(barcode[12]);
  const calculatedCheck = calculateEAN13Checksum(digits);

  if (checkDigit !== calculatedCheck) {
    return {
      valid: false,
      format: 'EAN-13',
      reason: `Invalid checksum. Expected ${calculatedCheck}, got ${checkDigit}`
    };
  }

  return {
    valid: true,
    format: 'EAN-13',
    normalized: barcode
  };
}

/**
 * Validate ISBN-13 barcode (subset of EAN-13 with 978/979 prefix)
 */
function validateISBN13(barcode: string): ValidationResult {
  if (!/^\d{13}$/.test(barcode)) {
    return {
      valid: false,
      format: 'ISBN-13',
      reason: 'ISBN-13 must be exactly 13 digits'
    };
  }

  // Check ISBN-13 prefix (978 or 979)
  if (!barcode.startsWith('978') && !barcode.startsWith('979')) {
    return {
      valid: false,
      format: 'ISBN-13',
      reason: 'ISBN-13 must start with 978 or 979'
    };
  }

  const digits = barcode.slice(0, 12);
  const checkDigit = parseInt(barcode[12]);
  const calculatedCheck = calculateEAN13Checksum(digits);

  if (checkDigit !== calculatedCheck) {
    return {
      valid: false,
      format: 'ISBN-13',
      reason: `Invalid checksum. Expected ${calculatedCheck}, got ${checkDigit}`
    };
  }

  return {
    valid: true,
    format: 'ISBN-13',
    normalized: barcode // Normalize to EAN-13 format
  };
}

/**
 * Validate EAN-8 barcode
 */
function validateEAN8(barcode: string): ValidationResult {
  if (!/^\d{8}$/.test(barcode)) {
    return {
      valid: false,
      format: 'EAN-8',
      reason: 'EAN-8 must be exactly 8 digits'
    };
  }

  const digits = barcode.slice(0, 7);
  const checkDigit = parseInt(barcode[7]);
  const calculatedCheck = calculateEAN8Checksum(digits);

  if (checkDigit !== calculatedCheck) {
    return {
      valid: false,
      format: 'EAN-8',
      reason: `Invalid checksum. Expected ${calculatedCheck}, got ${checkDigit}`
    };
  }

  return {
    valid: true,
    format: 'EAN-8',
    normalized: barcode
  };
}

/**
 * Validate UPC-A barcode
 */
function validateUPCA(barcode: string): ValidationResult {
  if (!/^\d{12}$/.test(barcode)) {
    return {
      valid: false,
      format: 'UPC-A',
      reason: 'UPC-A must be exactly 12 digits'
    };
  }

  const digits = barcode.slice(0, 11);
  const checkDigit = parseInt(barcode[11]);
  const calculatedCheck = calculateUPCAChecksum(digits);

  if (checkDigit !== calculatedCheck) {
    return {
      valid: false,
      format: 'UPC-A',
      reason: `Invalid checksum. Expected ${calculatedCheck}, got ${checkDigit}`
    };
  }

  return {
    valid: true,
    format: 'UPC-A',
    normalized: barcode
  };
}

/**
 * Detect barcode format based on length and prefix
 */
function detectBarcodeFormat(barcode: string): BarcodeFormat {
  if (!/^\d+$/.test(barcode)) {
    return 'UNKNOWN';
  }

  switch (barcode.length) {
    case 8:
      return 'EAN-8';
    case 12:
      return 'UPC-A';
    case 13:
      // Check if it's ISBN-13 (978/979 prefix)
      if (barcode.startsWith('978') || barcode.startsWith('979')) {
        return 'ISBN-13';
      }
      return 'EAN-13';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Main validation function
 */
export function validateBarcode(barcode: string): ValidationResult {
  // Clean input
  const cleanBarcode = barcode.trim().replace(/\s+/g, '');
  
  if (!cleanBarcode) {
    return {
      valid: false,
      format: 'UNKNOWN',
      reason: 'Barcode cannot be empty'
    };
  }

  const format = detectBarcodeFormat(cleanBarcode);

  switch (format) {
    case 'EAN-13':
      return validateEAN13(cleanBarcode);
    case 'ISBN-13':
      return validateISBN13(cleanBarcode);
    case 'EAN-8':
      return validateEAN8(cleanBarcode);
    case 'UPC-A':
      return validateUPCA(cleanBarcode);
    default:
      return {
        valid: false,
        format: 'UNKNOWN',
        reason: `Unsupported barcode format. Supported: EAN-13, ISBN-13, EAN-8, UPC-A. Got ${cleanBarcode.length} digits.`
      };
  }
}

/**
 * Normalize ISBN-13 to EAN-13 format (as per spec)
 */
export function normalizeISBN13ToEAN13(isbn13: string): string {
  // ISBN-13 is already in EAN-13 format, just return as-is
  return isbn13;
}

/**
 * Get supported barcode formats
 */
export function getSupportedFormats(): BarcodeFormat[] {
  return ['EAN-13', 'ISBN-13', 'EAN-8', 'UPC-A'];
}