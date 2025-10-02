'use client'

import { useState } from 'react'
import FullscreenScanner from '@/components/FullscreenScanner'
import { ScanResult } from '@/services/scanner'

export default function ScannerTestPage() {
  const [showScanner, setShowScanner] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string>('')

  const handleScan = (result: ScanResult) => {
    console.log('Scan result:', result)
    setScanResult(result)
    setShowScanner(false)
  }

  const handleScanError = (error: string) => {
    console.error('Scan error:', error)
    setError(error)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <header className="mb-8 bg-white p-6 rounded-xl shadow-sm border">
        <h1 className="text-3xl font-bold text-gray-900">Scanner Test Page</h1>
        <p className="text-gray-600 mt-2">Тестирование основного сканера с исправлениями</p>
      </header>

      <div className="max-w-2xl mx-auto">
        <div className="bg-white p-8 rounded-xl shadow-sm border">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Тест FullscreenScanner</h2>
          
          <div className="flex flex-col items-center justify-center py-12">
            <button
              onClick={() => setShowScanner(true)}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-8 rounded-2xl font-semibold text-xl transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 active:scale-95"
            >
              <div className="flex flex-col items-center gap-4">
                <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2 6h1v12H2V6zm2 0h1v12H4V6zm2 0h1v12H6V6zm3 0h1v12H9V6zm2 0h1v12h-1V6zm3 0h1v12h-1V6zm2 0h1v12h-1V6zm3 0h1v12h-1V6zm2 0h1v12h-1V6z"/>
                </svg>
                <span className="text-xl font-bold">Запустить сканер</span>
                <span className="text-sm opacity-90">Тест с исправлениями</span>
              </div>
            </button>
          </div>

          {scanResult && (
            <div className="mt-6 p-6 bg-green-50 border-2 border-green-200 rounded-xl">
              <h3 className="font-bold text-green-900 mb-3">✅ Результат сканирования:</h3>
              <p className="text-green-800 font-medium">Код: {scanResult.text}</p>
              <p className="text-green-800 font-medium">Формат: {scanResult.format}</p>
              <p className="text-green-800 font-medium">Время: {scanResult.timestamp.toLocaleString()}</p>
            </div>
          )}

          {error && (
            <div className="mt-6 p-6 bg-red-50 border-2 border-red-200 rounded-xl">
              <h3 className="font-bold text-red-900 mb-3">❌ Ошибка:</h3>
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          )}

          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-bold text-blue-900 mb-2">Исправления:</h4>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>✅ Добавлены мобильные атрибуты видео (autoplay, muted, playsInline)</li>
              <li>✅ Улучшена инициализация видео потока</li>
              <li>✅ Исправлено ожидание готовности видео (canplay + loadedmetadata)</li>
              <li>✅ Добавлена поддержка webkit-playsinline для iOS</li>
            </ul>
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