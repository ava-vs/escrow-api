# План миграции на Cloudflare Workers и развития функциональности

## Обзор

Данный документ описывает поэтапный план миграции Escrow API с текущей архитектуры Next.js/Vercel на Cloudflare Workers, а также реализацию новых функций: системы чата, продаж готовых продуктов и распределения доходов.

## Фаза 0: Подготовка к миграции на Cloudflare Workers

### 0.1 Анализ текущей архитектуры

#### Компоненты для миграции:
- **API Routes** (`app/api/*`) → Cloudflare Workers
- **EscrowManager и сервисы** → Workers с Durable Objects
- **База данных** → Cloudflare D1 или внешний PostgreSQL
- **Аутентификация** → Cloudflare Access + JWT
- **Файловое хранилище** → Cloudflare R2

#### Ограничения Cloudflare Workers:
- Максимум 128MB памяти на Worker
- Максимум 30 секунд выполнения
- Отсутствие Node.js EventEmitter (требует адаптации)
- Ограниченная поддержка npm пакетов - необходимо учитывать!

### 0.2 Архитектурные изменения

#### Новая структура проекта:
```
cloudflare/
├── workers/
│   ├── api-gateway/          # Основной API Worker
│   ├── chat-service/         # Сервис чата (Durable Objects)
│   ├── product-sales/        # Сервис продаж продуктов
│   └── escrow-manager/       # Основная бизнес-логика
├── shared/
│   ├── types/               # Общие TypeScript типы
│   ├── utils/               # Утилиты
│   └── db/                  # Схемы базы данных
├── frontend/
│   ├── pages/               # Статические страницы
│   └── components/          # React компоненты
└── wrangler.toml           # Конфигурация Cloudflare
```

#### Замена EventEmitter:
```typescript
// Вместо EventEmitter используем Durable Objects для состояния
export class EscrowManagerDO {
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }
  
  async handleEvent(event: EscrowEvent) {
    // Обработка событий через Durable Objects
    await this.state.storage.put(`event:${Date.now()}`, event);
    // Отправка уведомлений через WebSockets
    this.broadcastEvent(event);
  }
}
```

### 0.3 Миграция базы данных

#### Вариант 1: Cloudflare D1 
```sql
-- Миграция схемы на D1
-- Поддерживает SQLite синтаксис
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('CUSTOMER', 'CONTRACTOR', 'PLATFORM')),
  balance DECIMAL(10,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```


### 0.4 План миграции API

#### Этап 1: Подготовка Workers
```typescript
// workers/api-gateway/src/index.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Роутинг API запросов
    if (url.pathname.startsWith('/api/users')) {
      return handleUsers(request, env);
    }
    if (url.pathname.startsWith('/api/orders')) {
      return handleOrders(request, env);
    }
    if (url.pathname.startsWith('/api/chat')) {
      return handleChat(request, env);
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
```

#### Этап 2: Адаптация сервисов
```typescript
// Адаптация UserService для Workers
export class UserServiceWorker {
  constructor(private env: Env) {}
  
  async createUser(userData: CreateUserData): Promise<User> {
    // Использование D1 вместо Drizzle ORM
    const result = await this.env.DB.prepare(
      'INSERT INTO users (id, name, email, type) VALUES (?, ?, ?, ?)'
    ).bind(userData.id, userData.name, userData.email, userData.type).run();
    
    return this.getUserById(userData.id);
  }
}
```

## Фаза 1: Система сообщений и чата

### 1.1 Архитектура чата

#### Компоненты системы чата:
- **ChatService** - управление чатами и сообщениями
- **MessageDO** - Durable Object для real-time сообщений
- **WebSocket соединения** - для мгновенных уведомлений
- **Файловое хранилище** - для вложений в сообщениях

#### Схема базы данных:
```sql
-- Чаты заказов
CREATE TABLE order_chats (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Участники чата
CREATE TABLE chat_participants (
  chat_id TEXT NOT NULL REFERENCES order_chats(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('CUSTOMER', 'CONTRACTOR', 'PLATFORM')),
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (chat_id, user_id)
);

-- Сообщения
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES order_chats(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  message_type TEXT NOT NULL CHECK (message_type IN ('TEXT', 'FILE', 'PRODUCT_DELIVERY', 'SYSTEM')),
  content TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  reply_to_id TEXT REFERENCES chat_messages(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Статус прочтения сообщений
CREATE TABLE message_read_status (
  message_id TEXT NOT NULL REFERENCES chat_messages(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id)
);
```

### 1.2 Реализация ChatService

```typescript
// workers/chat-service/src/chat-service.ts
export class ChatService {
  constructor(private env: Env) {}
  
  async createOrderChat(orderId: string): Promise<OrderChat> {
    const chatId = crypto.randomUUID();
    
    // Создаем чат
    await this.env.DB.prepare(
      'INSERT INTO order_chats (id, order_id) VALUES (?, ?)'
    ).bind(chatId, orderId).run();
    
    // Добавляем участников из заказа
    const order = await this.getOrder(orderId);
    await this.addParticipants(chatId, order);
    
    return { id: chatId, orderId, createdAt: new Date() };
  }
  
  async sendMessage(
    chatId: string, 
    senderId: string, 
    content: string, 
    type: MessageType = 'TEXT'
  ): Promise<ChatMessage> {
    const messageId = crypto.randomUUID();
    
    await this.env.DB.prepare(`
      INSERT INTO chat_messages (id, chat_id, sender_id, message_type, content) 
      VALUES (?, ?, ?, ?, ?)
    `).bind(messageId, chatId, senderId, type, content).run();
    
    // Отправляем real-time уведомление
    await this.broadcastMessage(chatId, messageId);
    
    return this.getMessage(messageId);
  }
  
  private async broadcastMessage(chatId: string, messageId: string) {
    // Получаем Durable Object для чата
    const chatDO = this.env.CHAT_DO.get(this.env.CHAT_DO.idFromName(chatId));
    await chatDO.fetch(new Request(`https://chat/${messageId}`, {
      method: 'POST'
    }));
  }
}
```

### 1.3 Durable Object для real-time чата

```typescript
// workers/chat-service/src/chat-durable-object.ts
export class ChatDurableObject {
  private sessions: Map<string, WebSocket> = new Map();
  
  constructor(private state: DurableObjectState, private env: Env) {}
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/websocket') {
      return this.handleWebSocket(request);
    }
    
    if (request.method === 'POST') {
      return this.handleNewMessage(request);
    }
    
    return new Response('Not Found', { status: 404 });
  }
  
  private async handleWebSocket(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected websocket', { status: 400 });
    }
    
    const [client, server] = Object.values(new WebSocketPair());
    
    server.accept();
    
    const userId = this.getUserIdFromRequest(request);
    this.sessions.set(userId, server);
    
    server.addEventListener('close', () => {
      this.sessions.delete(userId);
    });
    
    return new Response(null, { status: 101, webSocket: client });
  }
  
  private async handleNewMessage(request: Request): Promise<Response> {
    const messageId = new URL(request.url).pathname.split('/').pop();
    const message = await this.getMessageFromDB(messageId);
    
    // Отправляем сообщение всем подключенным участникам
    for (const [userId, ws] of this.sessions) {
      if (await this.isParticipant(userId, message.chatId)) {
        ws.send(JSON.stringify({
          type: 'NEW_MESSAGE',
          data: message
        }));
      }
    }
    
    return new Response('OK');
  }
}
```

### 1.4 Frontend интеграция

```typescript
// frontend/components/OrderChat.tsx
export function OrderChat({ orderId }: { orderId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  
  useEffect(() => {
    // Подключение к WebSocket
    const websocket = new WebSocket(`wss://api.escrow.com/chat/${orderId}/websocket`);
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'NEW_MESSAGE') {
        setMessages(prev => [...prev, data.data]);
      }
    };
    
    setWs(websocket);
    
    return () => websocket.close();
  }, [orderId]);
  
  const sendMessage = async (content: string) => {
    await fetch(`/api/chat/${orderId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
  };
  
  return (
    <div className="chat-container">
      <MessageList messages={messages} />
      <MessageInput onSend={sendMessage} />
    </div>
  );
}
```

## Фаза 2: Доставка готовых продуктов

### 2.1 Система доставки продуктов

#### Расширение схемы базы данных:
```sql
-- Готовые продукты
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL DEFAULT '1.0.0',
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  checksum TEXT, -- для проверки целостности
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Доставки продуктов
CREATE TABLE product_deliveries (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  chat_id TEXT NOT NULL REFERENCES order_chats(id),
  message_id TEXT NOT NULL REFERENCES chat_messages(id),
  delivered_by TEXT NOT NULL REFERENCES users(id),
  delivery_note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Подтверждения получения
CREATE TABLE delivery_confirmations (
  id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL REFERENCES product_deliveries(id),
  confirmed_by TEXT NOT NULL REFERENCES users(id),
  confirmation_note TEXT,
  confirmed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 ProductDeliveryService

```typescript
// workers/product-delivery/src/product-delivery-service.ts
export class ProductDeliveryService {
  constructor(private env: Env) {}
  
  async createProduct(
    orderId: string,
    createdBy: string,
    productData: CreateProductData
  ): Promise<Product> {
    const productId = crypto.randomUUID();
    
    // Загружаем файл в Cloudflare R2
    const fileUrl = await this.uploadToR2(productData.file);
    const checksum = await this.calculateChecksum(productData.file);
    
    await this.env.DB.prepare(`
      INSERT INTO products (id, order_id, name, description, version, 
                           file_url, file_name, file_size, checksum, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      productId, orderId, productData.name, productData.description,
      productData.version, fileUrl, productData.fileName, 
      productData.fileSize, checksum, createdBy
    ).run();
    
    return this.getProduct(productId);
  }
  
  async deliverProduct(
    productId: string,
    chatId: string,
    deliveredBy: string,
    deliveryNote?: string
  ): Promise<ProductDelivery> {
    const product = await this.getProduct(productId);
    
    // Отправляем сообщение в чат с продуктом
    const message = await this.sendProductMessage(chatId, deliveredBy, product);
    
    // Создаем запись о доставке
    const deliveryId = crypto.randomUUID();
    await this.env.DB.prepare(`
      INSERT INTO product_deliveries (id, product_id, chat_id, message_id, 
                                    delivered_by, delivery_note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(deliveryId, productId, chatId, message.id, deliveredBy, deliveryNote).run();
    
    return this.getDelivery(deliveryId);
  }
  
  private async sendProductMessage(
    chatId: string, 
    senderId: string, 
    product: Product
  ): Promise<ChatMessage> {
    const content = JSON.stringify({
      type: 'PRODUCT_DELIVERY',
      productId: product.id,
      productName: product.name,
      version: product.version,
      downloadUrl: await this.generateSecureDownloadUrl(product.fileUrl),
      checksum: product.checksum
    });
    
    return await this.chatService.sendMessage(
      chatId, 
      senderId, 
      content, 
      'PRODUCT_DELIVERY'
    );
  }
  
  private async generateSecureDownloadUrl(fileUrl: string): Promise<string> {
    // Генерируем временную подписанную ссылку для скачивания
    const signedUrl = await this.env.R2.sign(fileUrl, {
      expiresIn: 3600 // 1 час
    });
    return signedUrl;
  }
}
```

### 2.3 Frontend для доставки продуктов

```typescript
// frontend/components/ProductDelivery.tsx
export function ProductDeliveryForm({ orderId }: { orderId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [productData, setProductData] = useState({
    name: '',
    description: '',
    version: '1.0.0'
  });
  
  const handleDelivery = async () => {
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('productData', JSON.stringify(productData));
    
    // Создаем продукт
    const response = await fetch(`/api/orders/${orderId}/products`, {
      method: 'POST',
      body: formData
    });
    
    const product = await response.json();
    
    // Доставляем в чат
    await fetch(`/api/orders/${orderId}/deliver-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.id,
        deliveryNote: 'Готовый продукт доставлен'
      })
    });
  };
  
  return (
    <div className="product-delivery-form">
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <input
        placeholder="Название продукта"
        value={productData.name}
        onChange={(e) => setProductData(prev => ({ ...prev, name: e.target.value }))}
      />
      <textarea
        placeholder="Описание"
        value={productData.description}
        onChange={(e) => setProductData(prev => ({ ...prev, description: e.target.value }))}
      />
      <button onClick={handleDelivery}>Доставить продукт</button>
    </div>
  );
}
```

## Фаза 3: Продажи готовых продуктов

### 3.1 Архитектура системы продаж

#### Расширение схемы базы данных:
```sql
-- Продукты для продажи
CREATE TABLE marketplace_products (
  id TEXT PRIMARY KEY,
  original_product_id TEXT NOT NULL REFERENCES products(id),
  seller_id TEXT NOT NULL REFERENCES users(id), -- исполнитель
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,4) DEFAULT 0.1, -- 10% комиссия платформы
  is_active BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Продажи
CREATE TABLE product_sales (
  id TEXT PRIMARY KEY,
  marketplace_product_id TEXT NOT NULL REFERENCES marketplace_products(id),
  buyer_id TEXT NOT NULL REFERENCES users(id),
  sale_price DECIMAL(10,2) NOT NULL,
  platform_commission DECIMAL(10,2) NOT NULL,
  seller_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'REFUNDED')) DEFAULT 'PENDING',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Лицензии на продукты
CREATE TABLE product_licenses (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES product_sales(id),
  license_key TEXT UNIQUE NOT NULL,
  download_url TEXT NOT NULL,
  downloads_count INTEGER DEFAULT 0,
  max_downloads INTEGER DEFAULT 5,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 MarketplaceService

```typescript
// workers/marketplace/src/marketplace-service.ts
export class MarketplaceService {
  constructor(private env: Env) {}
  
  async publishProduct(
    originalProductId: string,
    sellerId: string,
    marketplaceData: PublishProductData
  ): Promise<MarketplaceProduct> {
    // Проверяем права на публикацию
    const product = await this.getProduct(originalProductId);
    if (product.createdBy !== sellerId) {
      throw new Error('Only product creator can publish it');
    }
    
    const marketplaceProductId = crypto.randomUUID();
    
    await this.env.DB.prepare(`
      INSERT INTO marketplace_products (id, original_product_id, seller_id, 
                                      name, description, price, commission_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      marketplaceProductId, originalProductId, sellerId,
      marketplaceData.name, marketplaceData.description, 
      marketplaceData.price, marketplaceData.commissionRate || 0.1
    ).run();
    
    return this.getMarketplaceProduct(marketplaceProductId);
  }
  
  async purchaseProduct(
    marketplaceProductId: string,
    buyerId: string
  ): Promise<ProductSale> {
    const product = await this.getMarketplaceProduct(marketplaceProductId);
    
    // Проверяем баланс покупателя
    const buyer = await this.getUserById(buyerId);
    if (parseFloat(buyer.balance) < product.price) {
      throw new Error('Insufficient balance');
    }
    
    // Создаем продажу
    const saleId = crypto.randomUUID();
    const platformCommission = product.price * product.commissionRate;
    const sellerAmount = product.price - platformCommission;
    
    await this.env.DB.prepare(`
      INSERT INTO product_sales (id, marketplace_product_id, buyer_id, 
                               sale_price, platform_commission, seller_amount)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      saleId, marketplaceProductId, buyerId,
      product.price, platformCommission, sellerAmount
    ).run();
    
    // Списываем средства с покупателя
    await this.updateUserBalance(buyerId, -product.price);
    
    // Создаем лицензию
    await this.createProductLicense(saleId, product.originalProductId);
    
    // Завершаем продажу
    await this.completeSale(saleId);
    
    return this.getSale(saleId);
  }
  
  private async createProductLicense(
    saleId: string, 
    originalProductId: string
  ): Promise<ProductLicense> {
    const licenseId = crypto.randomUUID();
    const licenseKey = this.generateLicenseKey();
    const downloadUrl = await this.generateSecureDownloadUrl(originalProductId);
    
    await this.env.DB.prepare(`
      INSERT INTO product_licenses (id, sale_id, license_key, download_url)
      VALUES (?, ?, ?, ?)
    `).bind(licenseId, saleId, licenseKey, downloadUrl).run();
    
    return this.getLicense(licenseId);
  }
  
  private generateLicenseKey(): string {
    // Генерируем уникальный ключ лицензии
    const segments = [];
    for (let i = 0; i < 4; i++) {
      segments.push(Math.random().toString(36).substring(2, 8).toUpperCase());
    }
    return segments.join('-');
  }
}
```

## Фаза 4: Эскроу-счета для продаж и распределение доходов

### 4.1 Архитектура эскроу-счетов для продаж

#### Расширение схемы базы данных:
```sql
-- Эскроу-счета для продаж продуктов
CREATE TABLE sales_escrow_accounts (
  id TEXT PRIMARY KEY,
  marketplace_product_id TEXT NOT NULL REFERENCES marketplace_products(id),
  total_sales_amount DECIMAL(15,2) DEFAULT 0,
  platform_commission_amount DECIMAL(15,2) DEFAULT 0,
  available_for_distribution DECIMAL(15,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Участники распределения доходов (заказчики оригинального заказа)
CREATE TABLE revenue_participants (
  id TEXT PRIMARY KEY,
  sales_escrow_account_id TEXT NOT NULL REFERENCES sales_escrow_accounts(id),
  participant_id TEXT NOT NULL REFERENCES users(id),
  participation_type TEXT NOT NULL CHECK (participation_type IN ('CUSTOMER', 'CONTRACTOR', 'PLATFORM')),
  share_percentage DECIMAL(5,4) NOT NULL, -- доля в процентах (0.0000 - 1.0000)
  total_received DECIMAL(15,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Распределения доходов
CREATE TABLE revenue_distributions (
  id TEXT PRIMARY KEY,
  sales_escrow_account_id TEXT NOT NULL REFERENCES sales_escrow_accounts(id),
  distribution_amount DECIMAL(15,2) NOT NULL,
  distribution_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('MANUAL', 'THRESHOLD', 'SCHEDULED')),
  notes TEXT
);

-- Детали распределения по участникам
CREATE TABLE distribution_details (
  id TEXT PRIMARY KEY,
  distribution_id TEXT NOT NULL REFERENCES revenue_distributions(id),
  participant_id TEXT NOT NULL REFERENCES users(id),
  amount DECIMAL(15,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')) DEFAULT 'PENDING',
  processed_at DATETIME
);

-- Настройки автоматического распределения
CREATE TABLE distribution_settings (
  id TEXT PRIMARY KEY,
  sales_escrow_account_id TEXT NOT NULL REFERENCES sales_escrow_accounts(id),
  auto_distribution_enabled BOOLEAN DEFAULT false,
  distribution_threshold DECIMAL(15,2), -- минимальная сумма для автораспределения
  distribution_frequency TEXT CHECK (distribution_frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')),
  next_distribution_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 SalesEscrowService

```typescript
// workers/sales-escrow/src/sales-escrow-service.ts
export class SalesEscrowService {
  constructor(private env: Env) {}
  
  async createSalesEscrowAccount(
    marketplaceProductId: string,
    originalOrderId: string
  ): Promise<SalesEscrowAccount> {
    const accountId = crypto.randomUUID();
    
    // Создаем эскроу-счет
    await this.env.DB.prepare(`
      INSERT INTO sales_escrow_accounts (id, marketplace_product_id)
      VALUES (?, ?)
    `).bind(accountId, marketplaceProductId).run();
    
    // Добавляем участников на основе оригинального заказа
    await this.setupRevenueParticipants(accountId, originalOrderId);
    
    return this.getSalesEscrowAccount(accountId);
  }
  
  private async setupRevenueParticipants(
    accountId: string, 
    originalOrderId: string
  ): Promise<void> {
    const order = await this.getOrder(originalOrderId);
    
    // Исполнитель получает 70% от продаж
    if (order.contractorId) {
      await this.addRevenueParticipant(accountId, order.contractorId, 'CONTRACTOR', 0.7);
    }
    
    // Заказчики делят 25% пропорционально их вкладу
    const customerShare = 0.25 / order.customerIds.length;
    for (const customerId of order.customerIds) {
      await this.addRevenueParticipant(accountId, customerId, 'CUSTOMER', customerShare);
    }
    
    // Платформа получает 5%
    await this.addRevenueParticipant(accountId, 'PLATFORM', 'PLATFORM', 0.05);
  }
  
  async processSaleRevenue(
    marketplaceProductId: string,
    saleAmount: number,
    platformCommission: number
  ): Promise<void> {
    const account = await this.getSalesEscrowAccountByProduct(marketplaceProductId);
    
    // Обновляем баланс эскроу-счета
    const netAmount = saleAmount - platformCommission;
    
    await this.env.DB.prepare(`
      UPDATE sales_escrow_accounts 
      SET total_sales_amount = total_sales_amount + ?,
          platform_commission_amount = platform_commission_amount + ?,
          available_for_distribution = available_for_distribution + ?
      WHERE id = ?
    `).bind(saleAmount, platformCommission, netAmount, account.id).run();
    
    // Проверяем необходимость автоматического распределения
    await this.checkAutoDistribution(account.id);
  }
  
  async distributeRevenue(
    accountId: string,
    distributionAmount?: number,
    triggerType: 'MANUAL' | 'THRESHOLD' | 'SCHEDULED' = 'MANUAL'
  ): Promise<RevenueDistribution> {
    const account = await this.getSalesEscrowAccount(accountId);
    const participants = await this.getRevenueParticipants(accountId);
    
    const amountToDistribute = distributionAmount || account.availableForDistribution;
    
    if (amountToDistribute > account.availableForDistribution) {
      throw new Error('Insufficient funds for distribution');
    }
    
    // Создаем запись о распределении
    const distributionId = crypto.randomUUID();
    await this.env.DB.prepare(`
      INSERT INTO revenue_distributions (id, sales_escrow_account_id, 
                                       distribution_amount, trigger_type)
      VALUES (?, ?, ?, ?)
    `).bind(distributionId, accountId, amountToDistribute, triggerType).run();
    
    // Распределяем средства между участниками
    for (const participant of participants) {
      const participantAmount = amountToDistribute * participant.sharePercentage;
      
      await this.distributeToParticipant(
        distributionId,
        participant.participantId,
        participantAmount
      );
    }
    
    // Обновляем доступную сумму
    await this.env.DB.prepare(`
      UPDATE sales_escrow_accounts 
      SET available_for_distribution = available_for_distribution - ?
      WHERE id = ?
    `).bind(amountToDistribute, accountId).run();
    
    return this.getDistribution(distributionId);
  }
  
  private async distributeToParticipant(
    distributionId: string,
    participantId: string,
    amount: number
  ): Promise<void> {
    const detailId = crypto.randomUUID();
    
    // Создаем запись о распределении
    await this.env.DB.prepare(`
      INSERT INTO distribution_details (id, distribution_id, participant_id, amount)
      VALUES (?, ?, ?, ?)
    `).bind(detailId, distributionId, participantId, amount).run();
    
    try {
      // Переводим средства участнику
      if (participantId !== 'PLATFORM') {
        await this.updateUserBalance(participantId, amount);
      }
      
      // Отмечаем как выполненное
      await this.env.DB.prepare(`
        UPDATE distribution_details 
        SET status = 'COMPLETED', processed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(detailId).run();
      
      // Обновляем общую сумму полученную участником
      await this.env.DB.prepare(`
        UPDATE revenue_participants 
        SET total_received = total_received + ?
        WHERE participant_id = ? AND sales_escrow_account_id = ?
      `).bind(amount, participantId, 
        await this.getAccountIdByDistribution(distributionId)
      ).run();
      
    } catch (error) {
      // Отмечаем как неудачное
      await this.env.DB.prepare(`
        UPDATE distribution_details 
        SET status = 'FAILED'
        WHERE id = ?
      `).bind(detailId).run();
      
      throw error;
    }
  }
  
  async setupAutoDistribution(
    accountId: string,
    settings: DistributionSettings
  ): Promise<void> {
    await this.env.DB.prepare(`
      INSERT OR REPLACE INTO distribution_settings 
      (id, sales_escrow_account_id, auto_distribution_enabled, 
       distribution_threshold, distribution_frequency, next_distribution_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), accountId, settings.autoDistributionEnabled,
      settings.distributionThreshold, settings.distributionFrequency,
      settings.nextDistributionDate
    ).run();
  }
  
  private async checkAutoDistribution(accountId: string): Promise<void> {
    const settings = await this.getDistributionSettings(accountId);
    const account = await this.getSalesEscrowAccount(accountId);
    
    if (!settings.autoDistributionEnabled) return;
    
    // Проверяем пороговое значение
    if (settings.distributionThreshold && 
        account.availableForDistribution >= settings.distributionThreshold) {
      await this.distributeRevenue(accountId, undefined, 'THRESHOLD');
    }
    
    // Проверяем расписание
    if (settings.nextDistributionDate && 
        new Date() >= settings.nextDistributionDate) {
      await this.distributeRevenue(accountId, undefined, 'SCHEDULED');
      await this.updateNextDistributionDate(accountId, settings.distributionFrequency);
    }
  }
}
```

### 4.3 Frontend для управления доходами

```typescript
// frontend/components/RevenueManagement.tsx
export function RevenueManagement({ productId }: { productId: string }) {
  const [escrowAccount, setEscrowAccount] = useState<SalesEscrowAccount | null>(null);
  const [participants, setParticipants] = useState<RevenueParticipant[]>([]);
  const [distributions, setDistributions] = useState<RevenueDistribution[]>([]);
  
  useEffect(() => {
    loadEscrowData();
  }, [productId]);
  
  const loadEscrowData = async () => {
    const [accountRes, participantsRes, distributionsRes] = await Promise.all([
      fetch(`/api/marketplace/products/${productId}/escrow-account`),
      fetch(`/api/marketplace/products/${productId}/participants`),
      fetch(`/api/marketplace/products/${productId}/distributions`)
    ]);
    
    setEscrowAccount(await accountRes.json());
    setParticipants(await participantsRes.json());
    setDistributions(await distributionsRes.json());
  };
  
  const handleManualDistribution = async () => {
    await fetch(`/api/marketplace/products/${productId}/distribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggerType: 'MANUAL' })
    });
    
    await loadEscrowData();
  };
  
  const setupAutoDistribution = async (settings: DistributionSettings) => {
    await fetch(`/api/marketplace/products/${productId}/auto-distribution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  };
  
  return (
    <div className="revenue-management">
      <div className="escrow-summary">
        <h3>Эскроу-счет продаж</h3>
        <div className="balance-info">
          <div>Общие продажи: ${escrowAccount?.totalSalesAmount}</div>
          <div>Комиссия платформы: ${escrowAccount?.platformCommissionAmount}</div>
          <div>Доступно к распределению: ${escrowAccount?.availableForDistribution}</div>
        </div>
        <button onClick={handleManualDistribution}>
          Распределить доходы
        </button>
      </div>
      
      <div className="participants">
        <h4>Участники распределения</h4>
        {participants.map(participant => (
          <div key={participant.id} className="participant">
            <span>{participant.participantId}</span>
            <span>{(participant.sharePercentage * 100).toFixed(2)}%</span>
            <span>Получено: ${participant.totalReceived}</span>
          </div>
        ))}
      </div>
      
      <div className="distributions-history">
        <h4>История распределений</h4>
        {distributions.map(distribution => (
          <div key={distribution.id} className="distribution">
            <span>{distribution.distributionDate}</span>
            <span>${distribution.distributionAmount}</span>
            <span>{distribution.triggerType}</span>
          </div>
        ))}
      </div>
      
      <AutoDistributionSettings onSave={setupAutoDistribution} />
    </div>
  );
}
```

## Временные рамки и этапы реализации

### Этап 0: Миграция на Cloudflare Workers (4-6 недель)
- **Неделя 1-2**: Настройка инфраструктуры Cloudflare, миграция базы данных
- **Неделя 3-4**: Адаптация API и сервисов под Workers
- **Неделя 5-6**: Тестирование, оптимизация производительности

### Этап 1: Система чата (3-4 недели)
- **Неделя 1**: Создание схемы БД и ChatService
- **Неделя 2**: Реализация Durable Objects для real-time
- **Неделя 3**: Frontend интеграция
- **Неделя 4**: Тестирование и оптимизация

### Этап 2: Доставка продуктов (2-3 недели)
- **Неделя 1**: ProductDeliveryService и интеграция с R2
- **Неделя 2**: Интеграция с чатом
- **Неделя 3**: Frontend и тестирование

### Этап 3: Маркетплейс продуктов (3-4 недели)
- **Неделя 1-2**: MarketplaceService и система лицензий
- **Неделя 3**: Frontend для покупки/продажи
- **Неделя 4**: Тестирование и безопасность

### Этап 4: Эскроу-счета для продаж (4-5 недель)
- **Неделя 1-2**: SalesEscrowService и схема распределения
- **Неделя 3**: Автоматическое распределение доходов
- **Неделя 4**: Frontend для управления доходами
- **Неделя 5**: Интеграционное тестирование

## Общий срок реализации: 16-22 недели (4-5.5 месяцев)

## Риски и митигация

### Технические риски:
1. **Ограничения Cloudflare Workers** - тестирование производительности на раннем этапе
2. **Сложность real-time чата** - использование проверенных паттернов Durable Objects
3. **Безопасность файлов** - строгая валидация и подписанные URL

### Бизнес-риски:
1. **Сложность распределения доходов** - четкие правила и автоматизация
2. **Масштабируемость** - мониторинг и оптимизация с самого начала
3. **Пользовательский опыт** - итеративная разработка с обратной связью

Этот план обеспечивает поэтапную миграцию и развитие функциональности с минимизацией рисков и максимальной пользой для пользователей системы.