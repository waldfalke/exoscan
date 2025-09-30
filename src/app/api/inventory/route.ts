import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SheetsService } from '@/lib/sheets'

export async function GET() {
  try {
    console.log('🔍 Inventory API: Starting request')
    
    const session = await getServerSession(authOptions)
    console.log('🔐 Session check:', session?.user ? 'authenticated' : 'not authenticated')
    
    if (!session?.user) {
      console.log('❌ Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const spreadsheetId = process.env.DEFAULT_SPREADSHEET_ID
    console.log('📊 Spreadsheet ID check:', spreadsheetId ? 'configured' : 'missing')
    
    if (!spreadsheetId) {
      console.log('❌ Spreadsheet ID not configured')
      return NextResponse.json({ error: 'Spreadsheet ID not configured' }, { status: 500 })
    }

    console.log('🔧 Creating SheetsService...')
    const sheetsService = SheetsService.create()
    
    console.log('📋 Fetching inventory items...')
    const items = await sheetsService.getInventoryItems(spreadsheetId)
    
    console.log('✅ Successfully fetched', items?.length || 0, 'items')
    return NextResponse.json({ items })
  } catch (error) {
    console.error('❌ Error fetching inventory:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    })
    return NextResponse.json(
      { error: 'Failed to fetch inventory', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { item } = body

    if (!item || !item.name || item.quantity === undefined || !item.location) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const sheetsService = SheetsService.create()
    const spreadsheetId = process.env.DEFAULT_SPREADSHEET_ID
    
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Spreadsheet ID not configured' }, { status: 500 })
    }

    const newItem = {
      name: item.name,
      quantity: parseInt(item.quantity),
      location: item.location,
      lastUpdated: new Date().toISOString(),
      scannedBy: session.user.email || 'unknown'
    }

    await sheetsService.addInventoryItem(spreadsheetId, newItem)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding inventory item:', error)
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
      const { itemId, updates } = body

      if (!itemId || !updates) {
        return NextResponse.json(
          { error: 'Item ID and updates required' },
          { status: 400 }
        )
      }

      const spreadsheetId = process.env.DEFAULT_SPREADSHEET_ID
      
      if (!spreadsheetId) {
        return NextResponse.json({ error: 'Spreadsheet ID not configured' }, { status: 500 })
      }

      // Add timestamp and user info to updates
      const updatesWithMeta = {
        ...updates,
        lastUpdated: new Date().toISOString(),
        scannedBy: session.user?.email || 'unknown'
      }

      const sheetsService = SheetsService.create()
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
      const itemId = searchParams.get('itemId')

      if (!itemId) {
        return NextResponse.json(
          { error: 'Item ID required' },
          { status: 400 }
        )
      }

      const spreadsheetId = process.env.DEFAULT_SPREADSHEET_ID
      
      if (!spreadsheetId) {
        return NextResponse.json({ error: 'Spreadsheet ID not configured' }, { status: 500 })
      }

      const sheetsService = SheetsService.create()
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