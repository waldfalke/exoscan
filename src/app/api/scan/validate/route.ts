import { NextRequest, NextResponse } from 'next/server';
import { validateBarcode } from '@/lib/barcode-validator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    if (!body || typeof body.barcode !== 'string') {
      return NextResponse.json(
        { 
          error: 'Invalid request body. Expected { barcode: string }',
          code: 'ERR_INVALID_REQUEST'
        },
        { status: 400 }
      );
    }

    const { barcode } = body;

    // Validate barcode
    const result = validateBarcode(barcode);

    // Return validation result according to API contract
    return NextResponse.json({
      valid: result.valid,
      format: result.format,
      normalized: result.normalized,
      reason: result.reason
    });

  } catch (error) {
    console.error('Error validating barcode:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'ERR_INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { 
      error: 'Method not allowed. Use POST.',
      code: 'ERR_METHOD_NOT_ALLOWED'
    },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { 
      error: 'Method not allowed. Use POST.',
      code: 'ERR_METHOD_NOT_ALLOWED'
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { 
      error: 'Method not allowed. Use POST.',
      code: 'ERR_METHOD_NOT_ALLOWED'
    },
    { status: 405 }
  );
}