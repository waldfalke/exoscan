# Google Service Account Setup для ExoScan

Этот документ описывает настройку Google Service Account для работы с Google Sheets API без пользовательской аутентификации.

## Шаг 1: Создание Service Account

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Выберите ваш проект или создайте новый
3. Перейдите в **IAM & Admin** → **Service Accounts**
4. Нажмите **Create Service Account**
5. Заполните:
   - **Service account name**: `exoscan-sheets-service`
   - **Service account ID**: `exoscan-sheets-service`
   - **Description**: `Service account for ExoScan Google Sheets integration`
6. Нажмите **Create and Continue**

## Шаг 2: Настройка ролей

1. В разделе **Grant this service account access to project**:
   - В выпадающем списке выберите роль **Editor** (если нужно минимум прав, выберите **BigQuery Data Viewer** и **Google Sheets API User**)
2. Нажмите **Continue**
3. Пропустите раздел **Grant users access to this service account**
4. Нажмите **Done**

## Шаг 3: Создание ключа

1. В списке Service Accounts найдите созданный аккаунт
2. Нажмите на email Service Account
3. Перейдите на вкладку **Keys**
4. Нажмите **Add Key** → **Create new key**
5. Выберите тип **JSON**
6. Нажмите **Create**
7. Файл JSON будет скачан автоматически

## Шаг 4: Включение Google Sheets API

1. В Google Cloud Console перейдите в **APIs & Services** → **Library**
2. Найдите **Google Sheets API**
3. Нажмите на него и нажмите **Enable**

## Шаг 5: Настройка переменных окружения

Откройте скачанный JSON файл и скопируйте значения в ваш `.env.local`:

```env
# Google Service Account Configuration
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_PRIVATE_KEY_ID=your-private-key-id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key-here\n-----END PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=your-client-id

# Default Spreadsheet ID
DEFAULT_SPREADSHEET_ID=your-spreadsheet-id-here
```

### Важные замечания:

- **GOOGLE_PRIVATE_KEY**: Скопируйте весь private_key из JSON, включая `-----BEGIN PRIVATE KEY-----` и `-----END PRIVATE KEY-----`
- **GOOGLE_CLIENT_EMAIL**: Это email вашего Service Account (заканчивается на `.iam.gserviceaccount.com`)
- **DEFAULT_SPREADSHEET_ID**: ID вашей Google таблицы (из URL таблицы)

## Шаг 6: Предоставление доступа к Google Sheets

1. Откройте вашу Google таблицу
2. Нажмите **Share** (Поделиться)
3. Добавьте email вашего Service Account (из `GOOGLE_CLIENT_EMAIL`)
4. Установите права **Editor** или **Viewer** (в зависимости от потребностей)
5. Нажмите **Send**

## Шаг 7: Структура Google Sheets

Убедитесь, что ваша таблица имеет лист с названием **"Inventory"** и следующую структуру:

| A (ID) | B (Name) | C (Quantity) | D (Location) | E (Last Updated) | F (Scanned By) |
|--------|----------|--------------|--------------|------------------|----------------|
| item-1 | Товар 1  | 10           | Склад А      | 2024-01-01       | admin          |

## Проверка настройки

После настройки всех переменных окружения:

1. Перезапустите ваше приложение
2. Войдите в систему с учетными данными:
   - **Логин**: `+79991234567`
   - **Пароль**: `password123`
3. Попробуйте получить данные из Google Sheets через API

## Безопасность

⚠️ **Важно**: 
- Никогда не коммитьте файл JSON с ключами в репозиторий
- Храните переменные окружения в безопасном месте
- Используйте минимально необходимые права для Service Account
- Регулярно ротируйте ключи Service Account

## Troubleshooting

### Ошибка "Permission denied"
- Убедитесь, что Service Account добавлен в Google Sheets с правами Editor
- Проверьте, что Google Sheets API включен в проекте

### Ошибка "Invalid credentials"
- Проверьте правильность всех переменных окружения
- Убедитесь, что GOOGLE_PRIVATE_KEY содержит правильные переносы строк

### Ошибка "Spreadsheet not found"
- Проверьте правильность DEFAULT_SPREADSHEET_ID
- Убедитесь, что таблица существует и доступна Service Account