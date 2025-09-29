# Настройка переменных окружения в Vercel

## Проблема
В Vercel установлены неправильные значения переменных окружения:
- `NEXTAUTH_URL` = "" (пустое значение)
- `GOOGLE_CLIENT_ID` = "your-google-client-id\r\n" (placeholder)
- `GOOGLE_CLIENT_SECRET` = "your-google-client-secret\r\n" (placeholder)

## Решение

### 1. Обновить NEXTAUTH_URL
```bash
npx vercel env rm NEXTAUTH_URL production
npx vercel env add NEXTAUTH_URL production
# Ввести: https://exoscan-g7j9buicm-waldfalkes-projects.vercel.app
```

### 2. Обновить Google OAuth credentials
Нужно получить реальные значения из Google Cloud Console:

```bash
# Удалить старые значения
npx vercel env rm GOOGLE_CLIENT_ID production
npx vercel env rm GOOGLE_CLIENT_SECRET production

# Добавить новые значения
npx vercel env add GOOGLE_CLIENT_ID production
npx vercel env add GOOGLE_CLIENT_SECRET production
```

### 3. Настройка Google Cloud Console
1. Перейти в [Google Cloud Console](https://console.cloud.google.com/)
2. Выбрать проект или создать новый
3. Включить Google+ API
4. Создать OAuth 2.0 Client ID:
   - Application type: Web application
   - Authorized JavaScript origins:
     - `https://exoscan-g7j9buicm-waldfalkes-projects.vercel.app`
     - `http://localhost:3000`
   - Authorized redirect URIs:
     - `https://exoscan-g7j9buicm-waldfalkes-projects.vercel.app/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google`

### 4. После обновления переменных
```bash
npx vercel --prod
```

## Важные замечания
- URL должен точно совпадать с тем, что указан в Google Cloud Console
- Не должно быть лишних символов типа `\r\n`
- NEXTAUTH_URL должен быть полным URL с протоколом https://