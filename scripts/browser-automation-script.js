
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
        console.log(`[${status}] ${test}: ${message}`);
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
        addResult('MediaDevices Support', '❌', `Ошибка: ${error.message}`);
        return results;
    }
    
    // Тест 2: Перечисление устройств
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        addResult('Device Enumeration', '✅', `Найдено ${videoDevices.length} видео устройств`, videoDevices);
    } catch (error) {
        addResult('Device Enumeration', '❌', `Ошибка: ${error.message}`);
    }
    
    // Тест 3: Проверка разрешений
    try {
        const permissionStatus = await navigator.permissions.query({name: 'camera'});
        addResult('Camera Permissions', '✅', `Статус разрешений: ${permissionStatus.state}`, {state: permissionStatus.state});
    } catch (error) {
        addResult('Camera Permissions', '⚠️', `Не удалось проверить разрешения: ${error.message}`);
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
            
            addResult(`Constraints: ${test.name}`, '✅', `Успешно: ${settings.width}x${settings.height}`, settings);
            
            // Остановка тестового потока
            stream.getTracks().forEach(track => track.stop());
        } catch (error) {
            addResult(`Constraints: ${test.name}`, '❌', `Ошибка: ${error.message}`);
        }
    }
    
    // Тест 5: Проверка безопасного контекста
    addResult('Secure Context', window.isSecureContext ? '✅' : '❌', `Безопасный контекст: ${window.isSecureContext}`);
    
    // Тест 6: Проверка HTTPS
    addResult('HTTPS', location.protocol === 'https:' ? '✅' : '⚠️', `Протокол: ${location.protocol}`);
    
    console.log('📊 Результаты тестирования:', results);
    
    // Сохранение результатов в localStorage
    localStorage.setItem('cameraTestResults', JSON.stringify(results));
    console.log('💾 Результаты сохранены в localStorage');
    
    return results;
})();
