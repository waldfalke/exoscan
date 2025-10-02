// Простой тест для отладки
const fs = require('fs');
const path = require('path');

// Читаем файл и выполняем простую проверку
const filePath = path.join(__dirname, 'src', 'constants', 'barcodeFormats.ts');
const content = fs.readFileSync(filePath, 'utf8');

console.log('File exists:', fs.existsSync(filePath));
console.log('Content length:', content.length);

// Проверяем, что в файле есть нужные константы
console.log('Has PRODUCT_BARCODE_FORMATS:', content.includes('PRODUCT_BARCODE_FORMATS'));
console.log('Has BarcodeFormatUtils:', content.includes('BarcodeFormatUtils'));