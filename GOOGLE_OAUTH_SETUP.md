# Google OAuth Setup для ExoScan

## Проблема
При попытке входа через Google появляется ошибка "400 Bad Request: redirect_uri_mismatch"

## Решение

### 1. Настройка Google Cloud Console

Перейдите в [Google Cloud Console](https://console.cloud.google.com/)

#### Шаг 1: Настройка OAuth consent screen
1. Перейдите в **APIs & Services** → **OAuth consent screen**
2. В разделе **Authorized domains** добавьте:
   - `vercel.app` (для всех Vercel доменов)
   - Ваш кастомный домен (если есть)

#### Шаг 2: Настройка Credentials
1. Перейдите в **APIs & Services** → **Credentials**
2. Найдите ваш **OAuth 2.0 Client ID** и нажмите на него
3. В разделе **Authorized JavaScript origins** добавьте:
   ```
   http://localhost:3000
   https://exoscan-g7j9buicm-waldfalkes-projects.vercel.app
   ```

4. В разделе **Authorized redirect URIs** добавьте:
   ```
   http://localhost:3000/api/auth/callback/google
   https://exoscan-g7j9buicm-waldfalkes-projects.vercel.app/api/auth/callback/google
   ```

### 2. Переменные окружения

#### Локальная разработка (.env.local):
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=development-secret-key-not-for-production
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

#### Production (Vercel):
```env
NEXTAUTH_URL=https://exoscan-g7j9buicm-waldfalkes-projects.vercel.app
NEXTAUTH_SECRET=your-production-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 3. Важные моменты

1. **Точное совпадение URL**: Google требует ТОЧНОГО совпадения redirect URI
2. **HTTPS для production**: В production используйте только HTTPS
3. **Время обновления**: Изменения в Google Cloud Console могут занять до 5-10 минут
4. **Кэш браузера**: Попробуйте приватное окно браузера

### 4. Проверка настроек

После настройки проверьте:
1. Все URL в Google Cloud Console точно совпадают с вашими доменами
2. NEXTAUTH_URL установлен правильно в Vercel
3. Приложение переразвернуто после изменения переменных окружения

### 5. Текущие URL для настройки

**Production URL**: `https://exoscan-g7j9buicm-waldfalkes-projects.vercel.app`
**Callback URL**: `https://exoscan-g7j9buicm-waldfalkes-projects.vercel.app/api/auth/callback/google`

## Команды для обновления Vercel

```bash
# Удалить старую переменную
npx vercel env rm NEXTAUTH_URL production

# Добавить новую переменную
npx vercel env add NEXTAUTH_URL production
# Ввести: https://exoscan-g7j9buicm-waldfalkes-projects.vercel.app

# Переразвернуть приложение
npx vercel --prod
```