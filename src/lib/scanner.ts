import { BrowserMultiFormatReader, Result } from '@zxing/library'

export interface ScanResult {
  text: string
  format: string
  timestamp: Date
}

export class BarcodeScanner {
  private reader: BrowserMultiFormatReader
  private isScanning: boolean = false

  constructor() {
    this.reader = new BrowserMultiFormatReader()
  }

  async startScanning(
    videoElement: HTMLVideoElement,
    onResult: (result: ScanResult) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    if (this.isScanning) {
      throw new Error('Scanner is already running')
    }

    try {
      this.isScanning = true

      // Get available video devices
      const videoInputDevices = await this.reader.listVideoInputDevices()
      
      if (videoInputDevices.length === 0) {
        throw new Error('No video input devices found')
      }

      // Prefer back camera if available
      const backCamera = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back') ||
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      )
      
      const selectedDevice = backCamera || videoInputDevices[0]

      // Start decoding from video device
      await this.reader.decodeFromVideoDevice(
        selectedDevice.deviceId,
        videoElement,
        (result: Result | null, error?: Error) => {
          if (result) {
            const scanResult: ScanResult = {
              text: result.getText(),
              format: result.getBarcodeFormat().toString(),
              timestamp: new Date()
            }
            onResult(scanResult)
          }
          
          if (error && onError) {
            onError(error)
          }
        }
      )
    } catch (error) {
      this.isScanning = false
      if (onError) {
        onError(error as Error)
      }
      throw error
    }
  }

  async scanFromImage(imageFile: File): Promise<ScanResult> {
    try {
      const result = await this.reader.decodeFromImageElement(
        await this.createImageElement(imageFile)
      )

      return {
        text: result.getText(),
        format: result.getBarcodeFormat().toString(),
        timestamp: new Date()
      }
    } catch (error) {
      throw new Error(`Failed to scan image: ${error}`)
    }
  }

  private createImageElement(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img)
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load image'))
      }
      
      img.src = url
    })
  }

  stopScanning(): void {
    if (this.isScanning) {
      this.reader.reset()
      this.isScanning = false
    }
  }

  isCurrentlyScanning(): boolean {
    return this.isScanning
  }

  async getVideoDevices(): Promise<MediaDeviceInfo[]> {
    try {
      return await this.reader.listVideoInputDevices()
    } catch (error) {
      console.error('Failed to get video devices:', error)
      return []
    }
  }
}

// Singleton instance
let scannerInstance: BarcodeScanner | null = null

export function getBarcodeScanner(): BarcodeScanner {
  if (!scannerInstance) {
    scannerInstance = new BarcodeScanner()
  }
  return scannerInstance
}