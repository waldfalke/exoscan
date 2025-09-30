import { google } from 'googleapis'
import { JWT } from 'google-auth-library'

export interface InventoryItem {
  id: string
  name: string
  quantity: number
  location: string
  lastUpdated: string
  scannedBy: string
}

export class SheetsService {
  private sheets: ReturnType<typeof google.sheets>
  
  constructor() {
    // Используем Service Account вместо OAuth
    const serviceAccountKey = {
      type: "service_account",
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.GOOGLE_CLIENT_EMAIL}`
    }

    const auth = new JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })

    this.sheets = google.sheets({ version: 'v4', auth })
  }

  static create() {
    return new SheetsService()
  }

  async getInventoryItems(spreadsheetId: string): Promise<InventoryItem[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Inventory!A2:G', // Предполагаем, что данные начинаются со 2-й строки
      })

      const rows = response.data.values || []
      return rows.map((row, index) => ({
        id: row[0] || `item-${index + 1}`,
        name: row[1] || '',
        quantity: parseInt(row[2]) || 0,
        location: row[3] || '',
        lastUpdated: row[4] || new Date().toISOString(),
        scannedBy: row[5] || 'unknown'
      }))
    } catch (error) {
      console.error('Error fetching inventory items:', error)
      throw new Error('Failed to fetch inventory items')
    }
  }

  async addInventoryItem(spreadsheetId: string, item: Omit<InventoryItem, 'id'>): Promise<void> {
    try {
      const values = [
        [
          `item-${Date.now()}`, // Генерируем ID
          item.name,
          item.quantity.toString(),
          item.location,
          item.lastUpdated,
          item.scannedBy
        ]
      ]

      await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Inventory!A:G',
        valueInputOption: 'RAW',
        requestBody: {
          values
        }
      })
    } catch (error) {
      console.error('Error adding inventory item:', error)
      throw new Error('Failed to add inventory item')
    }
  }

  async updateInventoryItem(spreadsheetId: string, itemId: string, updates: Partial<InventoryItem>): Promise<void> {
    try {
      // Сначала найдем строку с нужным ID
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Inventory!A:G',
      })

      const rows = response.data.values || []
      const rowIndex = rows.findIndex(row => row[0] === itemId)
      
      if (rowIndex === -1) {
        throw new Error('Item not found')
      }

      // Обновляем найденную строку
      const currentRow = rows[rowIndex]
      const updatedRow = [
        itemId, // ID не меняется
        updates.name ?? currentRow[1],
        updates.quantity?.toString() ?? currentRow[2],
        updates.location ?? currentRow[3],
        updates.lastUpdated ?? currentRow[4],
        updates.scannedBy ?? currentRow[5]
      ]

      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Inventory!A${rowIndex + 1}:G${rowIndex + 1}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [updatedRow]
        }
      })
    } catch (error) {
      console.error('Error updating inventory item:', error)
      throw new Error('Failed to update inventory item')
    }
  }

  async deleteInventoryItem(spreadsheetId: string, itemId: string): Promise<void> {
    try {
      // Найдем строку с нужным ID
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Inventory!A:G',
      })

      const rows = response.data.values || []
      const rowIndex = rows.findIndex(row => row[0] === itemId)
      
      if (rowIndex === -1) {
        throw new Error('Item not found')
      }

      // Удаляем строку
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: 0, // Предполагаем, что это первый лист
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1
              }
            }
          }]
        }
      })
    } catch (error) {
      console.error('Error deleting inventory item:', error)
      throw new Error('Failed to delete inventory item')
    }
  }
}