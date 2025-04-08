# API Маршруты Escrow Системы

## Авторизация API

Все API-маршруты защищены механизмом авторизации, который требует наличия действительного API-ключа в запросе. API-ключ можно передать одним из двух способов:

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
  "id": "uuid",
  "name": "Имя пользователя",
  "email": "email@example.com",
  "type": "CUSTOMER",
  "balance": 0
}
```

### GET /api/users/:id
Получение информации о пользователе по ID.

**Ответ:**
```json
{
  "id": "uuid",
  "name": "Имя пользователя",
  "email": "email@example.com",
  "type": "CUSTOMER",
  "balance": 0
}
```

### PATCH /api/users/:id/balance
Изменение баланса пользователя.

**Параметры запроса:**
```json
{
  "amount": 100 // положительное или отрицательное число
}
```

**Ответ:**
```json
{
  "id": "uuid",
  "name": "Имя пользователя",
  "email": "email@example.com",
  "type": "CUSTOMER",
  "balance": 100
}
```

## Заказы

### POST /api/orders
Создание нового заказа.

**Параметры запроса:**
```json
{
  "customerId": "uuid",
  "title": "Название заказа",
  "description": "Описание заказа",
  "milestones": [
    {
      "description": "Описание этапа",
      "amount": 100,
      "deadline": "2025-04-30T12:00:00Z" // дата в формате ISO
    }
  ]
}
```

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
  "customerIds": ["uuid1", "uuid2"],
  "title": "Название заказа",
  "description": "Описание заказа",
  "initialRepresentativeId": "uuid1", // опционально
  "milestones": [
    {
      "description": "Описание этапа",
      "amount": 100,
      "deadline": "2025-04-30T12:00:00Z"
    }
  ]
}
```

**Ответ:** Аналогичен ответу на создание обычного заказа, но с isGroupOrder: true.

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
Голосование за представителя в групповом заказе.

**Параметры запроса:**
```json
{
  "voterId": "uuid",
  "candidateId": "uuid"
}
```

**Ответ:**
```json
{
  "currentRepresentativeId": "uuid"
}
```

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
