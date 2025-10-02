'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import FullscreenScanner from '@/components/FullscreenScanner'
import { ScanResult } from '@/services/scanner'
import { InventoryItem } from '@/lib/sheets'
import { useScanner } from '@/hooks/useScanner'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [showScanner, setShowScanner] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Scanner hook for image upload functionality
  const { scanFromImage } = useScanner()


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
    setShowScanner(false)
    
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

  const handleScanError = (error: string) => {
    setError(error)
    console.error('Ошибка сканирования:', error)
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setError('')
      const result = await scanFromImage(file)
      if (result) {
        await handleScan(result)
      } else {
        setError('Не удалось распознать штрих-код на изображении')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при сканировании изображения')
    }
    
    // Reset file input
    event.target.value = ''
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
    // Перенаправляем на страницу логина вместо показа промежуточного экрана
    router.push('/login')
    return null // Не рендерим ничего во время редиректа
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
        <div className="bg-white p-8 rounded-xl shadow-sm border">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Сканер штрих-кодов</h2>
          
          {/* Large scan button */}
          <div className="flex flex-col items-center justify-center py-12">
            <button
              onClick={() => setShowScanner(true)}
              className="group relative bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-8 rounded-2xl font-semibold text-xl transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 active:scale-95"
            >
              <div className="flex flex-col items-center gap-4">
                {/* Barcode icon */}
                <div className="relative">
                  <svg className="w-16 h-16 group-hover:scale-110 transition-transform duration-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2 6h1v12H2V6zm2 0h1v12H4V6zm2 0h1v12H6V6zm3 0h1v12H9V6zm2 0h1v12h-1V6zm3 0h1v12h-1V6zm2 0h1v12h-1V6zm3 0h1v12h-1V6zm2 0h1v12h-1V6z"/>
                  </svg>
                  <div className="absolute inset-0 bg-white/20 rounded-lg animate-pulse"></div>
                </div>
                <span className="text-xl font-bold">Сканировать код</span>
                <span className="text-sm opacity-90">Нажмите для запуска камеры</span>
              </div>
              
              {/* Animated border */}
              <div className="absolute inset-0 rounded-2xl border-2 border-white/30 group-hover:border-white/50 transition-colors duration-300"></div>
            </button>
            
            {/* Image upload button */}
            <div className="mt-6">
              <label className="group relative bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 cursor-pointer inline-flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Загрузить изображение</span>
              </label>
              <p className="text-sm text-gray-600 mt-2 text-center">Выберите изображение со штрих-кодом</p>
            </div>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          )}

          {scanResult && (
            <div className="mt-6 p-6 bg-green-50 border-2 border-green-200 rounded-xl">
              <h3 className="font-bold text-green-900 mb-3">Результат сканирования:</h3>
              <p className="text-green-800 font-medium">Код: {scanResult.text}</p>
              <p className="text-green-800 font-medium">Формат: {scanResult.format}</p>
              <p className="text-green-800 font-medium">Время: {scanResult.timestamp.toLocaleString()}</p>
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

      {/* Fullscreen Scanner */}
      {showScanner && (
        <FullscreenScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
          onError={handleScanError}
        />
      )}
    </div>
  )
}
