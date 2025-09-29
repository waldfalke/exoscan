'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getBarcodeScanner, ScanResult } from '@/lib/scanner'

interface ScannerProps {
  onScan: (result: ScanResult) => void
  onError?: (error: Error) => void
  isActive: boolean
}

export default function Scanner({ onScan, onError, isActive }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanner] = useState(() => getBarcodeScanner())
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const loadDevices = useCallback(async () => {
    try {
      const videoDevices = await scanner.getVideoDevices()
      setDevices(videoDevices)
      
      if (videoDevices.length > 0) {
        // Prefer back camera
        const backCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('back') ||
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment')
        )
        setSelectedDevice(backCamera?.deviceId || videoDevices[0].deviceId)
      }
    } catch {
      const errorMsg = 'Failed to load camera devices'
      setError(errorMsg)
      onError?.(new Error(errorMsg))
    }
  }, [scanner, onError])

  const startScanning = useCallback(async () => {
    if (!videoRef.current) return

    try {
      setIsLoading(true)
      setError('')
      
      await scanner.startScanning(
        videoRef.current,
        (result) => {
          onScan(result)
        },
        (err) => {
          setError(err.message)
          onError?.(err)
        }
      )
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start scanner'
      setError(errorMsg)
      onError?.(new Error(errorMsg))
    } finally {
      setIsLoading(false)
    }
  }, [scanner, onScan, onError])

  const stopScanning = useCallback(() => {
    scanner.stopScanning()
  }, [scanner])

  useEffect(() => {
    loadDevices()
  }, [loadDevices])

  useEffect(() => {
    if (isActive && videoRef.current && selectedDevice) {
      startScanning()
    } else {
      stopScanning()
    }

    return () => {
      stopScanning()
    }
  }, [isActive, selectedDevice, startScanning, stopScanning])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setIsLoading(true)
      setError('')
      
      const result = await scanner.scanFromImage(file)
      onScan(result)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to scan image'
      setError(errorMsg)
      onError?.(new Error(errorMsg))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="scanner-container">
      <div className="mb-4">
        <label htmlFor="camera-select" className="block text-sm font-medium mb-2">
          Select Camera:
        </label>
        <select
          id="camera-select"
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
          disabled={isActive}
        >
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      </div>

      <div className="relative">
        <video
          ref={videoRef}
          className="w-full max-w-md mx-auto border border-gray-300 rounded-lg"
          style={{ aspectRatio: '4/3' }}
          playsInline
          muted
        />
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
            <div className="text-white">Loading...</div>
          </div>
        )}

        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
            <div className="text-gray-500">Scanner Stopped</div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded-md text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4">
        <label htmlFor="file-upload" className="block text-sm font-medium mb-2">
          Or upload an image:
        </label>
        <input
          id="file-upload"
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="w-full p-2 border border-gray-300 rounded-md"
          disabled={isLoading}
        />
      </div>
    </div>
  )
}