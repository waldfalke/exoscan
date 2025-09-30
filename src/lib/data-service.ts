import { GoogleSheetsAdapter, SheetRow } from './google-sheets';
import { Item, CreateItemRequest, UpdateItemRequest, ItemSearchQuery, ItemsResponse } from '../types/item';

// Конвертация между типами Item и SheetRow
function sheetRowToItem(row: SheetRow): Item {
  return {
    id: row.id,
    barcode: row.barcode,
    name: row.name,
    description: row.description,
    category: row.category,
    price: row.price,
    quantity: row.quantity,
    unit: row.unit,
    location: row.location,
    supplier: row.supplier,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}



function createItemRequestToSheetRow(request: CreateItemRequest): Omit<SheetRow, 'id'> {
  const now = new Date().toISOString();
  return {
    barcode: request.barcode,
    name: request.name,
    description: request.description || undefined,
    category: request.category || undefined,
    price: request.price || undefined,
    quantity: request.quantity ?? 0,
    unit: request.unit || 'шт',
    location: request.location || undefined,
    supplier: request.supplier || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

// Класс для работы с данными через Google Sheets
export class DataService {
  private sheetsAdapter: GoogleSheetsAdapter;
  private useGoogleSheets: boolean;
  private fallbackData: Item[] = []; // Fallback данные для разработки

  constructor(useGoogleSheets: boolean = true) {
    this.useGoogleSheets = useGoogleSheets && process.env.NODE_ENV !== 'test';
    this.sheetsAdapter = new GoogleSheetsAdapter();
    
    // Инициализируем fallback данные
    this.initializeFallbackData();
  }

  private initializeFallbackData() {
    this.fallbackData = [
      {
        id: 'item-1',
        barcode: '9780134685991',
        name: 'Effective Java',
        description: 'Programming book by Joshua Bloch',
        category: 'Books',
        price: 45.99,
        quantity: 12,
        unit: 'шт',
        location: 'A1-B2',
        supplier: 'Addison-Wesley',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      },
      {
        id: 'item-2',
        barcode: '1234567890123',
        name: 'Sample Product',
        description: 'A sample product for testing',
        category: 'Electronics',
        price: 99.99,
        quantity: 5,
        unit: 'шт',
        location: 'C3-D4',
        supplier: 'Tech Corp',
        createdAt: '2023-01-02T00:00:00Z',
        updatedAt: '2023-01-02T00:00:00Z',
      },
    ];
  }

  // Получение всех элементов с фильтрацией и пагинацией
  async getItems(query: ItemSearchQuery): Promise<ItemsResponse> {
    try {
      let items: Item[];

      if (this.useGoogleSheets) {
        const rows = await this.sheetsAdapter.getRows();
        items = rows.map(sheetRowToItem);
      } else {
        items = [...this.fallbackData];
      }

      // Применяем фильтры
      if (query.barcode) {
        items = items.filter(item => 
          item.barcode.toLowerCase().includes(query.barcode!.toLowerCase())
        );
      }

      if (query.name) {
        items = items.filter(item => 
          item.name.toLowerCase().includes(query.name!.toLowerCase())
        );
      }

      if (query.category) {
        items = items.filter(item => 
          item.category?.toLowerCase().includes(query.category!.toLowerCase())
        );
      }

      // Сортировка
      items.sort((a, b) => {
        if (query.sortBy === 'name') {
          return query.sortOrder === 'desc' 
            ? b.name.localeCompare(a.name)
            : a.name.localeCompare(b.name);
        }
        if (query.sortBy === 'createdAt') {
          return query.sortOrder === 'desc'
            ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return 0;
      });

      // Пагинация
      const total = items.length;
      const page = query.page || 1;
      const limit = query.limit || 10;
      const offset = (page - 1) * limit;
      const paginatedItems = items.slice(offset, offset + limit);

      return {
        items: paginatedItems,
        total,
        page,
        limit,
        offset,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Error getting items:', error);
      throw new Error('Failed to fetch items');
    }
  }

  // Получение элемента по ID
  async getItemById(id: string): Promise<Item | null> {
    try {
      if (this.useGoogleSheets) {
        const rows = await this.sheetsAdapter.getRows();
        const row = rows.find(r => r.id === id);
        return row ? sheetRowToItem(row) : null;
      } else {
        return this.fallbackData.find(item => item.id === id) || null;
      }
    } catch (error) {
      console.error('Error getting item by ID:', error);
      throw new Error('Failed to fetch item');
    }
  }

  // Создание нового элемента
  async createItem(request: CreateItemRequest): Promise<Item> {
    try {
      // Проверяем на дублирование штрихкода
      const existingItem = await this.findItemByBarcode(request.barcode);
      if (existingItem) {
        throw new Error('Item with this barcode already exists');
      }

      if (this.useGoogleSheets) {
        const sheetRow = createItemRequestToSheetRow(request);
        const newRow = await this.sheetsAdapter.addRow(sheetRow);
        return sheetRowToItem(newRow);
      } else {
        const newItem: Item = {
          id: `item-${Date.now()}`,
          ...request,
          unit: request.unit || 'шт',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.fallbackData.push(newItem);
        return newItem;
      }
    } catch (error) {
      console.error('Error creating item:', error);
      if (error instanceof Error && error.message === 'Item with this barcode already exists') {
        throw error;
      }
      throw new Error('Failed to create item');
    }
  }

  // Обновление элемента
  async updateItem(id: string, request: UpdateItemRequest): Promise<Item | null> {
    try {
      // Проверяем существование элемента
      const existingItem = await this.getItemById(id);
      if (!existingItem) {
        return null;
      }

      // Проверяем на дублирование штрихкода (если штрихкод изменяется)
      if (request.barcode && request.barcode !== existingItem.barcode) {
        const duplicateItem = await this.findItemByBarcode(request.barcode);
        if (duplicateItem && duplicateItem.id !== id) {
          throw new Error('Item with this barcode already exists');
        }
      }

      if (this.useGoogleSheets) {
        const updates = {
          ...request,
          updatedAt: new Date().toISOString(),
        };
        const updatedRow = await this.sheetsAdapter.updateRow(id, updates);
        return updatedRow ? sheetRowToItem(updatedRow) : null;
      } else {
        const itemIndex = this.fallbackData.findIndex(item => item.id === id);
        if (itemIndex === -1) {
          return null;
        }

        this.fallbackData[itemIndex] = {
          ...this.fallbackData[itemIndex],
          ...request,
          updatedAt: new Date().toISOString(),
        };
        return this.fallbackData[itemIndex];
      }
    } catch (error) {
      console.error('Error updating item:', error);
      if (error instanceof Error && error.message === 'Item with this barcode already exists') {
        throw error;
      }
      throw new Error('Failed to update item');
    }
  }

  // Удаление элемента
  async deleteItem(id: string): Promise<boolean> {
    try {
      if (this.useGoogleSheets) {
        return await this.sheetsAdapter.deleteRow(id);
      } else {
        const itemIndex = this.fallbackData.findIndex(item => item.id === id);
        if (itemIndex === -1) {
          return false;
        }
        this.fallbackData.splice(itemIndex, 1);
        return true;
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      throw new Error('Failed to delete item');
    }
  }

  // Поиск элемента по штрихкоду
  async findItemByBarcode(barcode: string): Promise<Item | null> {
    try {
      if (this.useGoogleSheets) {
        const row = await this.sheetsAdapter.findByBarcode(barcode);
        return row ? sheetRowToItem(row) : null;
      } else {
        return this.fallbackData.find(item => item.barcode === barcode) || null;
      }
    } catch (error) {
      console.error('Error finding item by barcode:', error);
      throw new Error('Failed to find item by barcode');
    }
  }

  // Инициализация заголовков в Google Sheets (если нужно)
  async initializeSheet(): Promise<void> {
    if (this.useGoogleSheets) {
      try {
        await this.sheetsAdapter.createHeaders();
      } catch (error) {
        console.error('Error initializing sheet:', error);
        // Не бросаем ошибку, так как заголовки могут уже существовать
      }
    }
  }
}

// Экспорт экземпляра сервиса по умолчанию
export const dataService = new DataService();