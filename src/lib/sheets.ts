import { google } from 'googleapis'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

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
  
  constructor(accessToken: string) {
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    this.sheets = google.sheets({ version: 'v4', auth })
  }

  static async fromSession() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.accessToken) {
      throw new Error('No access token available')
    }
    return new SheetsService(session.user.accessToken)
  }

  async getInventoryItems(spreadsheetId: string, range: string = 'A:F'): Promise<InventoryItem[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      })

      const rows = response.data.values || []
      if (rows.length === 0) return []

      // Skip header row
      return rows.slice(1).map((row: string[], index: number) => ({
        id: row[0] || `item_${index}`,
        name: row[1] || '',
        quantity: parseInt(row[2]) || 0,
        location: row[3] || '',
        lastUpdated: row[4] || new Date().toISOString(),
        scannedBy: row[5] || ''
      }))
    } catch (error) {
      console.error('Error reading from sheets:', error)
      throw new Error('Failed to read inventory data')
    }
  }

  async addInventoryItem(
    spreadsheetId: string, 
    item: Omit<InventoryItem, 'id'>,
    range: string = 'A:F'
  ): Promise<void> {
    try {
      const values = [
        [
          `item_${Date.now()}`,
          item.name,
          item.quantity,
          item.location,
          item.lastUpdated,
          item.scannedBy
        ]
      ]

      await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: { values }
      })
    } catch (error) {
      console.error('Error adding to sheets:', error)
      throw new Error('Failed to add inventory item')
    }
  }

  async updateInventoryItem(
    spreadsheetId: string,
    itemId: string,
    updates: Partial<InventoryItem>,
    range: string = 'A:F'
  ): Promise<void> {
    try {
      // First, find the row with the matching ID
      const items = await this.getInventoryItems(spreadsheetId, range)
      const itemIndex = items.findIndex(item => item.id === itemId)
      
      if (itemIndex === -1) {
        throw new Error('Item not found')
      }

      const rowNumber = itemIndex + 2 // +1 for header, +1 for 0-based index
      const updatedItem = { ...items[itemIndex], ...updates }

      const values = [
        [
          updatedItem.id,
          updatedItem.name,
          updatedItem.quantity,
          updatedItem.location,
          updatedItem.lastUpdated,
          updatedItem.scannedBy
        ]
      ]

      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `A${rowNumber}:F${rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: { values }
      })
    } catch (error) {
      console.error('Error updating sheets:', error)
      throw new Error('Failed to update inventory item')
    }
  }

  async deleteInventoryItem(
    spreadsheetId: string,
    itemId: string,
    range: string = 'A:F'
  ): Promise<void> {
    try {
      const items = await this.getInventoryItems(spreadsheetId, range)
      const itemIndex = items.findIndex(item => item.id === itemId)
      
      if (itemIndex === -1) {
        throw new Error('Item not found')
      }

      const rowNumber = itemIndex + 2 // +1 for header, +1 for 0-based index

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: 0, // Assuming first sheet
                  dimension: 'ROWS',
                  startIndex: rowNumber - 1,
                  endIndex: rowNumber
                }
              }
            }
          ]
        }
      })
    } catch (error) {
      console.error('Error deleting from sheets:', error)
      throw new Error('Failed to delete inventory item')
    }
  }
}