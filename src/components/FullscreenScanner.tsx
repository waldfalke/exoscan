'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ScanResult } from '@/services/scanner'
import { useScanner } from '@/hooks/useScanner'
import { BARCODE_DETECTOR_FORMATS } from '@/constants/barcodeFormats'

interface FullscreenScannerProps {
  onScan: (result: ScanResult) => void
  onClose: () => void
  onError?: (error: string) => void
}

interface FocusPoint {
  x: number
  y: number
  timestamp: number
}

export default function FullscreenScanner({ onScan, onClose, onError }: FullscreenScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [focusLocked, setFocusLocked] = useState(false)
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null)
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null)
  const [scanFeedback, setScanFeedback] = useState<string | null>(null)
  const [maxZoom] = useState(3)

  console.log('🎬 FullscreenScanner: Компонент инициализирован')

  // Используем новый хук сканера
  const {
    isInitialized,
    isScanning,
    scanningActive,
    error,
    capabilities,
    startScanning,
    stopScanning,
    toggleFlashlight,
    setZoom,
    flashlightEnabled,
    zoom
  } = useScanner({
    enableDiagnostics: true,
    formats: [...BARCODE_DETECTOR_FORMATS], // Ограничиваем только штрих-кодами товаров (без QR)
    onScanSuccess: (result) => {
      console.log('✅ FullscreenScanner: Scan result:', result)
      setScanFeedback(`✅ Найден: ${result.text}`)
      setLastScanResult(result)
      setTimeout(() => {
        onScan(result)
        onClose()
      }, 1000) // Показываем результат 1 секунду перед закрытием
    },
    onScanError: (error) => {
      console.error('❌ FullscreenScanner: Scan error:', error)
      onError?.(error.message)
    }
  })

  console.log('🎬 FullscreenScanner: useScanner состояние:', {
    isInitialized,
    isScanning,
    scannerError: error?.message,
    capabilities
  })

  // Автоматический запуск сканирования при готовности
  useEffect(() => {
    console.log('🔄 FullscreenScanner: useEffect проверка условий:', {
      isInitialized,
      hasVideoRef: !!videoRef.current,
      isScanning
    })
    
    if (isInitialized && videoRef.current && !isScanning) {
      const video = videoRef.current
      
      console.log('🔍 FullscreenScanner: Диагностика видео элемента (до запуска):', {
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        srcObject: !!video.srcObject,
        autoplay: video.autoplay,
        muted: video.muted,
        playsInline: video.playsInline
      })
      
      // Запускаем сканирование сразу - сканер сам подключит камеру
      const startScanningAsync = async () => {
        try {
          console.log('🚀 FullscreenScanner: Запуск сканирования...')
          await startScanning(video)
          console.log('✅ FullscreenScanner: Сканирование запущено успешно')
        } catch (err) {
          console.error('❌ FullscreenScanner: Ошибка запуска:', err)
          onError?.(err instanceof Error ? err.message : 'Ошибка запуска сканирования')
        }
      }

      startScanningAsync()
    }
  }, [isInitialized, isScanning]) // Убираем startScanning и onError из зависимостей

  const handleClose = useCallback(() => {
    stopScanning()
    onClose()
  }, [stopScanning, onClose])

  const handleToggleFlashlight = useCallback(async () => {
    try {
      await toggleFlashlight()
    } catch (err) {
      console.error('Flashlight error:', err)
      onError?.('Не удалось включить фонарик')
    }
  }, [toggleFlashlight, onError])

  const handleVideoClick = useCallback(async (event: React.MouseEvent<HTMLVideoElement>) => {
    if (!videoRef.current) return

    const rect = videoRef.current.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100

    setFocusPoint({ x, y })

    // Визуальная обратная связь для фокусировки (без использования неподдерживаемых ограничений)
    console.log('🎯 Фокусировка на точке:', x, y)
    setScanFeedback('🎯 Фокусировка...')
    setTimeout(() => setScanFeedback(null), 2000)

    // Убираем индикатор фокуса через 2 секунды
    setTimeout(() => setFocusPoint(null), 2000)
  }, [])

  // Handle zoom
  const handleZoom = useCallback(async (delta: number) => {
    // Проверяем что сканирование активно
    if (!isScanning) {
      console.log('⚠️ FullscreenScanner: Зум недоступен - сканирование не активно')
      return
    }

    const newZoom = Math.max(1, Math.min(maxZoom, zoom + delta))
    
    try {
      await setZoom(newZoom)
      console.log('🔍 FullscreenScanner: Зум установлен:', newZoom)
    } catch (err) {
      console.warn('⚠️ FullscreenScanner: Зум не поддерживается, используем CSS fallback:', err)
      // Fallback к CSS transform если API не поддерживается
      if (videoRef.current) {
        videoRef.current.style.transform = `scale(${newZoom})`
        console.log('🔍 FullscreenScanner: CSS зум установлен:', newZoom)
      }
    }
  }, [zoom, maxZoom, setZoom, isScanning])



  // Handle wheel zoom
  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault()
    const delta = event.deltaY > 0 ? -0.2 : 0.2
    handleZoom(delta)
  }, [handleZoom])

  // Handle video tap for focus
  const handleVideoTap = useCallback((event: React.MouseEvent<HTMLVideoElement> | React.TouchEvent<HTMLVideoElement>) => {
    event.preventDefault()
    
    let clientX: number, clientY: number
    
    if ('touches' in event && event.touches.length > 0) {
      clientX = event.touches[0].clientX
      clientY = event.touches[0].clientY
    } else if ('clientX' in event) {
      clientX = event.clientX
      clientY = event.clientY
    } else {
      return
    }

    if (!videoRef.current) return

    const rect = videoRef.current.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 100
    const y = ((clientY - rect.top) / rect.height) * 100

    setFocusPoint({ x, y })
    setFocusLocked(true)

    // Визуальная обратная связь для фокусировки (без использования неподдерживаемых ограничений)
    console.log('🎯 Фокусировка на точке:', x, y)
    setScanFeedback('🎯 Фокусировка...')
    setTimeout(() => {
      setScanFeedback(null)
      setFocusLocked(false)
    }, 2000)

    // Убираем индикатор фокуса через 2 секунды
    setTimeout(() => setFocusPoint(null), 2000)
  }, [])

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header with controls */}
      <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-4 bg-gradient-to-b from-black/50 to-transparent">
        <button
          onClick={onClose}
          className="bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-black/50 rounded-full px-3 py-2">
            <button
              onClick={() => handleZoom(-0.5)}
              disabled={zoom <= 1}
              className="text-white p-1 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-white text-sm min-w-[3rem] text-center">
              {zoom.toFixed(1)}x
            </span>
            <button
              onClick={() => handleZoom(0.5)}
              disabled={zoom >= maxZoom}
              className="text-white p-1 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Flashlight toggle */}
          {capabilities?.flashlight?.supported && (
            <button
              onClick={handleToggleFlashlight}
              className={`p-3 rounded-full transition-colors ${
                flashlightEnabled 
                  ? 'bg-yellow-500 text-black' 
                  : 'bg-black/50 text-white hover:bg-black/70'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Video container */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted
          onTouchStart={handleVideoTap}
          onClick={handleVideoTap}
          onWheel={handleWheel}
        />

        {/* Targeting frame */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Scanning area indicator */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className={`w-64 h-40 border-2 rounded-lg transition-colors ${
              scanningActive ? 'border-green-400 shadow-lg shadow-green-400/50' : 'border-white/70'
            }`}>
              {/* Corner indicators */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-l-4 border-t-4 border-white rounded-tl-lg"></div>
              <div className="absolute -top-1 -right-1 w-6 h-6 border-r-4 border-t-4 border-white rounded-tr-lg"></div>
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-l-4 border-b-4 border-white rounded-bl-lg"></div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-r-4 border-b-4 border-white rounded-br-lg"></div>
              
              {/* Scanning line animation */}
              {scanningActive && (
                <div className="absolute inset-0 overflow-hidden rounded-lg">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-green-400 animate-pulse"></div>
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-400 to-transparent animate-bounce"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Focus point indicator */}
        {focusPoint && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${focusPoint.x * 100}%`,
              top: `${focusPoint.y * 100}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className={`w-16 h-16 border-2 rounded-full transition-all duration-300 ${
              focusLocked 
                ? 'border-green-400 bg-green-400/20 scale-75' 
                : 'border-yellow-400 bg-yellow-400/20 animate-ping'
            }`}></div>
            {focusLocked && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            )}
          </div>
        )}

        {/* Scan result overlay */}
        {lastScanResult && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-xl p-6 mx-4 max-w-sm">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Код отсканирован!</h3>
                <p className="text-gray-600 mb-1">Код: {lastScanResult.text}</p>
                <p className="text-gray-600 mb-4">Формат: {lastScanResult.format}</p>
                <div className="w-full bg-green-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                </div>
                <p className="text-sm text-gray-500 mt-2">Обработка...</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom instructions */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent">
        <div className="text-center text-white">
          <p className="text-sm opacity-80">
            Наведите камеру на штрих-код • Коснитесь для фокусировки • Прокрутите для зума
          </p>
          {error && (
            <p className="text-red-400 text-sm mt-2 bg-red-900/50 rounded px-3 py-1 inline-block">
              {error.message}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}