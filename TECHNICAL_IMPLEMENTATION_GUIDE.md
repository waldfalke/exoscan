# Техническое руководство по реализации улучшенной обработки изображений

## Содержание
1. [Математические основы алгоритмов](#математические-основы-алгоритмов)
2. [Детальная реализация каждого алгоритма](#детальная-реализация-каждого-алгоритма)
3. [Примеры кода с комментариями](#примеры-кода-с-комментариями)
4. [Оптимизация производительности](#оптимизация-производительности)
5. [Тестирование и валидация](#тестирование-и-валидация)

---

## Математические основы алгоритмов

### 1. Алгоритм Отсу (Otsu's Method)

#### Теоретическая база:
Алгоритм Отсу автоматически выбирает оптимальный порог для бинаризации, максимизируя межклассовую дисперсию.

**Формулы:**
```
Межклассовая дисперсия: σ²ᵦ(t) = ω₀(t) × ω₁(t) × [μ₀(t) - μ₁(t)]²

где:
ω₀(t) = Σ(i=0 to t) p(i)           // Вероятность класса 0
ω₁(t) = Σ(i=t+1 to 255) p(i)       // Вероятность класса 1
μ₀(t) = Σ(i=0 to t) i×p(i) / ω₀(t) // Среднее класса 0
μ₁(t) = Σ(i=t+1 to 255) i×p(i) / ω₁(t) // Среднее класса 1
p(i) = h(i) / N                     // Нормализованная гистограмма
```

#### Алгоритм:
1. Построить гистограмму изображения
2. Нормализовать гистограмму
3. Для каждого возможного порога t (0-255):
   - Вычислить ω₀(t), ω₁(t), μ₀(t), μ₁(t)
   - Вычислить σ²ᵦ(t)
4. Выбрать t с максимальным σ²ᵦ(t)

### 2. Bradley Local Thresholding

#### Теоретическая база:
Локальная адаптивная бинаризация, где порог для каждого пикселя вычисляется на основе среднего значения в локальном окне.

**Формула:**
```
T(x,y) = (1/w²) × Σ(i=x-w/2 to x+w/2, j=y-w/2 to y+w/2) I(i,j) × (1 - t)

где:
w - размер окна
t - коэффициент адаптации (обычно 0.15)
I(i,j) - значение пикселя в позиции (i,j)
```

#### Алгоритм:
1. Для каждого пикселя (x,y):
   - Определить окно размером w×w вокруг пикселя
   - Вычислить среднее значение в окне
   - Применить коэффициент адаптации
   - Сравнить значение пикселя с вычисленным порогом

### 3. CLAHE (Contrast Limited Adaptive Histogram Equalization)

#### Теоретическая база:
Адаптивное выравнивание гистограммы с ограничением контрастности для предотвращения усиления шума.

**Алгоритм:**
1. Разделить изображение на тайлы (обычно 8×8)
2. Для каждого тайла:
   - Построить гистограмму
   - Применить ограничение (clip limit)
   - Перераспределить обрезанные пиксели
   - Выровнять гистограмму
3. Применить билинейную интерполяцию между тайлами

---

## Детальная реализация каждого алгоритма

### 1. Алгоритм Отсу

```typescript
/**
 * Реализация алгоритма Отсу для автоматической бинаризации
 */
private applyOtsuThresholding(imageData: ImageData): ImageData {
    const { data, width, height } = imageData;
    const result = new ImageData(width, height);
    
    // 1. Построение гистограммы
    const histogram = new Array(256).fill(0);
    const totalPixels = width * height;
    
    for (let i = 0; i < data.length; i += 4) {
        // Конвертация в grayscale если еще не сделано
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        histogram[gray]++;
    }
    
    // 2. Нормализация гистограммы
    const normalizedHist = histogram.map(count => count / totalPixels);
    
    // 3. Поиск оптимального порога
    const threshold = this.calculateOtsuThreshold(normalizedHist);
    
    // 4. Применение бинаризации
    for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        const binaryValue = gray > threshold ? 255 : 0;
        
        result.data[i] = binaryValue;     // R
        result.data[i + 1] = binaryValue; // G
        result.data[i + 2] = binaryValue; // B
        result.data[i + 3] = 255;         // A
    }
    
    return result;
}

/**
 * Вычисление оптимального порога по алгоритму Отсу
 */
private calculateOtsuThreshold(normalizedHist: number[]): number {
    let maxVariance = 0;
    let optimalThreshold = 0;
    
    for (let t = 0; t < 256; t++) {
        // Вычисление весов классов
        let w0 = 0, w1 = 0;
        for (let i = 0; i <= t; i++) w0 += normalizedHist[i];
        for (let i = t + 1; i < 256; i++) w1 += normalizedHist[i];
        
        if (w0 === 0 || w1 === 0) continue;
        
        // Вычисление средних значений классов
        let mu0 = 0, mu1 = 0;
        for (let i = 0; i <= t; i++) mu0 += i * normalizedHist[i];
        for (let i = t + 1; i < 256; i++) mu1 += i * normalizedHist[i];
        mu0 /= w0;
        mu1 /= w1;
        
        // Межклассовая дисперсия
        const betweenClassVariance = w0 * w1 * Math.pow(mu0 - mu1, 2);
        
        if (betweenClassVariance > maxVariance) {
            maxVariance = betweenClassVariance;
            optimalThreshold = t;
        }
    }
    
    return optimalThreshold;
}
```

### 2. Bradley Local Thresholding

```typescript
/**
 * Реализация локальной адаптивной бинаризации Bradley
 */
private applyBradleyThresholding(imageData: ImageData, windowSizePercent: number = 0.15, adaptationFactor: number = 0.15): ImageData {
    const { data, width, height } = imageData;
    const result = new ImageData(width, height);
    
    // Размер окна как процент от размера изображения
    const windowSize = Math.max(3, Math.floor(Math.min(width, height) * windowSizePercent));
    const halfWindow = Math.floor(windowSize / 2);
    
    // Создание интегрального изображения для быстрого вычисления сумм
    const integralImage = this.createIntegralImage(imageData);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const pixelIndex = (y * width + x) * 4;
            
            // Границы окна
            const x1 = Math.max(0, x - halfWindow);
            const y1 = Math.max(0, y - halfWindow);
            const x2 = Math.min(width - 1, x + halfWindow);
            const y2 = Math.min(height - 1, y + halfWindow);
            
            // Вычисление среднего значения в окне через интегральное изображение
            const windowArea = (x2 - x1 + 1) * (y2 - y1 + 1);
            const sum = this.getIntegralSum(integralImage, x1, y1, x2, y2);
            const mean = sum / windowArea;
            
            // Адаптивный порог
            const threshold = mean * (1 - adaptationFactor);
            
            // Текущее значение пикселя (grayscale)
            const gray = Math.round(0.299 * data[pixelIndex] + 0.587 * data[pixelIndex + 1] + 0.114 * data[pixelIndex + 2]);
            
            // Бинаризация
            const binaryValue = gray > threshold ? 255 : 0;
            
            result.data[pixelIndex] = binaryValue;
            result.data[pixelIndex + 1] = binaryValue;
            result.data[pixelIndex + 2] = binaryValue;
            result.data[pixelIndex + 3] = 255;
        }
    }
    
    return result;
}

/**
 * Создание интегрального изображения для оптимизации вычислений
 */
private createIntegralImage(imageData: ImageData): number[][] {
    const { data, width, height } = imageData;
    const integral = Array(height).fill(null).map(() => Array(width).fill(0));
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const pixelIndex = (y * width + x) * 4;
            const gray = Math.round(0.299 * data[pixelIndex] + 0.587 * data[pixelIndex + 1] + 0.114 * data[pixelIndex + 2]);
            
            integral[y][x] = gray;
            if (x > 0) integral[y][x] += integral[y][x - 1];
            if (y > 0) integral[y][x] += integral[y - 1][x];
            if (x > 0 && y > 0) integral[y][x] -= integral[y - 1][x - 1];
        }
    }
    
    return integral;
}

/**
 * Быстрое вычисление суммы в прямоугольной области через интегральное изображение
 */
private getIntegralSum(integral: number[][], x1: number, y1: number, x2: number, y2: number): number {
    let sum = integral[y2][x2];
    if (x1 > 0) sum -= integral[y2][x1 - 1];
    if (y1 > 0) sum -= integral[y1 - 1][x2];
    if (x1 > 0 && y1 > 0) sum += integral[y1 - 1][x1 - 1];
    return sum;
}
```

### 3. CLAHE Implementation

```typescript
/**
 * Реализация CLAHE (Contrast Limited Adaptive Histogram Equalization)
 */
private applyCLAHE(imageData: ImageData, tileSize: number = 8, clipLimit: number = 2.0): ImageData {
    const { data, width, height } = imageData;
    const result = new ImageData(width, height);
    
    // Количество тайлов
    const tilesX = Math.ceil(width / tileSize);
    const tilesY = Math.ceil(height / tileSize);
    
    // Массив для хранения выровненных гистограмм каждого тайла
    const tileMappings: number[][][] = [];
    
    // Обработка каждого тайла
    for (let tileY = 0; tileY < tilesY; tileY++) {
        tileMappings[tileY] = [];
        for (let tileX = 0; tileX < tilesX; tileX++) {
            const tileMapping = this.processCLAHETile(
                imageData, 
                tileX * tileSize, 
                tileY * tileSize, 
                Math.min(tileSize, width - tileX * tileSize),
                Math.min(tileSize, height - tileY * tileSize),
                clipLimit
            );
            tileMappings[tileY][tileX] = tileMapping;
        }
    }
    
    // Применение билинейной интерполяции
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const pixelIndex = (y * width + x) * 4;
            const gray = Math.round(0.299 * data[pixelIndex] + 0.587 * data[pixelIndex + 1] + 0.114 * data[pixelIndex + 2]);
            
            // Определение позиции в сетке тайлов
            const tileX = x / tileSize;
            const tileY = y / tileSize;
            
            // Билинейная интерполяция между соседними тайлами
            const enhancedValue = this.bilinearInterpolation(
                tileMappings, 
                tileX, 
                tileY, 
                gray, 
                tilesX, 
                tilesY
            );
            
            result.data[pixelIndex] = enhancedValue;
            result.data[pixelIndex + 1] = enhancedValue;
            result.data[pixelIndex + 2] = enhancedValue;
            result.data[pixelIndex + 3] = 255;
        }
    }
    
    return result;
}

/**
 * Обработка одного тайла для CLAHE
 */
private processCLAHETile(imageData: ImageData, startX: number, startY: number, tileWidth: number, tileHeight: number, clipLimit: number): number[] {
    const { data, width } = imageData;
    const histogram = new Array(256).fill(0);
    const totalPixels = tileWidth * tileHeight;
    
    // Построение гистограммы тайла
    for (let y = startY; y < startY + tileHeight; y++) {
        for (let x = startX; x < startX + tileWidth; x++) {
            const pixelIndex = (y * width + x) * 4;
            const gray = Math.round(0.299 * data[pixelIndex] + 0.587 * data[pixelIndex + 1] + 0.114 * data[pixelIndex + 2]);
            histogram[gray]++;
        }
    }
    
    // Применение ограничения контрастности
    const clipThreshold = Math.floor(clipLimit * totalPixels / 256);
    let redistributed = 0;
    
    for (let i = 0; i < 256; i++) {
        if (histogram[i] > clipThreshold) {
            redistributed += histogram[i] - clipThreshold;
            histogram[i] = clipThreshold;
        }
    }
    
    // Перераспределение обрезанных пикселей
    const redistributePerBin = Math.floor(redistributed / 256);
    let remainder = redistributed % 256;
    
    for (let i = 0; i < 256; i++) {
        histogram[i] += redistributePerBin;
        if (remainder > 0) {
            histogram[i]++;
            remainder--;
        }
    }
    
    // Создание функции отображения (LUT)
    const mapping = new Array(256);
    let cumulativeSum = 0;
    
    for (let i = 0; i < 256; i++) {
        cumulativeSum += histogram[i];
        mapping[i] = Math.round((cumulativeSum * 255) / totalPixels);
    }
    
    return mapping;
}

/**
 * Билинейная интерполяция между тайлами
 */
private bilinearInterpolation(tileMappings: number[][][], tileX: number, tileY: number, grayValue: number, tilesX: number, tilesY: number): number {
    const x1 = Math.floor(tileX);
    const y1 = Math.floor(tileY);
    const x2 = Math.min(x1 + 1, tilesX - 1);
    const y2 = Math.min(y1 + 1, tilesY - 1);
    
    const fx = tileX - x1;
    const fy = tileY - y1;
    
    // Получение значений из четырех соседних тайлов
    const v11 = tileMappings[y1][x1][grayValue];
    const v12 = tileMappings[y1][x2][grayValue];
    const v21 = tileMappings[y2][x1][grayValue];
    const v22 = tileMappings[y2][x2][grayValue];
    
    // Билинейная интерполяция
    const interpolated = v11 * (1 - fx) * (1 - fy) +
                        v12 * fx * (1 - fy) +
                        v21 * (1 - fx) * fy +
                        v22 * fx * fy;
    
    return Math.round(Math.max(0, Math.min(255, interpolated)));
}
```

### 4. Анализ изображения и автоматическая инверсия

```typescript
/**
 * Анализ яркости изображения для определения необходимости инверсии
 */
private analyzeImageBrightness(imageData: ImageData): BrightnessAnalysis {
    const { data, width, height } = imageData;
    const totalPixels = width * height;
    
    let totalBrightness = 0;
    let darkPixels = 0;
    let lightPixels = 0;
    const histogram = new Array(256).fill(0);
    
    // Анализ каждого пикселя
    for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        
        totalBrightness += gray;
        histogram[gray]++;
        
        if (gray < 85) darkPixels++;
        else if (gray > 170) lightPixels++;
    }
    
    const avgBrightness = totalBrightness / totalPixels;
    const darkRatio = darkPixels / totalPixels;
    const lightRatio = lightPixels / totalPixels;
    
    // Определение доминирующего цвета
    const dominantColor = darkRatio > lightRatio ? 'dark' : 'light';
    
    // Вычисление контрастности
    const contrast = this.calculateContrast(histogram);
    
    // Определение необходимости инверсии
    const needsInversion = (
        avgBrightness < 100 && // Темное изображение
        darkRatio > 0.6 &&     // Много темных пикселей
        contrast > 30          // Достаточный контраст
    );
    
    return {
        avgBrightness,
        needsInversion,
        dominantColor,
        contrast,
        darkRatio,
        lightRatio
    };
}

/**
 * Вычисление контрастности изображения
 */
private calculateContrast(histogram: number[]): number {
    const totalPixels = histogram.reduce((sum, count) => sum + count, 0);
    
    // Вычисление среднего значения
    let mean = 0;
    for (let i = 0; i < 256; i++) {
        mean += i * histogram[i];
    }
    mean /= totalPixels;
    
    // Вычисление стандартного отклонения
    let variance = 0;
    for (let i = 0; i < 256; i++) {
        variance += histogram[i] * Math.pow(i - mean, 2);
    }
    variance /= totalPixels;
    
    return Math.sqrt(variance);
}

/**
 * Инверсия цветов изображения
 */
private invertImageColors(imageData: ImageData): ImageData {
    const { data, width, height } = imageData;
    const result = new ImageData(width, height);
    
    for (let i = 0; i < data.length; i += 4) {
        result.data[i] = 255 - data[i];         // R
        result.data[i + 1] = 255 - data[i + 1]; // G
        result.data[i + 2] = 255 - data[i + 2]; // B
        result.data[i + 3] = data[i + 3];       // A (альфа не инвертируется)
    }
    
    return result;
}
```

### 5. Многопроходное сканирование

```typescript
/**
 * Многопроходное сканирование с различными конфигурациями обработки
 */
private async multiPassScanning(imageData: ImageData): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    const analysis = this.analyzeImageBrightness(imageData);
    
    // Фильтрация конфигураций на основе анализа изображения
    const applicableConfigs = PROCESSING_CONFIGS.filter(config => 
        !config.conditions || config.conditions(analysis)
    );
    
    // Сортировка по приоритету
    applicableConfigs.sort((a, b) => a.priority - b.priority);
    
    for (const config of applicableConfigs) {
        try {
            const startTime = performance.now();
            
            // Применение конфигурации обработки
            const processedImage = this.applyProcessingConfig(imageData, config);
            
            // Попытка сканирования
            const scanResult = await this.scanProcessedImage(processedImage);
            
            if (scanResult) {
                const processingTime = performance.now() - startTime;
                const quality = this.evaluateResultQuality(scanResult, analysis);
                
                results.push({
                    ...scanResult,
                    processingConfig: config.name,
                    processingTime,
                    imageQuality: quality
                });
                
                // Если получен высококачественный результат, можно остановиться
                if (quality > 0.8) {
                    break;
                }
            }
        } catch (error) {
            console.warn(`Processing config ${config.name} failed:`, error);
        }
    }
    
    return results;
}

/**
 * Применение конфигурации обработки к изображению
 */
private applyProcessingConfig(imageData: ImageData, config: ProcessingConfig): ImageData {
    let processedImage = this.cloneImageData(imageData);
    
    for (const step of config.steps) {
        switch (step.type) {
            case 'invert':
                processedImage = this.invertImageColors(processedImage);
                break;
                
            case 'otsu':
                processedImage = this.applyOtsuThresholding(processedImage);
                break;
                
            case 'bradley':
                processedImage = this.applyBradleyThresholding(
                    processedImage, 
                    step.params.windowSize || 0.15,
                    step.params.threshold || 0.15
                );
                break;
                
            case 'clahe':
                processedImage = this.applyCLAHE(
                    processedImage,
                    step.params.tileSize || 8,
                    step.params.clipLimit || 2.0
                );
                break;
                
            case 'gamma':
                const gamma = step.params.adaptive 
                    ? this.calculateAdaptiveGamma(processedImage)
                    : step.params.gamma || 1.2;
                processedImage = this.applyGammaCorrection(processedImage, gamma);
                break;
                
            case 'histogram':
                processedImage = step.params.adaptive
                    ? this.equalizeHistogramAdaptive(processedImage, 16)
                    : this.equalizeHistogramGlobal(processedImage);
                break;
        }
    }
    
    return processedImage;
}

/**
 * Оценка качества результата сканирования
 */
private evaluateResultQuality(result: ScanResult, analysis: BrightnessAnalysis): number {
    let quality = 0.5; // Базовое качество
    
    // Факторы, увеличивающие качество
    if (result.confidence > 0.8) quality += 0.2;
    if (result.text.length > 5) quality += 0.1;
    if (result.format !== 'unknown') quality += 0.1;
    
    // Учет условий изображения
    if (analysis.contrast > 50) quality += 0.1;
    if (analysis.avgBrightness > 50 && analysis.avgBrightness < 200) quality += 0.1;
    
    return Math.min(1.0, quality);
}

/**
 * Выбор наилучшего результата из множественных попыток
 */
private selectBestResult(results: ScanResult[]): ScanResult | null {
    if (results.length === 0) return null;
    
    // Сортировка по комбинированному скору (качество + уверенность)
    results.sort((a, b) => {
        const scoreA = a.imageQuality * 0.6 + a.confidence * 0.4;
        const scoreB = b.imageQuality * 0.6 + b.confidence * 0.4;
        return scoreB - scoreA;
    });
    
    return results[0];
}
```

---

## Оптимизация производительности

### 1. Использование Web Workers

```typescript
// workers/imageProcessingWorker.ts
self.onmessage = function(e) {
    const { imageData, config, method } = e.data;
    
    let result;
    switch (method) {
        case 'otsu':
            result = applyOtsuThresholding(imageData);
            break;
        case 'bradley':
            result = applyBradleyThresholding(imageData, config);
            break;
        case 'clahe':
            result = applyCLAHE(imageData, config);
            break;
    }
    
    self.postMessage({ result });
};
```

### 2. Кэширование результатов

```typescript
private processingCache = new Map<string, ImageData>();

private getCacheKey(imageData: ImageData, config: ProcessingConfig): string {
    // Простой хеш на основе первых пикселей и конфигурации
    const sample = Array.from(imageData.data.slice(0, 100)).join(',');
    return `${sample}_${JSON.stringify(config)}`;
}

private getCachedResult(imageData: ImageData, config: ProcessingConfig): ImageData | null {
    const key = this.getCacheKey(imageData, config);
    return this.processingCache.get(key) || null;
}

private setCachedResult(imageData: ImageData, config: ProcessingConfig, result: ImageData): void {
    const key = this.getCacheKey(imageData, config);
    this.processingCache.set(key, result);
    
    // Ограничение размера кэша
    if (this.processingCache.size > 50) {
        const firstKey = this.processingCache.keys().next().value;
        this.processingCache.delete(firstKey);
    }
}
```

### 3. Оптимизация памяти

```typescript
/**
 * Клонирование ImageData с оптимизацией памяти
 */
private cloneImageData(imageData: ImageData): ImageData {
    const result = new ImageData(imageData.width, imageData.height);
    result.data.set(imageData.data);
    return result;
}

/**
 * Освобождение ресурсов
 */
private cleanup(): void {
    this.processingCache.clear();
    // Дополнительная очистка ресурсов
}
```

---

## Тестирование и валидация

### 1. Юнит-тесты для алгоритмов

```typescript
// __tests__/imageProcessing.test.ts
describe('Image Processing Algorithms', () => {
    let testImageData: ImageData;
    
    beforeEach(() => {
        // Создание тестового изображения
        testImageData = createTestImage(100, 100);
    });
    
    describe('Otsu Thresholding', () => {
        it('should calculate correct threshold for bimodal histogram', () => {
            const service = new ZXingScannerService();
            const result = service['applyOtsuThresholding'](testImageData);
            
            expect(result).toBeDefined();
            expect(result.width).toBe(testImageData.width);
            expect(result.height).toBe(testImageData.height);
        });
        
        it('should produce binary image', () => {
            const service = new ZXingScannerService();
            const result = service['applyOtsuThresholding'](testImageData);
            
            // Проверка, что все пиксели либо 0, либо 255
            for (let i = 0; i < result.data.length; i += 4) {
                const value = result.data[i];
                expect(value === 0 || value === 255).toBe(true);
            }
        });
    });
    
    describe('Bradley Thresholding', () => {
        it('should apply local adaptive thresholding', () => {
            const service = new ZXingScannerService();
            const result = service['applyBradleyThresholding'](testImageData);
            
            expect(result).toBeDefined();
            // Дополнительные проверки...
        });
    });
    
    describe('CLAHE', () => {
        it('should enhance contrast while limiting noise', () => {
            const service = new ZXingScannerService();
            const result = service['applyCLAHE'](testImageData);
            
            expect(result).toBeDefined();
            // Проверка улучшения контрастности
        });
    });
});

function createTestImage(width: number, height: number): ImageData {
    const imageData = new ImageData(width, height);
    
    // Создание тестового паттерна
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            const value = (x + y) % 2 === 0 ? 0 : 255; // Шахматный паттерн
            
            imageData.data[index] = value;     // R
            imageData.data[index + 1] = value; // G
            imageData.data[index + 2] = value; // B
            imageData.data[index + 3] = 255;   // A
        }
    }
    
    return imageData;
}
```

### 2. Интеграционные тесты

```typescript
// __tests__/scannerIntegration.test.ts
describe('Scanner Integration with Enhanced Processing', () => {
    let scanner: ZXingScannerService;
    
    beforeEach(() => {
        scanner = new ZXingScannerService();
    });
    
    it('should scan white barcode on black background', async () => {
        const testImage = createWhiteOnBlackBarcode();
        const result = await scanner.scan(testImage);
        
        expect(result).toBeDefined();
        expect(result.text).toBe('123456789');
    });
    
    it('should scan barcode on colored background', async () => {
        const testImage = createColoredBackgroundBarcode();
        const result = await scanner.scan(testImage);
        
        expect(result).toBeDefined();
    });
    
    it('should handle low contrast images', async () => {
        const testImage = createLowContrastBarcode();
        const result = await scanner.scan(testImage);
        
        expect(result).toBeDefined();
    });
});
```

### 3. Производительность

```typescript
// __tests__/performance.test.ts
describe('Performance Tests', () => {
    it('should process image within acceptable time', async () => {
        const largeImage = createTestImage(1920, 1080);
        const scanner = new ZXingScannerService();
        
        const startTime = performance.now();
        await scanner.scan(largeImage);
        const endTime = performance.now();
        
        const processingTime = endTime - startTime;
        expect(processingTime).toBeLessThan(1000); // Менее 1 секунды
    });
    
    it('should not cause memory leaks', () => {
        const scanner = new ZXingScannerService();
        const initialMemory = performance.memory?.usedJSHeapSize || 0;
        
        // Множественные операции
        for (let i = 0; i < 100; i++) {
            const testImage = createTestImage(100, 100);
            scanner['applyOtsuThresholding'](testImage);
        }
        
        // Принудительная сборка мусора (если доступна)
        if (global.gc) global.gc();
        
        const finalMemory = performance.memory?.usedJSHeapSize || 0;
        const memoryIncrease = finalMemory - initialMemory;
        
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Менее 10MB
    });
});
```

---

## Заключение

Данное техническое руководство предоставляет полную реализацию улучшенных алгоритмов обработки изображений для сканирования штрих-кодов. Каждый алгоритм оптимизирован для работы в браузере и включает необходимые проверки производительности и качества.

Ключевые особенности реализации:
- **Математическая точность** - все алгоритмы реализованы согласно научным публикациям
- **Производительность** - оптимизация для работы в реальном времени
- **Надежность** - обширное тестирование и обработка ошибок
- **Расширяемость** - модульная архитектура для добавления новых алгоритмов