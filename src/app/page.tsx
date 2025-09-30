'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import Link from 'next/link'
import Scanner from '@/components/Scanner'
import { ScanResult } from '@/lib/scanner'
import { InventoryItem } from '@/lib/sheets'

export default function Home() {
  const { data: session, status } = useSession()
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')


  const loadInventory = useCallback(async () => {
    // Проверяем, что пользователь аутентифицирован
    if (status !== 'authenticated' || !session?.user) {
      setError('Authentication required')
      return
    }

    try {
      setLoading(true)
      setError('')
      
      const response = await fetch('/api/inventory')
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
  }, [session, status])

  useEffect(() => {
    if (session && status === 'authenticated') {
      loadInventory()
    }
  }, [session, status, loadInventory])



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
    try {
      setLoading(true)
      
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item })
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
    try {
      setLoading(true)
      
      const response = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, updates })
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
    <div className="min-h-screen bg-gray-50 p-4">
      <header className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border">
        <h1 className="text-3xl font-bold text-gray-900">ExoScan</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/camera-test"
            className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Camera Test
          </Link>
          <span className="text-gray-800 font-medium">Welcome, {session.user?.name}</span>
          <button
            onClick={() => signOut()}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Scanner Section */}
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Scanner</h2>
          
          <div className="mb-4">
            <button
              onClick={() => setIsScanning(!isScanning)}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all ${
                isScanning
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                  : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg'
              }`}
            >
              {isScanning ? 'Stop Scanning' : 'Start Scanning'}
            </button>
          </div>

          {isScanning && (
            <Scanner
              onScan={handleScan}
              onError={(err) => setError(err.message)}
              isActive={isScanning}
            />
          )}

          {scanResult && (
            <div className="mt-6 p-6 bg-green-50 border-2 border-green-200 rounded-xl">
              <h3 className="font-bold text-green-900 mb-3">Scan Result:</h3>
              <p className="text-green-800 font-medium">Code: {scanResult.text}</p>
              <p className="text-green-800 font-medium">Format: {scanResult.format}</p>
              <p className="text-green-800 font-medium">Time: {scanResult.timestamp.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Inventory Section */}
        <div className="bg-white p-8 rounded-xl shadow-sm border">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Inventory</h2>
            <button
              onClick={loadInventory}
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg disabled:bg-gray-300 disabled:shadow-none"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {loading && <div className="text-center py-4">Loading...</div>}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 text-red-800 rounded-xl font-medium">
              {error}
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            {inventory.length === 0 ? (
              <p className="text-gray-700 text-center py-12 text-lg">No items found</p>
            ) : (
              <div className="space-y-4">
                {inventory.map((item) => (
                  <div key={item.id} className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-300 transition-all bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg">{item.name}</h3>
                        <p className="text-gray-800 font-medium mt-1">Quantity: {item.quantity}</p>
                        <p className="text-gray-800 font-medium">Location: {item.location}</p>
                      </div>
                      <div className="text-sm text-gray-600 font-medium">
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
