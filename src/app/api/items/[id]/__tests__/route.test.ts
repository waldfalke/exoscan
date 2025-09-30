/**
 * @jest-environment node
 */

// Мокаем DataService
jest.mock('@/lib/data-service');

import { NextRequest } from 'next/server';
import { GET, PUT, DELETE } from '../route';
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

describe('/api/items/[id]', () => {
  describe('GET /api/items/[id]', () => {
    it('should get item by ID', async () => {
      const mockItem = {
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
      };

      mockDataService.getItemById.mockResolvedValue(mockItem);

      const request = new NextRequest('http://localhost:3000/api/items/1');
      const response = await GET(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('1');
      expect(data.barcode).toBe('4006381333931');
      expect(data.name).toBe('Тестовый товар 1');
      expect(mockDataService.getItemById).toHaveBeenCalledWith('1');
    });

    it('should return 404 for non-existent item', async () => {
      mockDataService.getItemById.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/items/999');
      const response = await GET(request, { params: Promise.resolve({ id: '999' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Item not found');
      expect(mockDataService.getItemById).toHaveBeenCalledWith('999');
    });
  });

  describe('PUT /api/items/[id]', () => {
    it('should update existing item', async () => {
      const updateData = {
        name: 'Обновленный товар',
        price: 2000,
        quantity: 15,
      };

      const updatedItem = {
        id: '1',
        barcode: '4006381333931',
        name: 'Обновленный товар',
        description: 'Описание тестового товара',
        category: 'Электроника',
        price: 2000,
        quantity: 15,
        unit: 'шт',
        location: 'Склад А',
        supplier: 'Поставщик 1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockDataService.updateItem.mockResolvedValue(updatedItem);

      const request = new NextRequest('http://localhost:3000/api/items/1', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('1');
      expect(data.name).toBe('Обновленный товар');
      expect(data.price).toBe(2000);
      expect(data.quantity).toBe(15);
      expect(data.barcode).toBe('4006381333931');
      expect(data.updatedAt).toBeDefined();
      expect(mockDataService.updateItem).toHaveBeenCalledWith('1', updateData);
    });

    it('should return 404 when updating non-existent item', async () => {
      const updateData = {
        name: 'Несуществующий товар',
      };

      mockDataService.updateItem.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/items/999', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PUT(request, { params: Promise.resolve({ id: '999' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Item not found');
      expect(mockDataService.updateItem).toHaveBeenCalledWith('999', updateData);
    });

    it('should reject update with duplicate barcode', async () => {
      const updateData = {
        barcode: '9781234567897',
      };

      mockDataService.updateItem.mockRejectedValue(new Error('Item with this barcode already exists'));

      const request = new NextRequest('http://localhost:3000/api/items/1', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PUT(request, { params: Promise.resolve({ id: '1' }) });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('already exists');
      expect(mockDataService.updateItem).toHaveBeenCalledWith('1', updateData);
    });
  });

  describe('DELETE /api/items/[id]', () => {
    it('should delete existing item', async () => {
      mockDataService.deleteItem.mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/items/2');
      const response = await DELETE(request, { params: Promise.resolve({ id: '2' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Item deleted successfully');
      expect(data.id).toBe('2');
      expect(mockDataService.deleteItem).toHaveBeenCalledWith('2');
    });

    it('should return 404 when deleting non-existent item', async () => {
      mockDataService.deleteItem.mockResolvedValue(false);

      const request = new NextRequest('http://localhost:3000/api/items/999');
      const response = await DELETE(request, { params: Promise.resolve({ id: '999' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Item not found');
      expect(mockDataService.deleteItem).toHaveBeenCalledWith('999');
    });
  });
});