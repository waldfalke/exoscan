/** @jest-environment node */

import { GoogleSheetsAdapter } from '../google-sheets';
import { google } from 'googleapis';

// Мокаем googleapis
jest.mock('googleapis', () => ({
  google: {
    sheets: jest.fn(() => ({
      spreadsheets: {
        values: {
          get: jest.fn(),
          append: jest.fn(),
          update: jest.fn(),
        },
        get: jest.fn(),
        batchUpdate: jest.fn(),
      },
    })),
  },
}));

jest.mock('google-auth-library', () => ({
  JWT: jest.fn().mockImplementation(() => ({})),
}));

describe('GoogleSheetsAdapter', () => {
  let adapter: GoogleSheetsAdapter;
  let mockSheets: jest.Mocked<{
    spreadsheets: {
      values: {
        get: jest.Mock;
        append: jest.Mock;
        update: jest.Mock;
      };
      get: jest.Mock;
      batchUpdate: jest.Mock;
    };
  }>;

  beforeEach(() => {
    // Очищаем все моки
    jest.clearAllMocks();
    
    // Создаем мок для sheets API
    mockSheets = {
      spreadsheets: {
        values: {
          get: jest.fn(),
          append: jest.fn(),
          update: jest.fn(),
        },
        get: jest.fn(),
        batchUpdate: jest.fn(),
      },
    };
    
    (google.sheets as jest.Mock).mockReturnValue(mockSheets);
    
    adapter = new GoogleSheetsAdapter('test-spreadsheet-id');
  });

  describe('getRows', () => {
    it('should return empty array when no data', async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [] },
      });

      const result = await adapter.getRows();
      expect(result).toEqual([]);
    });

    it('should return parsed rows when data exists', async () => {
      const mockData = [
        ['ID', 'Barcode', 'Name', 'Description', 'Category', 'Price', 'Quantity', 'Unit', 'Location', 'Supplier', 'Created At', 'Updated At'],
        ['item-1', '1234567890123', 'Test Item', 'Test Description', 'Electronics', '99.99', '10', 'шт', 'A1', 'Test Supplier', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z'],
        ['item-2', '9876543210987', 'Another Item', '', 'Books', '19.99', '5', 'шт', 'B2', '', '2023-01-02T00:00:00Z', '2023-01-02T00:00:00Z'],
      ];

      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: mockData },
      });

      const result = await adapter.getRows();
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'item-1',
        barcode: '1234567890123',
        name: 'Test Item',
        description: 'Test Description',
        category: 'Electronics',
        price: 99.99,
        quantity: 10,
        unit: 'шт',
        location: 'A1',
        supplier: 'Test Supplier',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      });
    });

    it('should handle API errors', async () => {
      mockSheets.spreadsheets.values.get.mockRejectedValue(new Error('API Error'));

      await expect(adapter.getRows()).rejects.toThrow('Failed to fetch data from Google Sheets');
    });
  });

  describe('addRow', () => {
    it('should add new row successfully', async () => {
      mockSheets.spreadsheets.values.append.mockResolvedValue({});

      const newItem = {
        barcode: '1234567890123',
        name: 'New Item',
        description: 'New Description',
        category: 'Electronics',
        price: 99.99,
        quantity: 10,
        unit: 'шт',
        location: 'A1',
        supplier: 'Test Supplier',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const result = await adapter.addRow(newItem);
      
      expect(result.id).toMatch(/^item-\d+$/);
      expect(result.barcode).toBe(newItem.barcode);
      expect(result.name).toBe(newItem.name);
      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        range: 'Inventory!A:L',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            result.id,
            newItem.barcode,
            newItem.name,
            newItem.description,
            newItem.category,
            newItem.price.toString(),
            newItem.quantity.toString(),
            newItem.unit,
            newItem.location,
            newItem.supplier,
            newItem.createdAt,
            newItem.updatedAt,
          ]],
        },
      });
    });

    it('should handle API errors when adding row', async () => {
      mockSheets.spreadsheets.values.append.mockRejectedValue(new Error('API Error'));

      const newItem = {
        barcode: '1234567890123',
        name: 'New Item',
        quantity: 10,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      await expect(adapter.addRow(newItem)).rejects.toThrow('Failed to add item to Google Sheets');
    });
  });

  describe('updateRow', () => {
    it('should update existing row successfully', async () => {
      const mockData = [
        ['ID', 'Barcode', 'Name', 'Description', 'Category', 'Price', 'Quantity', 'Unit', 'Location', 'Supplier', 'Created At', 'Updated At'],
        ['item-1', '1234567890123', 'Test Item', 'Test Description', 'Electronics', '99.99', '10', 'шт', 'A1', 'Test Supplier', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z'],
      ];

      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: mockData },
      });
      mockSheets.spreadsheets.values.update.mockResolvedValue({});

      const updates = { name: 'Updated Item', quantity: 15 };
      const result = await adapter.updateRow('item-1', updates);
      
      expect(result).toBeTruthy();
      expect(result!.name).toBe('Updated Item');
      expect(result!.quantity).toBe(15);
      expect(mockSheets.spreadsheets.values.update).toHaveBeenCalled();
    });

    it('should return null for non-existent item', async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['ID', 'Barcode', 'Name']] }, // Только заголовки
      });

      const result = await adapter.updateRow('non-existent', { name: 'Updated' });
      expect(result).toBeNull();
    });
  });

  describe('deleteRow', () => {
    it('should delete existing row successfully', async () => {
      const mockData = [
        ['ID', 'Barcode', 'Name'],
        ['item-1', '1234567890123', 'Test Item'],
      ];

      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: mockData },
      });
      
      mockSheets.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [{
            properties: {
              title: 'Inventory',
              sheetId: 0,
            },
          }],
        },
      });
      
      mockSheets.spreadsheets.batchUpdate.mockResolvedValue({});

      const result = await adapter.deleteRow('item-1');
      
      expect(result).toBe(true);
      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: 0,
                dimension: 'ROWS',
                startIndex: 1,
                endIndex: 2,
              },
            },
          }],
        },
      });
    });

    it('should return false for non-existent item', async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['ID', 'Barcode', 'Name']] }, // Только заголовки
      });

      const result = await adapter.deleteRow('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('findByBarcode', () => {
    it('should find item by barcode', async () => {
      const mockData = [
        ['ID', 'Barcode', 'Name'],
        ['item-1', '1234567890123', 'Test Item'],
        ['item-2', '9876543210987', 'Another Item'],
      ];

      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: mockData },
      });

      const result = await adapter.findByBarcode('1234567890123');
      
      expect(result).toBeTruthy();
      expect(result!.id).toBe('item-1');
      expect(result!.barcode).toBe('1234567890123');
      expect(result!.name).toBe('Test Item');
    });

    it('should return null for non-existent barcode', async () => {
      const mockData = [
        ['ID', 'Barcode', 'Name'],
        ['item-1', '1234567890123', 'Test Item'],
      ];

      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: mockData },
      });

      const result = await adapter.findByBarcode('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('createHeaders', () => {
    it('should create headers successfully', async () => {
      mockSheets.spreadsheets.values.update.mockResolvedValue({});

      await adapter.createHeaders();
      
      expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        range: 'Inventory!A1:L1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            'ID',
            'Barcode',
            'Name',
            'Description',
            'Category',
            'Price',
            'Quantity',
            'Unit',
            'Location',
            'Supplier',
            'Created At',
            'Updated At',
          ]],
        },
      });
    });

    it('should handle API errors when creating headers', async () => {
      mockSheets.spreadsheets.values.update.mockRejectedValue(new Error('API Error'));

      await expect(adapter.createHeaders()).rejects.toThrow('Failed to create headers in Google Sheets');
    });
  });
});