import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SheetsService } from '@/lib/sheets'

export async function GET(req: NextRequest) {
    try {
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { searchParams } = new URL(req.url)
      const spreadsheetId = searchParams.get('spreadsheetId')
      
      if (!spreadsheetId) {
        return NextResponse.json({ error: 'Spreadsheet ID required' }, { status: 400 })
      }

      const sheetsService = await SheetsService.fromSession()
      const items = await sheetsService.getInventoryItems(spreadsheetId)

      return NextResponse.json({ items })
    } catch (error) {
      console.error('GET /api/inventory error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch inventory' },
        { status: 500 }
      )
    }
}

export async function POST(req: NextRequest) {
    try {
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const body = await req.json()
      const { spreadsheetId, item } = body

      if (!spreadsheetId || !item) {
        return NextResponse.json(
          { error: 'Spreadsheet ID and item data required' },
          { status: 400 }
        )
      }

      // Add timestamp and user info
      const itemWithMeta = {
        ...item,
        lastUpdated: new Date().toISOString(),
        scannedBy: session.user?.email || 'unknown'
      }

      const sheetsService = await SheetsService.fromSession()
      await sheetsService.addInventoryItem(spreadsheetId, itemWithMeta)

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('POST /api/inventory error:', error)
      return NextResponse.json(
        { error: 'Failed to add inventory item' },
        { status: 500 }
      )
    }
}

export async function PUT(req: NextRequest) {
    try {
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const body = await req.json()
      const { spreadsheetId, itemId, updates } = body

      if (!spreadsheetId || !itemId || !updates) {
        return NextResponse.json(
          { error: 'Spreadsheet ID, item ID, and updates required' },
          { status: 400 }
        )
      }

      // Add timestamp and user info to updates
      const updatesWithMeta = {
        ...updates,
        lastUpdated: new Date().toISOString(),
        scannedBy: session.user?.email || 'unknown'
      }

      const sheetsService = await SheetsService.fromSession()
      await sheetsService.updateInventoryItem(spreadsheetId, itemId, updatesWithMeta)

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('PUT /api/inventory error:', error)
      return NextResponse.json(
        { error: 'Failed to update inventory item' },
        { status: 500 }
      )
    }
}

export async function DELETE(req: NextRequest) {
    try {
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { searchParams } = new URL(req.url)
      const spreadsheetId = searchParams.get('spreadsheetId')
      const itemId = searchParams.get('itemId')

      if (!spreadsheetId || !itemId) {
        return NextResponse.json(
          { error: 'Spreadsheet ID and item ID required' },
          { status: 400 }
        )
      }

      const sheetsService = await SheetsService.fromSession()
      await sheetsService.deleteInventoryItem(spreadsheetId, itemId)

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('DELETE /api/inventory error:', error)
      return NextResponse.json(
        { error: 'Failed to delete inventory item' },
        { status: 500 }
      )
    }
}