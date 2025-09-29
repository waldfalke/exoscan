'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import Scanner from '@/components/Scanner'
import { ScanResult } from '@/lib/scanner'
import { InventoryItem } from '@/lib/sheets'

export default function Home() {
  const { data: session, status } = useSession()
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [spreadsheetId, setSpreadsheetId] = useState('')
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadInventory = useCallback(async () => {
    if (!spreadsheetId) return

    try {
      setLoading(true)
      setError('')
      
      const response = await fetch(`/api/inventory?spreadsheetId=${spreadsheetId}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load inventory')
      }
      
      setInventory(data.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }, [spreadsheetId])

  useEffect(() => {
    if (session && spreadsheetId) {
      loadInventory()
    }
  }, [session, spreadsheetId, loadInventory])

  const handleScan = async (result: ScanResult) => {
    setScanResult(result)
    setIsScanning(false)
    
    // Try to find existing item by scanned code
    const existingItem = inventory.find(item => 
      item.id === result.text || 
      item.name.toLowerCase().includes(result.text.toLowerCase())
    )
    
    if (existingItem) {
      // Update quantity of existing item
      await updateInventoryItem(existingItem.id, { 
        quantity: existingItem.quantity + 1 
      })
    } else {
      // Add new item
      await addInventoryItem({
        name: result.text,
        quantity: 1,
        location: 'Unknown',
        lastUpdated: new Date().toISOString(),
        scannedBy: session?.user?.email || 'unknown'
      })
    }
  }

  const addInventoryItem = async (item: Omit<InventoryItem, 'id'>) => {
    if (!spreadsheetId) return

    try {
      setLoading(true)
      
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId, item })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add item')
      }
      
      await loadInventory() // Reload inventory
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item')
    } finally {
      setLoading(false)
    }
  }

  const updateInventoryItem = async (itemId: string, updates: Partial<InventoryItem>) => {
    if (!spreadsheetId) return

    try {
      setLoading(true)
      
      const response = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId, itemId, updates })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update item')
      }
      
      await loadInventory() // Reload inventory
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">ExoScan</h1>
          <p className="mb-6">Inventory Management with Google Sheets</p>
          <button
            onClick={() => signIn('google')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">ExoScan</h1>
        <div className="flex items-center gap-4">
          <span>Welcome, {session.user?.name}</span>
          <button
            onClick={() => signOut()}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Scanner</h2>
          
          <div className="mb-4">
            <label htmlFor="spreadsheet-id" className="block text-sm font-medium mb-2">
              Google Sheets ID:
            </label>
            <input
              id="spreadsheet-id"
              type="text"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              placeholder="Enter your Google Sheets ID"
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="mb-4">
            <button
              onClick={() => setIsScanning(!isScanning)}
              disabled={!spreadsheetId}
              className={`w-full py-2 px-4 rounded-lg ${
                isScanning
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              } disabled:bg-gray-300 disabled:cursor-not-allowed`}
            >
              {isScanning ? 'Stop Scanning' : 'Start Scanning'}
            </button>
          </div>

          {spreadsheetId && (
            <Scanner
              onScan={handleScan}
              onError={(err) => setError(err.message)}
              isActive={isScanning}
            />
          )}

          {scanResult && (
            <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-md">
              <h3 className="font-semibold">Last Scan:</h3>
              <p>Text: {scanResult.text}</p>
              <p>Format: {scanResult.format}</p>
              <p>Time: {scanResult.timestamp.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Inventory Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Inventory</h2>
            <button
              onClick={loadInventory}
              disabled={!spreadsheetId || loading}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-300"
            >
              Refresh
            </button>
          </div>

          {loading && <div className="text-center py-4">Loading...</div>}

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-md text-red-700">
              {error}
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            {inventory.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No items found</p>
            ) : (
              <div className="space-y-2">
                {inventory.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{item.name}</h3>
                        <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                        <p className="text-sm text-gray-600">Location: {item.location}</p>
                      </div>
                      <div className="text-xs text-gray-500">
                        <p>Updated: {new Date(item.lastUpdated).toLocaleDateString()}</p>
                        <p>By: {item.scannedBy}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
