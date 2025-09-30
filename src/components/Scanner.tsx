'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { barcodeScanner, ScanResult, BarcodeScanner } from '@/lib/scanner'

interface ExtendedMediaTrackConstraintSet extends MediaTrackConstraintSet {
  torch?: boolean
}

interface ScannerProps {
  onScan: (result: ScanResult) => void
  onError?: (error: Error) => void
  isActive: boolean
}

export default function Scanner({ onScan, onError, isActive }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [permissionStatus, setPermissionStatus] = useState<string>('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [scanningState, setScanningState] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle')
  const [zoomLevel, setZoomLevel] = useState(1)
  const [maxZoom] = useState(3)
  // Add flashlight state management after other state variables
  const [flashlightEnabled, setFlashlightEnabled] = useState(false)
  const [flashlightSupported, setFlashlightSupported] = useState(false)
  const [captureMode, setCaptureMode] = useState<'auto' | 'manual'>('auto')
  const [frameQuality] = useState<'good' | 'poor' | 'excellent'>('good')

  const handleError = useCallback((err: Error) => {
    console.error('Scanner error:', err)
    setError(err.message)
    setIsLoading(false)
    setScanningState('error')
    if (onError) {
      onError(err)
    }
  }, [onError])

  const handleScan = useCallback((result: ScanResult) => {
    console.log('Scan result:', result)
    setScanningState('success')
    
    // Haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100])
    }
    
    // Audio feedback
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT')
      audio.play().catch(() => {})
    } catch {
      // Audio not supported
    }

    onScan(result)
    
    // Reset state after success animation
    setTimeout(() => {
      setScanningState('idle')
    }, 2000)
  }, [onScan])

  // Toggle flashlight/torch
  const toggleFlashlight = useCallback(async () => {
    if (!flashlightSupported) {
      console.warn('Flashlight not supported on this device')
      return
    }
    
    try {
      const success = await barcodeScanner.toggleFlashlight(!flashlightEnabled)
      if (success) {
        setFlashlightEnabled(!flashlightEnabled)
        console.log('🔦 Фонарик', !flashlightEnabled ? 'включен' : 'выключен')
      } else {
        console.warn('Failed to toggle flashlight')
      }
    } catch (error) {
      console.warn('Failed to toggle flashlight:', error)
    }
  }, [flashlightEnabled, flashlightSupported])

  // Manual capture
  const handleManualCapture = useCallback(async () => {
    if (captureMode === 'manual' && videoRef.current && !isLoading) {
      try {
        setScanningState('scanning')
        setIsLoading(true)
        
        // Create a canvas to capture the current video frame
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        
        if (context && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
          canvas.width = videoRef.current.videoWidth
          canvas.height = videoRef.current.videoHeight
          
          // Draw the current video frame to canvas
          context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
          
          // Convert canvas to blob and scan
          canvas.toBlob(async (blob) => {
            if (blob) {
              try {
                const file = new File([blob], 'capture.png', { type: 'image/png' })
                const result = await barcodeScanner.scanFromImage(file)
                handleScan(result)
              } catch (error) {
                console.warn('Manual capture scan failed:', error)
                setScanningState('error')
                setTimeout(() => setScanningState('idle'), 2000)
              }
            }
          }, 'image/png')
        } else {
          throw new Error('Video not ready for capture')
        }
      } catch (error) {
        console.error('Manual capture failed:', error)
        setScanningState('error')
        setTimeout(() => setScanningState('idle'), 2000)
      } finally {
        setIsLoading(false)
      }
    }
  }, [captureMode, isLoading, handleScan])

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen)
  }, [isFullscreen])

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.5, maxZoom))
  }, [maxZoom])

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.5, 1))
  }, [])



  const checkPermissions = useCallback(async () => {
    try {
      const status = await barcodeScanner.checkCameraPermission()
      if (status.granted) {
        setPermissionStatus('Granted')
      } else if (status.denied) {
        setPermissionStatus(`Denied: ${status.error || 'Camera access blocked'}`)
      } else {
        setPermissionStatus('Prompt required')
      }
    } catch (err) {
      setPermissionStatus(`Error: ${(err as Error).message}`)
    }
  }, [])

  const loadDevices = useCallback(async () => {
    try {
      const videoDevices = await barcodeScanner.getVideoDevices()
      setDevices(videoDevices)
      if (videoDevices.length > 0 && !selectedDevice) {
        // Prefer back camera if available
        const backCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('back') ||
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment')
        )
        setSelectedDevice(backCamera?.deviceId || videoDevices[0].deviceId)
      }
    } catch (err) {
      console.error('Failed to load devices:', err)
    }
  }, [selectedDevice])

  const requestPermission = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const granted = await barcodeScanner.requestCameraPermission()
      if (granted) {
        await checkPermissions()
        await loadDevices()
      } else {
        setError('Camera permission denied. Please enable camera access in your browser settings.')
      }
    } catch (err) {
      handleError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [checkPermissions, loadDevices, handleError])

  useEffect(() => {
    checkPermissions()
    loadDevices()
  }, [checkPermissions, loadDevices])

  useEffect(() => {
    const startScanning = async () => {
      if (!isActive || !videoRef.current) {
        setScanningState('idle')
        return
      }

      console.log('🎥 Запуск сканирования...')
      console.log('📱 Информация о видео элементе:', {
        element: videoRef.current,
        tagName: videoRef.current.tagName,
        id: videoRef.current.id,
        className: videoRef.current.className,
        style: videoRef.current.style.cssText,
        attributes: Array.from(videoRef.current.attributes).map(attr => ({
          name: attr.name,
          value: attr.value
        }))
      })
      
      // Check if camera is supported and context is secure
      if (!BarcodeScanner.isCameraSupported()) {
        console.error('❌ Камера не поддерживается в этом браузере')
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        const errorMsg = isMobile 
          ? 'Камера не поддерживается в этом мобильном браузере. Попробуйте использовать Chrome или Safari.'
          : 'Camera is not supported in this browser'
        handleError(new Error(errorMsg))
        return
      }
      console.log('✅ Поддержка камеры: OK')

      if (!BarcodeScanner.isSecureContext()) {
        console.error('❌ Требуется HTTPS для доступа к камере')
        const errorMsg = window.location.protocol === 'http:' 
          ? 'Для доступа к камере на мобильных устройствах требуется HTTPS. Откройте сайт через https://'
          : 'HTTPS is required for camera access on mobile devices'
        handleError(new Error(errorMsg))
        return
      }
      console.log('✅ Безопасный контекст: OK')

      try {
        setIsLoading(true)
        setError(null)
        setScanningState('scanning')
        
        console.log('🔄 Получение доступа к камере...')
        console.log('🚀 Начинаем процесс сканирования...')
        
        await barcodeScanner.startScanning(
          videoRef.current,
          handleScan,
          handleError
        )
        
        console.log('✅ Сканирование запущено, проверяем состояние видео...')
        
        // Force video element activation on mobile devices
        if (videoRef.current) {
          try {
            const video = videoRef.current
            console.log('🎬 Принудительная активация видео элемента...')
            console.log('📺 Текущее состояние видео:', {
              readyState: video.readyState,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              paused: video.paused,
              ended: video.ended,
              muted: video.muted,
              autoplay: video.autoplay,
              playsInline: video.playsInline,
              srcObject: video.srcObject ? 'установлен' : 'не установлен'
            })
            
            const activateVideo = async () => {
               try {
                 console.log('🎮 Попытка активации видео...')
                 
                 // Wait a bit for stream to be fully set
                 await new Promise(resolve => setTimeout(resolve, 100))
                 
                 if (video.paused && video.srcObject) {
                   console.log('▶️ Запуск видео...')
                   try {
                     await video.play()
                     console.log('✅ Видео запущено успешно')
                   } catch (playError) {
                     console.warn('⚠️ Автовоспроизведение заблокировано:', playError)
                     // This is expected in many browsers - video will play when user interacts
                   }
                 } else if (!video.paused) {
                   console.log('▶️ Видео уже воспроизводится')
                 } else if (!video.srcObject) {
                   console.warn('⚠️ Нет источника видео для воспроизведения')
                 }
                 
                 // Check final state
                 setTimeout(() => {
                   console.log('📺 Финальное состояние видео:', {
                     readyState: video.readyState,
                     videoWidth: video.videoWidth,
                     videoHeight: video.videoHeight,
                     paused: video.paused,
                     currentTime: video.currentTime,
                     hasStream: !!video.srcObject
                   })
                 }, 500)
                 
               } catch (error) {
                 console.warn('⚠️ Ошибка активации видео:', error)
               }
             }
            
            // Ensure video is ready to play
            if (videoRef.current.readyState >= 2) {
              console.log('✅ Видео готово, активируем...')
              await activateVideo()
            } else {
              console.log('⏳ Ожидаем готовности видео...')
              // Wait for video to be ready
              const waitForReady = new Promise<void>((resolve) => {
                const onCanPlay = () => {
                  console.log('🎬 Событие canplay получено')
                  videoRef.current?.removeEventListener('canplay', onCanPlay)
                  activateVideo().then(() => {
                    console.log('✅ Видео активировано после загрузки')
                    resolve()
                  }).catch(err => {
                    console.warn('⚠️ Не удалось автоматически запустить видео:', err)
                    resolve()
                  })
                }
                videoRef.current?.addEventListener('canplay', onCanPlay)
                
                videoRef.current?.addEventListener('loadedmetadata', () => {
                  console.log('📊 Метаданные видео загружены:', {
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight,
                    duration: video.duration
                  })
                }, { once: true })
              })
              
              // Timeout after 3 seconds
              const timeout = new Promise<void>(resolve => {
                setTimeout(() => {
                  if (videoRef.current && videoRef.current.readyState < 2) {
                    console.warn('⏰ Таймаут ожидания готовности видео, принудительная активация...')
                    activateVideo()
                  }
                  resolve()
                }, 3000)
              })
              await Promise.race([waitForReady, timeout])
            }
          } catch (playError) {
            console.warn('⚠️ Не удалось автоматически запустить видео:', playError)
            // This is not critical, user can tap to play manually
          }
        }
        
        console.log('✅ Сканирование запущено успешно')
        
        // Check flashlight support after camera starts
        try {
          const capabilities = await barcodeScanner.checkFlashlightSupport()
          setFlashlightSupported(capabilities.supported)
          console.log('🔦 Поддержка фонарика:', capabilities.supported ? 'Да' : 'Нет')
        } catch (error) {
          console.warn('⚠️ Ошибка проверки поддержки фонарика:', error)
          setFlashlightSupported(false)
        }
        
        setIsLoading(false)
      } catch (err) {
        console.error('❌ Ошибка запуска сканирования:', err)
        handleError(err as Error)
      }
    }

    const stopScanning = () => {
      if (barcodeScanner.isCurrentlyScanning()) {
        barcodeScanner.stopScanning()
      }
      setIsLoading(false)
      setScanningState('idle')
    }

    if (isActive) {
      startScanning()
    } else {
      stopScanning()
    }

    return () => {
      stopScanning()
    }
  }, [isActive, handleScan, handleError])





  // Update video zoom when zoomLevel changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.style.transform = `scale(${zoomLevel})`
      videoRef.current.style.transformOrigin = 'center center'
    }
  }, [zoomLevel])

  const showDiagnosticInfo = async () => {
    try {
      const info = await barcodeScanner.getDiagnosticInfo()
      console.log('Diagnostic Info:', info)
      alert(`Diagnostic Information:
Camera Supported: ${info.cameraSupported}
Secure Context (HTTPS): ${info.secureContext}
Permission Status: ${info.permissionStatus.granted ? 'Granted' : info.permissionStatus.denied ? 'Denied' : 'Prompt'}
Video Devices: ${info.videoDevices.length}
User Agent: ${info.userAgent}
Platform: ${info.platform}`)
    } catch (err) {
      console.error('Failed to get diagnostic info:', err)
    }
  }

  if (!isActive) {
    return null
  }

  const ScannerContent = () => (
    <>
      {/* Camera Support Check */}
      {!BarcodeScanner.isCameraSupported() && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <p className="font-semibold">Camera Not Supported</p>
          <p className="text-sm">Your browser does not support camera access.</p>
        </div>
      )}

      {/* HTTPS Warning */}
      {!BarcodeScanner.isSecureContext() && (
        <div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
          <p className="font-semibold">HTTPS Required</p>
          <p className="text-sm">Camera access requires HTTPS on mobile devices.</p>
        </div>
      )}

      {/* Permission Status */}
      {permissionStatus.includes('Denied') && (
        <div className="mb-4 p-4 bg-orange-100 border border-orange-400 text-orange-700 rounded">
          <p className="font-semibold">Camera Permission Required</p>
          <p className="text-sm mb-2">{permissionStatus}</p>
          <button
            onClick={requestPermission}
            disabled={isLoading}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
          >
            Request Permission
          </button>
        </div>
      )}



      <div className={`relative bg-black overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50 scanner-fullscreen' : 'rounded-lg'}`}>
        {isFullscreen ? (
          /* Fullscreen HUD Controls */
          <>
            {/* Top Status Bar */}
            <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-safe-top">
              <div className="flex items-center justify-between px-4 pt-2 pb-4">
                {/* Exit Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className="hud-button hud-button-ghost"
                  aria-label="Выйти из полноэкранного режима"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Status Indicator */}
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${scanningState === 'scanning' ? 'bg-blue-400 animate-pulse' : 'bg-green-400'}`}></div>
                  <span className="text-white text-sm font-medium">
                    {scanningState === 'scanning' ? 'Сканирование' : 'Готов'}
                  </span>
                </div>

                {/* Frame Quality Indicator */}
                <div className="flex items-center gap-1">
                  {[...Array(3)].map((_, i) => {
                    const qualityLevel = frameQuality === 'poor' ? 1 : frameQuality === 'good' ? 2 : 3;
                    return (
                      <div
                        key={i}
                        className={`w-1 h-3 rounded-full ${
                          qualityLevel > i ? 'bg-green-400' : 'bg-white/30'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Side Controls */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
              {/* Flashlight Toggle */}
              {flashlightSupported && (
                <button
                  onClick={toggleFlashlight}
                  className={`hud-button ${flashlightEnabled ? 'hud-button-active' : 'hud-button-secondary'}`}
                  aria-label={flashlightEnabled ? 'Выключить фонарик' : 'Включить фонарик'}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </button>
              )}

              {/* Zoom Controls */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= maxZoom}
                  className="hud-button hud-button-secondary disabled:opacity-30"
                  aria-label="Увеличить"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
                
                <div className="hud-button hud-button-ghost text-xs font-mono">
                  {zoomLevel.toFixed(1)}x
                </div>
                
                <button
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 1}
                  className="hud-button hud-button-secondary disabled:opacity-30"
                  aria-label="Уменьшить"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Regular Mode Controls */
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
            <button
              onClick={toggleFullscreen}
              className="bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
        )}

        <video
          ref={videoRef}
          className={`w-full object-cover transition-transform duration-200 ${isFullscreen ? 'h-screen' : 'h-80 md:h-96 lg:h-[500px]'}`}
          playsInline
          muted
          controls={false}
          webkit-playsinline="true"
          onClick={async () => {
            if (videoRef.current && videoRef.current.paused && videoRef.current.srcObject) {
              try {
                console.log('👆 Пользователь кликнул на видео - активируем воспроизведение')
                await videoRef.current.play()
                console.log('✅ Видео активировано пользователем')
              } catch (error) {
                console.warn('⚠️ Не удалось активировать видео:', error)
              }
            }
          }}
          style={{ 
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center'
          }}
        />
        
        {/* Smart Reticle Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {isFullscreen ? (
            /* Fullscreen Smart Reticle */
            <>
              {/* Center Reticle */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  {/* Main scanning area */}
                  <div className={`relative w-72 h-48 transition-all duration-500 ${
                    scanningState === 'scanning' ? 'scale-105' : 'scale-100'
                  }`}>
                    {/* Animated border */}
                    <div className={`absolute inset-0 rounded-2xl border-2 transition-all duration-300 ${
                      scanningState === 'scanning' ? 'border-blue-400 shadow-lg shadow-blue-400/30 animate-pulse-glow' :
                      scanningState === 'success' ? 'border-green-400 shadow-lg shadow-green-400/50 animate-success-bounce' :
                      scanningState === 'error' ? 'border-red-400 shadow-lg shadow-red-400/30' :
                      'border-white/60'
                    }`}>
                      {/* Corner markers */}
                      <div className="absolute -top-2 -left-2 w-8 h-8 border-l-4 border-t-4 border-white rounded-tl-xl opacity-90"></div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 border-r-4 border-t-4 border-white rounded-tr-xl opacity-90"></div>
                      <div className="absolute -bottom-2 -left-2 w-8 h-8 border-l-4 border-b-4 border-white rounded-bl-xl opacity-90"></div>
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 border-r-4 border-b-4 border-white rounded-br-xl opacity-90"></div>
                    </div>

                    {/* Scanning line */}
                    {scanningState === 'scanning' && (
                      <div className="absolute inset-x-4 top-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-scan-line"></div>
                    )}

                    {/* Success checkmark */}
                    {scanningState === 'success' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-green-500/90 backdrop-blur-sm rounded-full p-4 animate-success-bounce">
                          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Center focus point */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-6 h-6 rounded-full border-2 transition-all duration-300 ${
                      scanningState === 'scanning' ? 'border-blue-400 animate-focus-ring' : 'border-white/70'
                    }`}>
                      <div className="w-full h-full rounded-full bg-white/20 animate-pulse"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom HUD Panel */}
              <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 to-transparent p-safe-bottom">
                <div className="px-6 pb-6 pt-8">
                  {/* Status Text */}
                  <div className="text-center mb-6">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      scanningState === 'scanning' ? 'bg-blue-500/80 text-white backdrop-blur-sm' :
                      scanningState === 'success' ? 'bg-green-500/80 text-white backdrop-blur-sm' :
                      scanningState === 'error' ? 'bg-red-500/80 text-white backdrop-blur-sm' :
                      'bg-white/20 text-white backdrop-blur-sm'
                    }`}>
                      {scanningState === 'scanning' && (
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      )}
                      {scanningState === 'scanning' ? 'Сканирование кода...' :
                       scanningState === 'success' ? 'Код успешно отсканирован!' :
                       scanningState === 'error' ? 'Ошибка сканирования' :
                       'Наведите камеру на штрихкод или QR-код'}
                    </div>
                  </div>

                  {/* Control Panel */}
                  <div className="flex items-center justify-center gap-6">
                    {/* Capture Mode Toggle */}
                    <button
                      onClick={() => setCaptureMode(captureMode === 'auto' ? 'manual' : 'auto')}
                      className={`hud-button ${captureMode === 'auto' ? 'hud-button-active' : 'hud-button-secondary'}`}
                      aria-label={`Режим: ${captureMode === 'auto' ? 'Автоматический' : 'Ручной'}`}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d={captureMode === 'auto' ? "M13 10V3L4 14h7v7l9-11h-7z" : "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"} />
                      </svg>
                    </button>

                    {/* Main Capture Button */}
                    <button
                      onClick={handleManualCapture}
                      disabled={captureMode === 'auto' || scanningState === 'scanning'}
                      className="hud-capture-button"
                      aria-label="Сделать снимок"
                    >
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
                        <div className={`w-12 h-12 rounded-full transition-all duration-200 ${
                          scanningState === 'scanning' ? 'bg-blue-500 animate-pulse' : 'bg-gray-800'
                        }`}>
                          {scanningState === 'scanning' ? (
                            <div className="w-full h-full rounded-full border-2 border-white animate-spin border-t-transparent"></div>
                          ) : (
                            <svg className="w-6 h-6 text-white m-auto mt-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Gallery/History Button */}
                    <button
                      className="hud-button hud-button-secondary"
                      aria-label="История сканирований"
                      onClick={() => {
                        // TODO: Implement scan history functionality
                        alert('История сканирований пока не реализована. Эта функция будет добавлена в будущих обновлениях.')
                      }}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Regular Mode Overlay */
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-48 h-32 md:w-64 md:h-40">
                <div className={`absolute inset-0 border-2 rounded-lg transition-all duration-300 ${
                  scanningState === 'scanning' ? 'border-blue-400 shadow-lg shadow-blue-400/50' :
                  scanningState === 'success' ? 'border-green-400 shadow-lg shadow-green-400/50' :
                  'border-white/70'
                }`}>
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-l-4 border-t-4 border-white rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-r-4 border-t-4 border-white rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-l-4 border-b-4 border-white rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-r-4 border-b-4 border-white rounded-br-lg"></div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {isLoading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
              <p>Starting camera...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 bg-red-500 bg-opacity-75 flex items-center justify-center">
            <div className="text-white text-center p-4">
              <p className="text-sm mb-2">{error}</p>
              <button
                onClick={showDiagnosticInfo}
                className="px-3 py-1 bg-white bg-opacity-20 text-white text-xs rounded hover:bg-opacity-30"
              >
                Show Diagnostics
              </button>
            </div>
          </div>
        )}
      </div>

      {!isFullscreen && (
        <>
          {devices.length > 1 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Camera:
              </label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 8)}...`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Or upload an image:
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={() => {}} // handleFileUpload
              className="w-full p-2 border border-gray-300 rounded-md"
              disabled={isLoading}
            />
          </div>

          {/* Diagnostic Button */}
          <div className="mt-4">
            <button
              onClick={showDiagnosticInfo}
              className="w-full px-4 py-2 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
            >
              Show Diagnostic Info
            </button>
          </div>
        </>
      )}
    </>
  )

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 bg-black' : 'w-full'}>
      <ScannerContent />
    </div>
  )
}