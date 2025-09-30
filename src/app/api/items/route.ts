import { NextRequest, NextResponse } from 'next/server';
import { CreateItemRequest, ItemSearchQuery } from '../../../types/item';
import { dataService } from '../../../lib/data-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Извлекаем параметры запроса
    const query: ItemSearchQuery = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '10'),
      barcode: searchParams.get('barcode') || undefined,
      name: searchParams.get('name') || undefined,
      category: searchParams.get('category') || undefined,
      sortBy: (searchParams.get('sortBy') as 'name' | 'createdAt') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    };

    const response = await dataService.getItems(query);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateItemRequest = await request.json();
    
    // Валидация обязательных полей
    if (!body.barcode || !body.name || body.quantity === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: barcode, name, quantity' },
        { status: 400 }
      );
    }

    const newItem = await dataService.createItem(body);
    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error('Error creating item:', error);
    
    if (error instanceof Error && error.message === 'Item with this barcode already exists') {
      return NextResponse.json(
        { error: 'Item with this barcode already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}