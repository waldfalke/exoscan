/**
 * @jest-environment node
 */

// Мокаем DataService
jest.mock('@/lib/data-service');

import { NextRequest } from 'next/server';
import { GET } from '../route';
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

describe('/api/items/barcode/[barcode]', () => {
  describe('GET /api/items/barcode/[barcode]', () => {
    it('should find item by valid barcode', async () => {
      const mockItem = {
        id: '1',
        barcode: '4006381333931',
        name: 'Тестовый товар',
        description: 'Описание товара',
        category: 'Тест',
        price: 100,
        quantity: 10,
        unit: 'шт',
        location: 'Склад',
        supplier: 'Поставщик',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockDataService.findItemByBarcode.mockResolvedValue(mockItem);

      const request = new NextRequest('http://localhost:3000/api/items/barcode/4006381333931');
      const response = await GET(request, { params: Promise.resolve({ barcode: '4006381333931' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('item');
      expect(data).toHaveProperty('validation');
      expect(data.item.barcode).toBe('4006381333931');
      expect(data.validation.valid).toBe(true);
      expect(data.validation.format).toBe('EAN-13');
      expect(mockDataService.findItemByBarcode).toHaveBeenCalledWith('4006381333931');
    });

    it('should find ISBN-13 item by barcode', async () => {
      const mockItem = {
        id: '2',
        barcode: '9781234567897',
        name: 'Тестовая книга',
        description: 'Описание книги',
        category: 'Книги',
        price: 500,
        quantity: 5,
        unit: 'шт',
        location: 'Библиотека',
        supplier: 'Издательство',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockDataService.findItemByBarcode.mockResolvedValue(mockItem);

      const request = new NextRequest('http://localhost:3000/api/items/barcode/9781234567897');
      const response = await GET(request, { params: Promise.resolve({ barcode: '9781234567897' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.barcode).toBe('9781234567897');
      expect(data.validation.format).toBe('ISBN-13');
      expect(mockDataService.findItemByBarcode).toHaveBeenCalledWith('9781234567897');
    });

    it('should return 404 for valid barcode but non-existent item', async () => {
      mockDataService.findItemByBarcode.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/items/barcode/1234567890128');
      const response = await GET(request, { params: Promise.resolve({ barcode: '1234567890128' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Item not found');
      expect(data.barcode).toBe('1234567890128');
      expect(data.format).toBe('EAN-13');
      expect(mockDataService.findItemByBarcode).toHaveBeenCalledWith('1234567890128');
    });

    it('should return 400 for invalid barcode', async () => {
      const request = new NextRequest('http://localhost:3000/api/items/barcode/invalid');
      const response = await GET(request, { params: Promise.resolve({ barcode: 'invalid' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid barcode');
      expect(data).toHaveProperty('details');
      expect(data.format).toBe('UNKNOWN');
    });

    it('should handle URL-encoded barcodes', async () => {
      const mockItem = {
        id: '1',
        barcode: '4006381333931',
        name: 'Тестовый товар',
        description: 'Описание товара',
        category: 'Тест',
        price: 100,
        quantity: 10,
        unit: 'шт',
        location: 'Склад',
        supplier: 'Поставщик',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockDataService.findItemByBarcode.mockResolvedValue(mockItem);

      const encodedBarcode = encodeURIComponent('4006381333931');
      const request = new NextRequest(`http://localhost:3000/api/items/barcode/${encodedBarcode}`);
      const response = await GET(request, { params: Promise.resolve({ barcode: encodedBarcode }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.barcode).toBe('4006381333931');
      expect(mockDataService.findItemByBarcode).toHaveBeenCalledWith(encodedBarcode);
    });

    it('should return 400 for barcode with invalid checksum', async () => {
      const request = new NextRequest('http://localhost:3000/api/items/barcode/4006381333930');
      const response = await GET(request, { params: Promise.resolve({ barcode: '4006381333930' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid barcode');
      expect(data.details).toContain('checksum');
    });
  });
});