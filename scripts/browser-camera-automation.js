/**
 * Автоматизация тестирования камеры в браузере
 * Дополнение к Puppeteer-подобному функционалу
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class BrowserCameraAutomation {
    constructor() {
        this.testResults = [];
        this.logFile = path.join(__dirname, 'camera-test-results.json');
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${type}] ${message}`;
        console.log(logEntry);
        
        this.testResults.push({
            timestamp,
            type,
            message
        });
    }

    async openBrowserTest() {
        return new Promise((resolve) => {
            this.log('Открытие браузера для тестирования камеры...');
            
            // Команда для открытия браузера с тестовой страницей
            const url = 'http://localhost:3000/camera-test-simple.html';
            const command = process.platform === 'win32' 
                ? `start ${url}` 
                : process.platform === 'darwin' 
                ? `open ${url}` 
                : `xdg-open ${url}`;
            
            exec(command, (error) => {
                if (error) {
                    this.log(`Ошибка открытия браузера: ${error.message}`, 'ERROR');
                } else {
                    this.log('✅ Браузер открыт для тестирования', 'SUCCESS');
                }
                resolve(!error);
            });
        });
    }

    generateTestInstructions() {
        const instructions = `
=== ИНСТРУКЦИИ ДЛЯ РУЧНОГО ТЕСТИРОВАНИЯ КАМЕРЫ ===

1. ПРОВЕРКА ИНИЦИАЛИЗАЦИИ КАМЕРЫ:
   - Нажмите кнопку "Запустить камеру"
   - Проверьте, появляется ли видео поток
   - Убедитесь, что нет ошибок в логе

2. ТЕСТИРОВАНИЕ ОГРАНИЧЕНИЙ:
   - Нажмите кнопку "Тест ограничений"
   - Проверьте результаты для всех трех уровней:
     * Оптимальные (1920x1080, 30fps)
     * Базовые (1280x720)
     * Минимальные (только facingMode)

3. ПРОВЕРКА УСТРОЙСТВ:
   - Нажмите кнопку "Список камер"
   - Убедитесь, что отображаются доступные камеры

4. ТЕСТИРОВАНИЕ СКАНИРОВАНИЯ:
   - При активной камере поднесите QR-код или штрих-код
   - Проверьте, работает ли автофокус
   - Убедитесь в качестве изображения

5. ПРОВЕРКА СТАБИЛЬНОСТИ:
   - Оставьте камеру работать на 30 секунд
   - Проверьте отсутствие зависаний
   - Нажмите "Остановить камеру"

ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ:
✅ Камера запускается без ошибок
✅ Видео поток отображается корректно
✅ Все уровни ограничений работают
✅ Список устройств не пустой
✅ Нет ошибок в консоли браузера
✅ Камера стабильно работает

ВОЗМОЖНЫЕ ПРОБЛЕМЫ:
❌ Ошибка доступа к камере (разрешения)
❌ Неподдерживаемые ограничения
❌ Проблемы с HTTPS/безопасным контекстом
❌ Конфликты с другими приложениями
`;

        this.log('Инструкции для тестирования сгенерированы');
        return instructions;
    }

    async generateAutomationScript() {
        const script = `
// Скрипт для автоматизации тестирования в консоли браузера
// Вставьте этот код в консоль разработчика (F12)

(async function automateCameraTest() {
    console.log('🚀 Запуск автоматизированного тестирования камеры...');
    
    const results = {
        timestamp: new Date().toISOString(),
        tests: []
    };
    
    function addResult(test, status, message, data = null) {
        const result = { test, status, message, data, timestamp: new Date().toISOString() };
        results.tests.push(result);
        console.log(\`[\${status}] \${test}: \${message}\`);
        return result;
    }
    
    // Тест 1: Проверка поддержки MediaDevices
    try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            addResult('MediaDevices Support', '✅', 'getUserMedia поддерживается');
        } else {
            addResult('MediaDevices Support', '❌', 'getUserMedia не поддерживается');
            return results;
        }
    } catch (error) {
        addResult('MediaDevices Support', '❌', \`Ошибка: \${error.message}\`);
        return results;
    }
    
    // Тест 2: Перечисление устройств
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        addResult('Device Enumeration', '✅', \`Найдено \${videoDevices.length} видео устройств\`, videoDevices);
    } catch (error) {
        addResult('Device Enumeration', '❌', \`Ошибка: \${error.message}\`);
    }
    
    // Тест 3: Проверка разрешений
    try {
        const permissionStatus = await navigator.permissions.query({name: 'camera'});
        addResult('Camera Permissions', '✅', \`Статус разрешений: \${permissionStatus.state}\`, {state: permissionStatus.state});
    } catch (error) {
        addResult('Camera Permissions', '⚠️', \`Не удалось проверить разрешения: \${error.message}\`);
    }
    
    // Тест 4: Тестирование ограничений
    const constraintTests = [
        {
            name: 'Минимальные',
            constraints: { video: { facingMode: { ideal: "environment" } } }
        },
        {
            name: 'Базовые',
            constraints: { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } }
        },
        {
            name: 'Оптимальные',
            constraints: { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } } }
        }
    ];
    
    for (const test of constraintTests) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(test.constraints);
            const track = stream.getVideoTracks()[0];
            const settings = track.getSettings();
            
            addResult(\`Constraints: \${test.name}\`, '✅', \`Успешно: \${settings.width}x\${settings.height}\`, settings);
            
            // Остановка тестового потока
            stream.getTracks().forEach(track => track.stop());
        } catch (error) {
            addResult(\`Constraints: \${test.name}\`, '❌', \`Ошибка: \${error.message}\`);
        }
    }
    
    // Тест 5: Проверка безопасного контекста
    addResult('Secure Context', window.isSecureContext ? '✅' : '❌', \`Безопасный контекст: \${window.isSecureContext}\`);
    
    // Тест 6: Проверка HTTPS
    addResult('HTTPS', location.protocol === 'https:' ? '✅' : '⚠️', \`Протокол: \${location.protocol}\`);
    
    console.log('📊 Результаты тестирования:', results);
    
    // Сохранение результатов в localStorage
    localStorage.setItem('cameraTestResults', JSON.stringify(results));
    console.log('💾 Результаты сохранены в localStorage');
    
    return results;
})();
`;

        const scriptPath = path.join(__dirname, 'browser-automation-script.js');
        fs.writeFileSync(scriptPath, script);
        
        this.log(`Скрипт автоматизации сохранен: ${scriptPath}`);
        return script;
    }

    async saveResults() {
        const finalResults = {
            timestamp: new Date().toISOString(),
            testType: 'Browser Camera Automation',
            logs: this.testResults,
            instructions: this.generateTestInstructions(),
            automationScript: await this.generateAutomationScript()
        };
        
        fs.writeFileSync(this.logFile, JSON.stringify(finalResults, null, 2));
        this.log(`Результаты сохранены: ${this.logFile}`, 'SUCCESS');
        
        return finalResults;
    }

    async run() {
        this.log('Запуск автоматизации тестирования камеры в браузере...');
        
        try {
            // Открытие браузера
            await this.openBrowserTest();
            
            // Генерация инструкций
            const instructions = this.generateTestInstructions();
            console.log(instructions);
            
            // Генерация скрипта автоматизации
            await this.generateAutomationScript();
            
            // Сохранение результатов
            const results = await this.saveResults();
            
            this.log('✅ Автоматизация завершена успешно', 'SUCCESS');
            
            console.log('\\n' + '='.repeat(80));
            console.log('СЛЕДУЮЩИЕ ШАГИ:');
            console.log('1. Браузер должен открыться автоматически');
            console.log('2. Следуйте инструкциям выше для ручного тестирования');
            console.log('3. Или вставьте сгенерированный скрипт в консоль браузера (F12)');
            console.log('4. Результаты будут сохранены автоматически');
            console.log('='.repeat(80));
            
            return results;
            
        } catch (error) {
            this.log(`❌ Ошибка автоматизации: ${error.message}`, 'ERROR');
            throw error;
        }
    }
}

// Запуск автоматизации
if (require.main === module) {
    const automation = new BrowserCameraAutomation();
    automation.run()
        .then(() => {
            console.log('\\n✅ Автоматизация завершена');
            process.exit(0);
        })
        .catch(error => {
            console.error('\\n❌ Автоматизация не удалась:', error.message);
            process.exit(1);
        });
}

module.exports = BrowserCameraAutomation;