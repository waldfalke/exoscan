// API-related type definitions

export interface RouteParams {
  id?: string;
  barcode?: string;
}

// For Next.js API route handlers
export interface APIRouteContext<T = RouteParams> {
  params: T;
}

// Validation result interface that matches the barcode-validator
export interface ValidationResult {
  valid: boolean;
  format: string;
  normalized?: string;
  reason?: string;
  errors?: string[];
}