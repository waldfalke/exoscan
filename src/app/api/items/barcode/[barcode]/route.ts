import { NextRequest, NextResponse } from 'next/server';
import { validateBarcode } from '@/lib/barcode-validator';
import { dataService } from '@/lib/data-service';

interface RouteParams {
  barcode: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    // Декодируем штрихкод из URL
    const resolvedParams = await params;
    const barcode = decodeURIComponent(resolvedParams.barcode);
    
    // Валидируем штрихкод
    const validation = validateBarcode(barcode);
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: 'Invalid barcode',
          details: validation.reason,
          format: validation.format
        },
        { status: 400 }
      );
    }

    // Ищем товар по штрихкоду
    const item = await dataService.findItemByBarcode(barcode);
    
    if (!item) {
      return NextResponse.json(
        { 
          error: 'Item not found',
          barcode: barcode,
          format: validation.format
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      item,
      validation
    });
  } catch (error) {
    console.error('Error searching item by barcode:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}