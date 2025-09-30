import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// Конфигурация Google Sheets
const GOOGLE_SHEETS_CONFIG = {
  projectId: process.env.GOOGLE_PROJECT_ID || 'crucial-respect-457110-m0',
  privateKeyId: process.env.GOOGLE_PRIVATE_KEY_ID || 'afcb63744881382af522b2ed9d4b4e257ecb8bbc',
  privateKey: process.env.GOOGLE_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDPfUmzDerflZPp
BfGhVCt+yUvtQONqlDAig1izQYg+6pK53BpXF2rGCpDFPoNV6YbRG2J731gVT+mU
Eqd+0/59aGnvVgkXDhi34j1zu/7d5HTcWiuCZCL1eNb+A9AQ5DHyl00gG1wbTqhJ
rRIXJlFrY7OPlNi812CJuZaiJKPZb4ddzpf5EtfYGOactWcL/TTmeR83R3d/KdZF
uF92BvAiXKhGEu/Vd7PdyCdoK3ZEulPgwV7u9g8HsvnnyGseuXi3PlVlhGVzpzZn
67jKyG0JRCTmHYSVwUKMdn6H6bOfb4+J77zdUDa6MDim7Jh/3mWV+3xKb7fbIQMY
c3otF97rAgMBAAECggEAAeR8W6M9F+WU8Beta4CFNBvhDqUrTdqX+BGvwv9WyeX9
PGt8F8DvSuJn2l7ZxAV5kcJeFbHk2khg4aqjoAAWrZXRuUZdlkKMFtZZzkZWRDeG
Vb+GzRGh4swqEQxU2s7akRvKHgAWJvOcalhri7i1ld+9CAp34vP/BlKREIhpFtk+
3n+TznNoLiEuV/J7AvNABcGBIU3bY0iuheLfpTMABIcw3ibCHyKnxSvRpH4CFovf
QOfscRaiDvk4hv6zaJLUwGGaV6a6jSG3DAdLyDiQm8c1VCgf0cX9eAbc/X/+ZsOk
rinNedLWmc4UDs2rf4mdp8wdpGmfDNNTQ+8NlTKUOQKBgQDqASjmZiJpEn0b7HD+
sXh8qRDaCaJksip9XsD0CHD41NblX2nivDUY4p03DppfaLqwm976PNGtQDQOqlTG
NOffA9cS7fSlmXSuiUwH6vslyjnNNh90URugzdh9Hw7xBesMuNxJ50jEA/lvMibE
TqplaKi2IOBealOS8eQxTRGVqQKBgQDi/hiNFp+mQkNpBMuriNgZd38aP6bN4Eg/
ol/1d9g5mYyk0aoXLgbCvayU8KKrsw9E8mk/GoxxiVXge+T15OfGCOdbSG/JKZyB
f5pVRriqlZWubNx73M3QKStEZBuR1rm5iAWgxhJ1Tj3BRRhwj6+K6eJz8DtBREYg
OeUZ2+MEcwKBgQCdNlZCJJAtw2wmXH21v4nRRsy5kAt4V3LQc95ylVFA+828oJPE
7ulFZMp2+Oqh+vyiNrZhrIa6PQ48ZBc8asL1Q+E1KIVa1HRd5oQcNbSxuOGIizoq
rWtAZ8twlHM3XuCB1Zi6Vha/CmSEXk9JSAiWxO/EHOZgyFKJwNWsgbi0sQKBgQCo
puws39NMn00gmSyOTYVqHov0P7i6nFpx1T4AzsN7wGdsCk+bG1pwlKbGnqfudILy
0j16YkpZDRYeTU9Hl4TRccob240a5GzhFqLfm0UXkT5+M2n6KYtNj1kTXmHRkL27
aKHt21zZhYGCuMi40Tk3OCFFzQbprkWAKiPbe7GHmwKBgBaV2dCebUqYfae6T5W1
vipWV00dihY2Z3ZgkHV9zRo7jgW+i3/+ob1Uq/B7kPISs5OW1CHHoQ6cMSGAlC7+
SKU5DOsJz982Lf27Xhd6+BiGc9X36nRprpER5XrA6pQ3USmMp8bG87n/IzDb+dsc
K5ZNGBVeczifG7I4zsCGTXJt
-----END PRIVATE KEY-----`,
  clientEmail: process.env.GOOGLE_CLIENT_EMAIL || 'exoscan-sheets-service@crucial-respect-457110-m0.iam.gserviceaccount.com',
  clientId: process.env.GOOGLE_CLIENT_ID || '114247287195449412692',
};

// ID таблицы по умолчанию
const DEFAULT_SPREADSHEET_ID = process.env.DEFAULT_SPREADSHEET_ID || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

// Создание JWT клиента для аутентификации
function createJWTClient(): JWT {
  return new JWT({
    email: GOOGLE_SHEETS_CONFIG.clientEmail,
    key: GOOGLE_SHEETS_CONFIG.privateKey.replace(/\\n/g, '\n'),
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
}

// Создание клиента Google Sheets API
export function createSheetsClient() {
  const jwtClient = createJWTClient();
  return google.sheets({ version: 'v4', auth: jwtClient });
}

// Интерфейсы для работы с данными
export interface SheetRow {
  id: string;
  barcode: string;
  name: string;
  description?: string;
  category?: string;
  price?: number;
  quantity: number;
  unit?: string;
  location?: string;
  supplier?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SheetRange {
  range: string;
  values: string[][];
}

// Класс для работы с Google Sheets
export class GoogleSheetsAdapter {
  private sheets;
  private spreadsheetId: string;

  constructor(spreadsheetId?: string) {
    this.sheets = createSheetsClient();
    this.spreadsheetId = spreadsheetId || DEFAULT_SPREADSHEET_ID;
  }

  // Получение всех строк из листа
  async getRows(sheetName: string = 'Inventory'): Promise<SheetRow[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:L`, // Колонки A-L для всех полей
      });

      const rows = response.data.values || [];
      if (rows.length === 0) {
        return [];
      }

      // Пропускаем заголовок (первая строка)
      const dataRows = rows.slice(1);
      
      return dataRows.map((row, index) => ({
        id: row[0] || `item-${index + 1}`,
        barcode: row[1] || '',
        name: row[2] || '',
        description: row[3] || '',
        category: row[4] || '',
        price: row[5] ? parseFloat(row[5]) : 0,
        quantity: row[6] ? parseInt(row[6]) : 0,
        unit: row[7] || 'шт',
        location: row[8] || '',
        supplier: row[9] || '',
        createdAt: row[10] || new Date().toISOString(),
        updatedAt: row[11] || new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error getting rows from Google Sheets:', error);
      throw new Error('Failed to fetch data from Google Sheets');
    }
  }

  // Добавление новой строки
  async addRow(item: Omit<SheetRow, 'id'>, sheetName: string = 'Inventory'): Promise<SheetRow> {
    try {
      // Генерируем ID
      const id = `item-${Date.now()}`;
      const newItem = { id, ...item };

      const values = [
        [
          newItem.id,
          newItem.barcode,
          newItem.name,
          newItem.description || '',
          newItem.category || '',
          newItem.price?.toString() || '0',
          newItem.quantity.toString(),
          newItem.unit || 'шт',
          newItem.location || '',
          newItem.supplier || '',
          newItem.createdAt,
          newItem.updatedAt,
        ]
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:L`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });

      return newItem;
    } catch (error) {
      console.error('Error adding row to Google Sheets:', error);
      throw new Error('Failed to add item to Google Sheets');
    }
  }

  // Обновление строки по ID
  async updateRow(id: string, updates: Partial<SheetRow>, sheetName: string = 'Inventory'): Promise<SheetRow | null> {
    try {
      // Сначала найдем строку
      const rows = await this.getRows(sheetName);
      const rowIndex = rows.findIndex(row => row.id === id);
      
      if (rowIndex === -1) {
        return null;
      }

      const updatedItem = { ...rows[rowIndex], ...updates, updatedAt: new Date().toISOString() };
      
      // Обновляем строку (rowIndex + 2, так как индекс 0-based, а в Sheets нумерация с 1, плюс заголовок)
      const range = `${sheetName}!A${rowIndex + 2}:L${rowIndex + 2}`;
      
      const values = [
        [
          updatedItem.id,
          updatedItem.barcode,
          updatedItem.name,
          updatedItem.description || '',
          updatedItem.category || '',
          updatedItem.price?.toString() || '0',
          updatedItem.quantity.toString(),
          updatedItem.unit || 'шт',
          updatedItem.location || '',
          updatedItem.supplier || '',
          updatedItem.createdAt,
          updatedItem.updatedAt,
        ]
      ];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });

      return updatedItem;
    } catch (error) {
      console.error('Error updating row in Google Sheets:', error);
      throw new Error('Failed to update item in Google Sheets');
    }
  }

  // Удаление строки по ID
  async deleteRow(id: string, sheetName: string = 'Inventory'): Promise<boolean> {
    try {
      // Сначала найдем строку
      const rows = await this.getRows(sheetName);
      const rowIndex = rows.findIndex(row => row.id === id);
      
      if (rowIndex === -1) {
        return false;
      }

      // Получаем информацию о листе
      const sheetResponse = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const sheet = sheetResponse.data.sheets?.find(s => s.properties?.title === sheetName);
      if (!sheet || !sheet.properties) {
        throw new Error(`Sheet ${sheetName} not found`);
      }

      // Удаляем строку (rowIndex + 1, так как заголовок занимает первую строку)
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheet.properties.sheetId,
                  dimension: 'ROWS',
                  startIndex: rowIndex + 1, // +1 для заголовка
                  endIndex: rowIndex + 2,   // +2 для удаления одной строки
                },
              },
            },
          ],
        },
      });

      return true;
    } catch (error) {
      console.error('Error deleting row from Google Sheets:', error);
      throw new Error('Failed to delete item from Google Sheets');
    }
  }

  // Поиск строки по штрихкоду
  async findByBarcode(barcode: string, sheetName: string = 'Inventory'): Promise<SheetRow | null> {
    try {
      const rows = await this.getRows(sheetName);
      return rows.find(row => row.barcode === barcode) || null;
    } catch (error) {
      console.error('Error finding item by barcode in Google Sheets:', error);
      throw new Error('Failed to find item by barcode in Google Sheets');
    }
  }

  // Создание заголовков листа (если лист пустой)
  async createHeaders(sheetName: string = 'Inventory'): Promise<void> {
    try {
      const headers = [
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
      ];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1:L1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [headers],
        },
      });
    } catch (error) {
      console.error('Error creating headers in Google Sheets:', error);
      throw new Error('Failed to create headers in Google Sheets');
    }
  }
}

// Экспорт экземпляра адаптера по умолчанию
export const googleSheetsAdapter = new GoogleSheetsAdapter();