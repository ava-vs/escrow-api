# API Маршруты Escrow Системы

## Общие сведения

Все идентификаторы в системе представлены в формате UUID (например, `"550e8400-e29b-41d4-a716-446655440000"`). Используйте именно такой формат при создании и обращении к сущностям через API.

## Авторизация API

Все API-маршруты, кроме `/api/docs`, защищены механизмом авторизации, который требует наличия действительного API-ключа в запросе. Маршрут документации (`/api/docs`) остается публично доступным для удобства разработчиков. API-ключ можно передать одним из двух способов:

### 1. Через заголовок Authorization

```
Authorization: Bearer YOUR_API_KEY
```

или просто

```
Authorization: YOUR_API_KEY
```

### 2. Через заголовок X-API-Key

```
X-API-Key: YOUR_API_KEY
```

API-ключ должен соответствовать значению, установленному в переменной окружения `VERCEL_API_KEY` на сервере. Запросы без действительного API-ключа будут отклонены с ошибкой 401 Unauthorized.

**Ответ на запрос без авторизации:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing API key"
}
```

## Пользователи

### POST /api/users
Создание нового пользователя.

**Параметры запроса:**
```json
{
  "name": "Имя пользователя",
  "email": "email@example.com",
  "type": "CUSTOMER | CONTRACTOR | PLATFORM",
  "initialBalance": 0 // опционально
}
```

**Ответ:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000", // UUID в формате строки
  "name": "Имя пользователя",
  "email": "email@example.com",
  "type": "CUSTOMER",
  "balance": "0" // Баланс представлен в виде строки
}
```

**Важно:** Идентификатор пользователя генерируется автоматически в формате UUID.

### GET /api/users/:id
Получение информации о пользователе по ID. ID должен быть в формате UUID.

**Ответ:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000", // UUID в формате строки
  "name": "Имя пользователя",
  "email": "email@example.com",
  "type": "CUSTOMER",
  "balance": "0" // Баланс представлен в виде строки
}
```

### PATCH /api/users/:id/balance
Изменение баланса пользователя. ID должен быть в формате UUID.

**Параметры запроса:**
```json
{
  "amount": 100 // положительное или отрицательное число
}
```

**Ответ:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000", // UUID в формате строки
  "name": "Имя пользователя",
  "email": "email@example.com",
  "type": "CUSTOMER",
  "balance": "100" // Баланс представлен в виде строки
}
```

## Заказы

### POST /api/orders
Создание нового заказа.

**Параметры запроса:**
```json
{
  "customerId": "550e8400-e29b-41d4-a716-446655440000", // UUID пользователя в формате строки
  "title": "Название заказа",
  "description": "Описание заказа",
  "milestones": [
    {
      "description": "Описание этапа",
      "amount": "100", // Сумма в виде строки
      "deadline": "2025-04-30T12:00:00Z" // дата в формате ISO
    }
  ]
}
```

**Внимание:** Идентификатор заказчика (`customerId`) должен быть действительным UUID пользователя с типом CUSTOMER.

**Ответ:**
```json
{
  "id": "uuid",
  "customerIds": ["uuid"],
  "isGroupOrder": false,
  "title": "Название заказа",
  "description": "Описание заказа",
  "milestones": [...],
  "status": "CREATED",
  "totalAmount": 100,
  "fundedAmount": 0,
  "createdAt": "2025-04-07T12:00:00Z"
}
```

### POST /api/group-orders
Создание группового заказа.

**Параметры запроса:**
```json
{
  "customerIds": [
    "550e8400-e29b-41d4-a716-446655440000", 
    "550e8400-e29b-41d4-a716-446655440001"
  ], // Массив UUID пользователей типа CUSTOMER
  "title": "Название заказа",
  "description": "Описание заказа",
  "initialRepresentativeId": "550e8400-e29b-41d4-a716-446655440000", // опционально, UUID одного из заказчиков
  "milestones": [
    {
      "description": "Описание этапа",
      "amount": "100", // Сумма в виде строки
      "deadline": "2025-04-30T12:00:00Z"
    }
  ]
}
```

**Ответ:** 
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000", // UUID заказа
  "customerIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440001"
  ], // Массив UUID пользователей
  "isGroupOrder": true,
  "representativeId": "550e8400-e29b-41d4-a716-446655440000", // UUID представителя
  "title": "Название заказа",
  "description": "Описание заказа",
  "milestones": [...], // Массив этапов в том же формате, что и в обычном заказе
  "status": "CREATED",
  "totalAmount": "100", // Строковое представление
  "fundedAmount": "0", // Строковое представление
  "createdAt": "2025-04-07T12:00:00Z"
}
```

**Важно:** Для группового заказа требуется минимум 2 заказчика (customerIds). Все идентификаторы должны быть в формате UUID.

### GET /api/orders
Получение списка всех заказов.

**Ответ:**
```json
[
  {
    "id": "uuid",
    "customerIds": ["uuid"],
    "isGroupOrder": false,
    "title": "Название заказа",
    "description": "Описание заказа",
    "milestones": [...],
    "status": "CREATED",
    "totalAmount": 100,
    "fundedAmount": 0,
    "createdAt": "2025-04-07T12:00:00Z"
  }
]
```

### GET /api/orders/:id
Получение информации о заказе по ID.

**Ответ:**
```json
{
  "id": "uuid",
  "customerIds": ["uuid"],
  "isGroupOrder": false,
  "title": "Название заказа",
  "description": "Описание заказа",
  "milestones": [...],
  "status": "CREATED",
  "totalAmount": 100,
  "fundedAmount": 0,
  "createdAt": "2025-04-07T12:00:00Z"
}
```

### GET /api/users/:id/orders
Получение заказов пользователя.

**Ответ:**
```json
[
  {
    "id": "uuid",
    "customerIds": ["uuid"],
    "isGroupOrder": false,
    "title": "Название заказа",
    "description": "Описание заказа",
    "milestones": [...],
    "status": "CREATED",
    "totalAmount": 100,
    "fundedAmount": 0,
    "createdAt": "2025-04-07T12:00:00Z"
  }
]
```

### PATCH /api/orders/:id/assign
Назначение исполнителя для заказа.

**Параметры запроса:**
```json
{
  "contractorId": "uuid",
  "assignerUserId": "uuid"
}
```

**Ответ:** Обновленный заказ с информацией об исполнителе.

### POST /api/orders/:id/contribute
Внесение средств для заказа.

**Параметры запроса:**
```json
{
  "contributingUserId": "uuid",
  "amount": 100
}
```

**Ответ:** Обновленный заказ с обновленной суммой средств.

### POST /api/orders/:id/vote
Голосование за представителя в групповом заказе. Позволяет участникам группового заказа голосовать за нового представителя. Представителем становится кандидат с наибольшим количеством голосов.

**Параметры запроса:**
```json
{
  "voterId": "uuid",        // ID пользователя, который голосует
  "candidateId": "uuid"    // ID пользователя, за которого голосуют
}
```

**Ответ:**
```json
{
  "success": true,
  "orderId": "uuid",
  "currentRepresentativeId": "uuid",   // ID текущего представителя
  "votes": [
    {
      "voterId": "uuid",           // ID голосующего
      "candidateId": "uuid",       // ID кандидата, за которого проголосовали
      "createdAt": "2025-04-08T12:00:00Z"  // Время создания голоса
    },
    // ... другие голоса
  ]
}
```

**Важное замечание:**
- Голосование доступно только для групповых заказов (isGroupOrder=true)
- Голосующий и кандидат должны быть участниками заказа
- Пользователь может проголосовать только за одного кандидата, предыдущий голос удаляется

## Документы

### POST /api/documents
Создание нового документа.

**Параметры запроса:**
```json
{
  "orderId": "uuid",
  "type": "DEFINITION_OF_READY | ROADMAP | DEFINITION_OF_DONE | SPECIFICATION | DELIVERABLE",
  "name": "Название документа",
  "createdBy": "uuid",
  "content": {} // структура зависит от типа документа
}
```

**Ответ:**
```json
{
  "id": "uuid",
  "orderId": "uuid",
  "type": "DEFINITION_OF_READY",
  "name": "Название документа",
  "createdBy": "uuid",
  "createdAt": "2025-04-07T12:00:00Z",
  "content": {}
}
```

### GET /api/documents/:id
Получение документа по ID.

**Ответ:**
```json
{
  "id": "uuid",
  "orderId": "uuid",
  "type": "DEFINITION_OF_READY",
  "name": "Название документа",
  "createdBy": "uuid",
  "createdAt": "2025-04-07T12:00:00Z",
  "approvedBy": ["uuid"],
  "content": {}
}
```

### GET /api/orders/:id/documents
Получение всех документов для заказа.

**Ответ:**
```json
[
  {
    "id": "uuid",
    "orderId": "uuid",
    "type": "DEFINITION_OF_READY",
    "name": "Название документа",
    "createdBy": "uuid",
    "createdAt": "2025-04-07T12:00:00Z",
    "approvedBy": ["uuid"],
    "content": {}
  }
]
```

### POST /api/documents/:id/approve
Одобрение документа.

**Параметры запроса:**
```json
{
  "approverId": "uuid"
}
```

**Ответ:** Обновленный документ с добавленным идентификатором в поле approvedBy.

## Акты выполненных работ

### POST /api/acts
Создание акта выполненных работ.

**Параметры запроса:**
```json
{
  "orderId": "uuid",
  "milestoneId": "uuid",
  "deliverableIds": ["uuid"],
  "createdBy": "uuid",
  "name": "Название акта"
}
```

**Ответ:**
```json
{
  "id": "uuid",
  "orderId": "uuid",
  "type": "ACT_OF_WORK",
  "name": "Название акта",
  "createdBy": "uuid",
  "createdAt": "2025-04-07T12:00:00Z",
  "milestoneId": "uuid",
  "deliverableIds": ["uuid"],
  "status": "CREATED",
  "signedBy": []
}
```

### POST /api/acts/:id/sign
Подписание акта выполненных работ.

**Параметры запроса:**
```json
{
  "userId": "uuid"
}
```

**Ответ:** Обновленный акт с добавленной подписью.

### POST /api/acts/:id/reject
Отклонение акта выполненных работ.

**Параметры запроса:**
```json
{
  "userId": "uuid",
  "reason": "Причина отклонения"
}
```

**Ответ:** Обновленный акт со статусом REJECTED и указанной причиной отклонения.
