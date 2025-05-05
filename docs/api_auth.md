# Аутентификация Escrow API (escrow-api)

## Назначение
Документ описывает текущую схему аутентификации и авторизации для микросервиса **escrow-api** после миграции на централизованный Auth-Service и Nginx API Gateway. Сервис больше **не** валидирует JWT самостоятельно — проверка выполняется Auth-Service, а Nginx передаёт результат в заголовке `X-User-Id`.

## Жизненный цикл токенов
| Тип | Хранение | TTL | Использование |
|-----|----------|-----|---------------|
| **Access Token** (JWT) | Передаётся клиентом в `Authorization: Bearer <token>`; не хранится на сервере | 15 мин | Доступ к защищённым эндпоинтам через Nginx |
| **Refresh Token** (hex) | HTTP-only cookie `refresh_token`, хеш хранится в БД `auth_tokens` | 30 дней | Получение новой пары токенов |

> Генерация, валидация и ротация токенов реализована в Auth-Service (см. `docs/auth-service-api.md`). Ниже приведены только публичные эндпоинты, доступные фронтенду.

## Публичные эндпоинты аутентификации

### 1 · `POST /api/auth/login`
Аутентифицирует пользователя и возвращает **access token**. Дополнительно устанавливается cookie `refresh_token`.

**Тело запроса**
```json
{
  "email": "user@example.com",
  "password": "••••••"
}
```

**Ответ 200**
```json
{
  "userId": "<uuid>",
  "email": "user@example.com",
  "accessToken": "<jwt>"
}
```

### 2 · `PUT /api/auth/refresh`
Обновляет пару токенов по действительному `refresh_token` (cookie).

**Ответ 200**
```json
{
  "accessToken": "<new jwt>"
}
```

### 3 · `DELETE /api/auth/logout`
Инвалидирует `refresh_token` и удаляет cookie.

**Ответ 200**
```json
{ "success": true }
```

## Защищённые эндпоинты Escrow API
Все маршруты `/api/**` обрабатываются правилом Nginx
```nginx
location /api/ {
  auth_request /auth/validate;               # проверка JWT
  auth_request_set $user_id $upstream_http_x_user_id;
  proxy_pass http://escrow_api;              # проксирование к сервису
  proxy_set_header X-User-Id $user_id;       # проброс идентификатора пользователя
}
```
В результате в Express/Next‐route доступен заголовок `X-User-Id`, который промежуточный слой `lib/auth.ts:authMiddleware()` конвертирует в `request.auth`:
```typescript
// lib/auth.ts
export function authMiddleware(req: NextRequest): NextResponse | null {
  const userId = req.headers.get('X-User-Id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // request.auth = { id: userId }             <-- присваивается в withApiAuth
  return null;                                 // передаём управление роуту
}
```

Дополнительный wrapper `lib/api-auth.ts:withApiAuth()` объединяет проверку API-ключа и привязку `request.auth`.

## Задействованные файлы
| Файл | Назначение |
|------|------------|
| `lib/auth.ts` | Middleware + вспомогательные функции (TypeScript) |
| `lib/auth.js` | Функции генерации/валидации JWT (legacy, планируется удалить) |
| `lib/api-auth.ts` | Обёртка `withApiAuth` для Next API Routes |
| `app/api/auth/route.js` | Реализация `/login`, `/refresh`, `/logout` |
| `middleware.ts` | Глобальный вызов `authMiddleware` для App Router |

## Переменные окружения
| Переменная | Описание |
|------------|----------|
| `JWT_SECRET` | Секрет для подписи JWT (используется Auth-Service) |
| `JWT_ISSUER` | Issuer токена |
| `ACCESS_TOKEN_EXPIRY` | TTL access-токена в секундах |
| `REFRESH_TOKEN_EXPIRY` | TTL refresh-токена в секундах |
| `DB_URI` | Подключение к PostgreSQL для таблицы `auth_tokens` |

## Взаимодействие сервисов
1. **Frontend** отправляет запрос на `/api/auth/login`.
2. **Escrow-API** пробрасывает вызов к **Auth-Service** согласно конфигурации docker-compose + Nginx.
3. Auth-Service возвращает токены; Nginx отдаёт их клиенту.
4. При последующих запросах Nginx валидирует JWT, добавляет `X-User-Id` и перенаправляет к escow-api-1.

![sequence](https://mermaid.ink/img/pako:eNqNkE1PgzAUhv_KyrwS0tXFaYJkQpjOYwtiJzo0nIwaLXEFsxBSzou-_-mpSXJM_SNL6r26Deffve_udmNLTnTRVGw0yL_jYljYJD6BpVuCTnZcF8uQQl9gRzZEwCj3btJZAjX5hYPrv3SFWB8j20TEj2gCp_QzjK9yDWgb1fiD3MBbz5lQxBNCtolHrgDIHMvJANdrZeYx8EW_JjQsStA6BVJ2xM2zo9c8A6U9cOPOyDaWzpFzI2laUzwm2n3BStXMnkknYnhBV3Zgn7u7XqHRjA1bsKbflRPhWFsbVSweftpWj5VP2ZvP3kMbiI5HjpKf6Raa2viatfGsdm2QB0Wigiu8iuPjCVbSx7s5vYkil7J5nKQUrC8MV2j8H7_ll3zCwAA__8QI5EA)

## Предложения по улучшению
1. **Удалить `lib/auth.js`** — дублирует функциональность TypeScript-версии.
2. **Единый источник ролей/прав**: внедрить сервис авторизации (RBAC) или расширить payload JWT.
3. **Unit-тесты**: добавить Jest-тесты для `withApiAuth` и `authMiddleware`.
4. **Лимит сессий**: хранить параметр `deviceId`, чтобы ограничивать количество активных refresh-токенов на пользователя.

## Статус реализации (05.05.2025)
- [x] Конфигурация Nginx `auth_request`
- [x] Интеграция Auth-Service
- [x] Обновлённый middleware `authMiddleware`
- [ ] Удаление legacy `lib/auth.js`
- [ ] Покрытие unit-тестами

---
*Последнее обновление: 05 мая 2025 г.*