# Схема базы данных

## Перечисления (Enums)

### UserType
- `CUSTOMER` - Заказчик
- `CONTRACTOR` - Исполнитель
- `PLATFORM` - Представитель платформы

### OrderStatus
- `CREATED` - Заказ создан
- `FUNDED` - Заказ профинансирован (средства заблокированы)
- `IN_PROGRESS` - Заказ в процессе выполнения
- `COMPLETED` - Заказ завершен
- `DISPUTED` - Заказ в состоянии спора
- `CANCELLED` - Заказ отменен

### MilestoneStatus
- `PENDING` - Ожидает начала работы
- `IN_PROGRESS` - В процессе выполнения
- `AWAITING_ACCEPTANCE` - Ожидает приемки
- `COMPLETED` - Завершен
- `REJECTED` - Отклонен

### DocumentType
- `DEFINITION_OF_READY` - Определение готовности (DoR)
- `ROADMAP` - Дорожная карта
- `DEFINITION_OF_DONE` - Определение выполнения (DoD)
- `SPECIFICATION` - Спецификация
- `DELIVERABLE` - Результат работы
- `ACT_OF_WORK` - Акт выполненных работ

### ActStatus
- `CREATED` - Создан, ожидает подписей
- `SIGNED_CONTRACTOR` - Подписан исполнителем
- `SIGNED_CUSTOMER` - Подписан заказчиком
- `COMPLETED` - Завершен (подписан всеми необходимыми сторонами)
- `REJECTED` - Отклонен

## Таблицы

### users
Таблица для хранения информации о пользователях системы.

| Поле | Тип | Описание |
|------|-----|----------|
| id | text | Первичный ключ, UUID |
| name | text | Имя пользователя |
| email | text | Email пользователя (уникальный) |
| type | enum | Тип пользователя (CUSTOMER, CONTRACTOR, PLATFORM) |
| balance | numeric | Баланс пользователя |
| createdAt | timestamp | Дата создания |
| updatedAt | timestamp | Дата обновления |

### orders
Таблица для хранения информации о заказах.

| Поле | Тип | Описание |
|------|-----|----------|
| id | text | Первичный ключ, UUID |
| customerIds | text[] | Массив ID заказчиков |
| isGroupOrder | boolean | Флаг группового заказа |
| representativeId | text | ID представителя (для групповых заказов) |
| contractorId | text | ID исполнителя (назначается позже) |
| title | text | Название заказа |
| description | text | Описание заказа |
| status | enum | Статус заказа |
| totalAmount | numeric | Общая сумма заказа |
| fundedAmount | numeric | Заблокированная сумма |
| createdAt | timestamp | Дата создания |
| updatedAt | timestamp | Дата обновления |
| votes | jsonb | Голоса за представителя (в формате JSON) |

### milestones
Таблица для хранения этапов (вех) заказа.

| Поле | Тип | Описание |
|------|-----|----------|
| id | text | Первичный ключ, UUID |
| orderId | text | ID заказа (внешний ключ) |
| description | text | Описание этапа |
| amount | numeric | Сумма за этап |
| deadline | timestamp | Срок выполнения |
| status | enum | Статус этапа |
| paid | boolean | Флаг оплаты |
| roadmapPhaseId | text | ID фазы в дорожной карте (опционально) |
| createdAt | timestamp | Дата создания |
| updatedAt | timestamp | Дата обновления |

### documents
Таблица для хранения документов.

| Поле | Тип | Описание |
|------|-----|----------|
| id | text | Первичный ключ, UUID |
| orderId | text | ID заказа (внешний ключ) |
| type | enum | Тип документа |
| name | text | Название документа |
| createdBy | text | ID создателя |
| createdAt | timestamp | Дата создания |
| approvedBy | text[] | Массив ID одобривших пользователей |
| content | jsonb | Содержимое документа (в формате JSON) |

### acts
Таблица для хранения актов выполненных работ.

| Поле | Тип | Описание |
|------|-----|----------|
| id | text | Первичный ключ, UUID |
| documentId | text | ID документа (внешний ключ) |
| milestoneId | text | ID этапа (внешний ключ) |
| deliverableIds | text[] | Массив ID результатов работы |
| status | enum | Статус акта |
| signedBy | jsonb | Информация о подписавших (в формате JSON) |
| rejectionReason | text | Причина отклонения (опционально) |
| createdAt | timestamp | Дата создания |
| updatedAt | timestamp | Дата обновления |
