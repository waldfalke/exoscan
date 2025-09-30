# Настройка переменных окружения в Vercel

## 🚀 Ваше приложение развернуто!

**URL приложения:** https://exoscan-re77mw31c-waldfalkes-projects.vercel.app

## ⚙️ Настройка переменных окружения

Для корректной работы приложения необходимо настроить переменные окружения в Vercel Dashboard:

### 1. Перейдите в Vercel Dashboard
- Откройте: https://vercel.com/waldfalkes-projects/exoscan-web
- Перейдите в раздел **Settings** → **Environment Variables**

### 2. Добавьте следующие переменные:

#### Обязательные переменные:
```
NEXTAUTH_URL=https://exoscan-re77mw31c-waldfalkes-projects.vercel.app
NEXTAUTH_SECRET=your-secret-key-here-generate-random-string
NODE_ENV=production
```

#### Переменные для Google Sheets (если планируете использовать):
```
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_PRIVATE_KEY_ID=your-private-key-id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key-here\n-----END PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=your-client-id
DEFAULT_SPREADSHEET_ID=your-spreadsheet-id-here
```

#### Дополнительные переменные:
```
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Генерация NEXTAUTH_SECRET
Выполните команду для генерации секретного ключа:
```bash
openssl rand -base64 32
```

### 4. После добавления переменных
- Нажмите **Save** для каждой переменной
- Перейдите в раздел **Deployments**
- Нажмите **Redeploy** для последнего деплоя

## 📱 Тестирование на мобильном устройстве

После настройки переменных окружения:

1. Откройте на телефоне: https://exoscan-re77mw31c-waldfalkes-projects.vercel.app/login
2. Используйте ваши учетные данные:
   - Телефон: +79034571605
   - Пароль: Rebell740666

## 🔧 Возможные проблемы

### Если приложение не работает:
1. Проверьте, что все переменные окружения добавлены
2. Убедитесь, что NEXTAUTH_URL указывает на правильный домен
3. Проверьте логи в Vercel Dashboard → Functions

### Если нужно обновить код:
```bash
# В папке проекта
vercel --prod
```

## 📋 Следующие шаги

1. ✅ Приложение развернуто
2. ⏳ Настроить переменные окружения в Vercel
3. ⏳ Протестировать на мобильном устройстве
4. ⏳ Настроить Google Service Account (если нужно)

---

**Важно:** Без настройки переменных окружения приложение не будет работать корректно!