/**
 * @jest-environment node
 */

// Мокаем DataService
jest.mock('@/lib/data-service');

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { dataService } from '@/lib/data-service';

const mockDataService = dataService as jest.Mocked<typeof dataService>;

// Мокаем console.error для тестов
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('/api/items', () => {
  describe('GET /api/items', () => {
    it('should return all items with default pagination', async () => {
      const mockResult = {
        items: [
          {
            id: '1',
            barcode: '4006381333931',
            name: 'Тестовый товар 1',
            description: 'Описание тестового товара',
            category: 'Электроника',
            price: 1500,
            quantity: 10,
            unit: 'шт',
            location: 'Склад А',
            supplier: 'Поставщик 1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        ],
        total: 1,
        limit: 10,
        offset: 0,
        totalPages: 1
      };

      mockDataService.getItems.mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost:3000/api/items');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('limit', 10);
      expect(data).toHaveProperty('offset', 0);
      expect(Array.isArray(data.items)).toBe(true);
      expect(mockDataService.getItems).toHaveBeenCalledWith({
        barcode: undefined,
        category: undefined,
        limit: 10,
        name: undefined,
        page: 1,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
    });

    it('should filter items by barcode', async () => {
      const mockResult = {
        items: [
          {
            id: '1',
            barcode: '4006381333931',
            name: 'Тестовый товар 1',
            description: 'Описание тестового товара',
            category: 'Электроника',
            price: 1500,
            quantity: 10,
            unit: 'шт',
            location: 'Склад А',
            supplier: 'Поставщик 1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        ],
        total: 1,
        limit: 10,
        offset: 0,
        totalPages: 1
      };

      mockDataService.getItems.mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost:3000/api/items?barcode=4006381333931');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].barcode).toBe('4006381333931');
      expect(mockDataService.getItems).toHaveBeenCalledWith({ 
        barcode: '4006381333931',
        category: undefined,
        limit: 10,
        name: undefined,
        page: 1,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
    });

    it('should filter items by name', async () => {
      const mockResult = {
        items: [
          {
            id: '2',
            barcode: '9781234567897',
            name: 'Тестовая книга',
            description: 'Тестовая книга для проверки ISBN',
            category: 'Книги',
            price: 500,
            quantity: 5,
            unit: 'шт',
            location: 'Склад Б',
            supplier: 'Издательство',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        ],
        total: 1,
        limit: 10,
        offset: 0,
        totalPages: 1
      };

      mockDataService.getItems.mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost:3000/api/items?name=книга');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].name).toContain('книга');
      expect(mockDataService.getItems).toHaveBeenCalledWith({ 
        name: 'книга',
        barcode: undefined,
        category: undefined,
        limit: 10,
        page: 1,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    });

    it('should apply pagination', async () => {
      const mockItems = [
        { id: '2', barcode: '2222222222222', name: 'Товар 2', description: 'Описание 2', category: 'Категория 2', price: 200, quantity: 2, unit: 'шт', location: 'Склад 2', supplier: 'Поставщик 2', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      ];
      mockDataService.getItems.mockResolvedValue({
        items: mockItems,
        total: 10,
        limit: 1,
        offset: 1,
        totalPages: 10
      });

      const request = new NextRequest('http://localhost:3000/api/items?limit=1&offset=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.limit).toBe(1);
      expect(data.offset).toBe(1);
      expect(data.items).toHaveLength(1);
      expect(mockDataService.getItems).toHaveBeenCalledWith({ 
        limit: 1,
        name: undefined,
        barcode: undefined,
        category: undefined,
        page: 1,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    });
  });

  describe('POST /api/items', () => {
    it('should create a new item', async () => {
      const newItem = {
        barcode: '1234567890123',
        name: 'Новый товар',
        description: 'Описание нового товара',
        category: 'Тест',
        price: 100,
        quantity: 5,
        unit: 'шт',
        location: 'Склад',
        supplier: 'Тестовый поставщик',
      };

      const createdItem = {
        id: 'new-id',
        ...newItem,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockDataService.createItem.mockResolvedValue(createdItem);

      const request = new NextRequest('http://localhost:3000/api/items', {
        method: 'POST',
        body: JSON.stringify(newItem),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('id');
      expect(data.barcode).toBe(newItem.barcode);
      expect(data.name).toBe(newItem.name);
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('updatedAt');
      expect(mockDataService.createItem).toHaveBeenCalledWith(newItem);
    });

    it('should reject item without required fields', async () => {
      const invalidItem = {
        description: 'Товар без штрихкода и названия',
      };

      const request = new NextRequest('http://localhost:3000/api/items', {
        method: 'POST',
        body: JSON.stringify(invalidItem),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should reject duplicate barcode', async () => {
      const duplicateItem = {
        barcode: '4006381333931', // Уже существующий штрихкод
        name: 'Дублирующий товар',
        quantity: 10,
      };

      mockDataService.createItem.mockRejectedValue(new Error('Item with this barcode already exists'));

      const request = new NextRequest('http://localhost:3000/api/items', {
        method: 'POST',
        body: JSON.stringify(duplicateItem),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('already exists');
      expect(mockDataService.createItem).toHaveBeenCalledWith(duplicateItem);
    });
  });
});