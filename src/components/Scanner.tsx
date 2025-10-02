import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useScanner } from '@/hooks/useScanner';
import { BARCODE_DETECTOR_FORMATS } from '@/constants/barcodeFormats';

type ScannerProps = {
  onScan: (text: string) => void | Promise<void>;
  onError: (error: Error) => void;
  isActive: boolean;
};

interface FocusPoint {
  x: number;
  y: number;
  timestamp: number;
}

export default function Scanner({ onScan, onError, isActive }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mountedRef = useRef<boolean>(true);

  const [focusPoint, setFocusPoint] = useState<FocusPoint | null>(null);
  const [focusLocked, setFocusLocked] = useState<boolean>(false);
  const [focusMode, setFocusMode] = useState<'auto' | 'manual'>('auto');
  const [maxZoom] = useState<number>(3);

  // Используем новый хук сканера
  const {
    isInitialized,
    isScanning,
    scanningActive,
    error,
    capabilities,
    startScanning,
    stopScanning,
    switchCamera,
    toggleFlashlight,
    setZoom,
    flashlightEnabled,
    zoom,
    availableCameras,
    currentCameraId
  } = useScanner({
    enableDiagnostics: true,
    scanInterval: 300, // Увеличенный интервал для лучшей производительности
    formats: [...BARCODE_DETECTOR_FORMATS], // Ограничиваем только штрих-кодами товаров (без QR)
    onScanSuccess: (result) => {
      console.log('✅ Scanner: Scan result:', result)
      onScan(result.text)
    },
    onScanError: (error) => {
      onError(error)
    }
  });

  // Управление активностью сканера
  useEffect(() => {
    if (!isInitialized || !videoRef.current) return;

    if (isActive && !isScanning) {
      // Запускаем сканирование
      const video = videoRef.current;
      const handleLoadedMetadata = async () => {
        try {
          await startScanning(video);
          console.log('✅ Scanner: Сканирование запущено');
        } catch (err) {
          console.error('❌ Scanner: Ошибка запуска сканирования:', err);
          onError(err instanceof Error ? err : new Error('Ошибка запуска сканирования'));
        }
      };

      if (video.readyState >= 1) {
        handleLoadedMetadata();
      } else {
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      }
    } else if (!isActive && isScanning) {
      // Останавливаем сканирование
      stopScanning();
      console.log('🛑 Scanner: Сканирование остановлено');
    }
  }, [isActive, isInitialized, isScanning, startScanning, stopScanning, onError]);

  // Обработка зума
  const handleZoomChange = useCallback(async (newZoom: number) => {
    const clampedZoom = Math.max(1, Math.min(maxZoom, newZoom));
    
    try {
      await setZoom(clampedZoom);
      console.log(`🔍 Zoom level changed to: ${clampedZoom}x`);
    } catch (err) {
      console.error('Zoom error:', err);
      // Fallback к CSS transform если API не поддерживается
      if (videoRef.current) {
        videoRef.current.style.transform = `scale(${clampedZoom})`;
      }
    }
  }, [maxZoom, setZoom]);

  // Переключение режима фокуса
  const toggleFocusMode = useCallback(() => {
    const newMode = focusMode === 'auto' ? 'manual' : 'auto';
    setFocusMode(newMode);
    
    // Очищаем точку фокуса при переключении на авто
    if (newMode === 'auto') {
      setFocusPoint(null);
      setFocusLocked(false);
    }
    
    console.log(`🎯 Focus mode changed to: ${newMode}`);
  }, [focusMode]);

  // Обработка тапа для фокуса
  const handleTapToFocus = useCallback(async (event: React.MouseEvent<HTMLVideoElement>) => {
    const video = videoRef.current;
    if (!video || !isScanning) return;

    const rect = video.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    // Устанавливаем точку фокуса (нормализованные координаты 0-1)
    const newFocusPoint: FocusPoint = {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      timestamp: Date.now()
    };

    setFocusPoint(newFocusPoint);
    setFocusLocked(true);

    console.log('🎯 Focus point set at:', { x: newFocusPoint.x, y: newFocusPoint.y });

    // Автоматически убираем фокус через 3 секунды
    setTimeout(() => {
      if (mountedRef.current) {
        setFocusLocked(false);
        setFocusPoint(null);
      }
    }, 3000);
  }, [isScanning]);

  // Переключение камеры
  const handleSwitchCamera = useCallback(async () => {
    try {
      await switchCamera();
      console.log('🔄 Camera switched');
    } catch (err) {
      console.error('Camera switch error:', err);
      onError(err instanceof Error ? err : new Error('Ошибка переключения камеры'));
    }
  }, [switchCamera, onError]);

  // Переключение фонарика
  const handleToggleFlashlight = useCallback(async () => {
    try {
      await toggleFlashlight();
      console.log('🔦 Flashlight toggled:', !flashlightEnabled);
    } catch (err) {
      console.error('Flashlight error:', err);
      onError(err instanceof Error ? err : new Error('Ошибка управления фонариком'));
    }
  }, [toggleFlashlight, flashlightEnabled, onError]);

  // Очистка при размонтировании
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScanning();
    };
  }, [stopScanning]);

  // Не рендерим компонент если он неактивен
  if (!isActive) {
    return null;
  }

  return (
    <div className="relative w-full h-full bg-black">
      {/* Видео элемент */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        autoPlay
        playsInline
        muted
        onClick={handleTapToFocus}
        data-testid="scanner-video"
      />

      {/* Индикатор сканирования с ROI рамкой */}
      {scanningActive && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Затемнение областей вне ROI */}
          <div className="absolute inset-0 bg-black/40">
            {/* Вырез для ROI области (60% от центра) */}
            <div 
              className="absolute bg-transparent border-0"
              style={{
                left: '20%',
                top: '20%', 
                width: '60%',
                height: '60%',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)'
              }}
            />
          </div>
          
          {/* ROI рамка сканирования */}
          <div 
            className="absolute border-2 border-green-400 rounded-lg"
            style={{
              left: '20%',
              top: '20%',
              width: '60%', 
              height: '60%',
              boxShadow: '0 0 20px rgba(34, 197, 94, 0.5)'
            }}
          >
            {/* Углы рамки для лучшей видимости */}
            <div className="absolute -top-1 -left-1 w-6 h-6 border-l-4 border-t-4 border-green-400 rounded-tl-lg"></div>
            <div className="absolute -top-1 -right-1 w-6 h-6 border-r-4 border-t-4 border-green-400 rounded-tr-lg"></div>
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-l-4 border-b-4 border-green-400 rounded-bl-lg"></div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-r-4 border-b-4 border-green-400 rounded-br-lg"></div>
            
            {/* Анимированная линия сканирования */}
            <div className="absolute inset-0 overflow-hidden rounded-lg">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-green-400 animate-pulse"></div>
              <div 
                className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-400 to-transparent"
                style={{
                  animation: 'scan-line 2s ease-in-out infinite alternate'
                }}
              ></div>
            </div>
            
            {/* Текст подсказки */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
              <div className="bg-green-900/80 text-green-200 px-3 py-1 rounded text-xs whitespace-nowrap">
                Наведите штрихкод в рамку
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Индикатор точки фокуса */}
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

      {/* Элементы управления */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        {/* Переключение камеры */}
        {availableCameras.length > 1 && (
          <button
            onClick={handleSwitchCamera}
            className="bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
            title="Переключить камеру"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}

        {/* Фонарик */}
        {capabilities?.flashlight?.supported && (
          <button
            onClick={handleToggleFlashlight}
            className={`p-2 rounded-full transition-colors ${
              flashlightEnabled 
                ? 'bg-yellow-500 text-black' 
                : 'bg-black/50 text-white hover:bg-black/70'
            }`}
            title="Фонарик"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </button>
        )}

        {/* Режим фокуса */}
        <button
          onClick={toggleFocusMode}
          className={`p-2 rounded-full transition-colors ${
            focusMode === 'manual' 
              ? 'bg-blue-500 text-white' 
              : 'bg-black/50 text-white hover:bg-black/70'
          }`}
          title={`Режим фокуса: ${focusMode === 'auto' ? 'Авто' : 'Ручной'}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
      </div>

      {/* Управление зумом */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
        <div className="flex items-center gap-2 bg-black/50 rounded-full px-4 py-2">
          <button
            onClick={() => handleZoomChange((zoom || 1) - 0.5)}
            disabled={(zoom || 1) <= 1}
            className="text-white p-1 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-white text-sm min-w-[3rem] text-center">
            {(zoom || 1).toFixed(1)}x
          </span>
          <button
            onClick={() => handleZoomChange((zoom || 1) + 0.5)}
            disabled={(zoom || 1) >= maxZoom}
            className="text-white p-1 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Отображение ошибок */}
      {error && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
          <div className="bg-red-900/80 text-red-200 px-4 py-2 rounded-lg text-sm max-w-xs text-center">
            {error.message}
          </div>
        </div>
      )}

      {/* Индикатор загрузки */}
      {!isInitialized && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p>Инициализация сканера...</p>
          </div>
        </div>
      )}
    </div>
  );
}