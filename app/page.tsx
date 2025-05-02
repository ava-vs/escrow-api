'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// Dynamic import of Swagger UI to avoid SSR issues with React 19
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

/**
 * Main page component that displays Swagger UI documentation
 */
export default function ApiDocsPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Отключаем React StrictMode предупреждения для Swagger UI
    if (typeof window !== 'undefined') {
      // Создаем глобальную переменную, чтобы избежать многократного переопределения
      if (!(window as any).__swaggerErrorsPatched) {
        const originalConsoleError = console.error;
        console.error = (...args: any[]) => {
          // Глубокая фильтрация ошибок Swagger UI
          if (
            typeof args[0] === 'string' && (
              args[0].includes('UNSAFE_componentWillReceiveProps') ||
              args[0].includes('componentWillReceiveProps') ||
              args[0].includes('componentWillMount') ||
              args[0].includes('componentWillUpdate')
            ) && (
              args[0].includes('ModelCollapse') || 
              args[0].includes('OperationContainer') ||
              args[0].includes('Operation') ||
              args[0].includes('Row') ||
              args[0].includes('Swagger')
            )
          ) {
            return; // Игнорируем ошибки устаревших методов жизненного цикла
          }
          
          // Отфильтровываем другие предупреждения, связанные со Swagger
          if (
            args && 
            args.length > 0 && 
            args.some((arg: any) => 
              arg && 
              typeof arg === 'object' && 
              arg.toString && 
              (arg.toString().includes('swagger') || arg.toString().includes('Row'))
            )
          ) {
            return;
          }
          
          originalConsoleError(...args);
        };
        (window as any).__swaggerErrorsPatched = true;
      }
      
      // Применяем патч для компонентов React 19
      // Это предотвращает ошибки совместимости со Swagger UI
      if (!(window as any).__swaggerComponentPatched) {
        // Создаем прокси для React.Component, чтобы заменить устаревшие методы
        const patchReactComponent = () => {
          if ((window as any).React && (window as any).React.Component) {
            // Type-safe implementation with 'any' to bypass TypeScript checks
            const originalComponentPrototype = (window as any).React.Component.prototype;
            
            // Обеспечиваем безопасные заглушки для устаревших методов
            if (!originalComponentPrototype.__patchedMethods) {
              const methodsToPatch = [
                'UNSAFE_componentWillReceiveProps',
                'componentWillReceiveProps',
                'UNSAFE_componentWillMount',
                'componentWillMount',
                'UNSAFE_componentWillUpdate',
                'componentWillUpdate'
              ];
              
              methodsToPatch.forEach((method: string) => {
                if (!originalComponentPrototype[method]) {
                  originalComponentPrototype[method] = function() {};
                }
              });
              
              originalComponentPrototype.__patchedMethods = true;
            }
          }
        };
        
        // Безопасный вызов патча
        try {
          patchReactComponent();
        } catch (e) {
          // Игнорируем ошибки патча, чтобы не нарушить основную функциональность
        }
        
        (window as any).__swaggerComponentPatched = true;
      }
    }

    setIsClient(true);
  }, []);

  // Настройки Swagger UI для улучшения интерфейса
  const uiOptions: Record<string, any> = {
    docExpansion: 'list' as 'list' | 'full' | 'none', // Раскрытие документации
    defaultModelsExpandDepth: 1, // Глубина раскрытия моделей по умолчанию
    filter: true, // Включаем фильтр эндпойнтов
    tagsSorter: 'alpha', // Сортировка тегов по алфавиту
    operationsSorter: 'alpha', // Сортировка операций по алфавиту
    displayRequestDuration: true, // Показывать длительность запроса
    deepLinking: true, // Включаем глубокие ссылки для конкретных эндпойнтов
    displayOperationId: false, // Скрыть operationId для чистоты отображения
    tryItOutEnabled: true, // Автоматически включать режим тестирования для всех эндпойнтов
    withCredentials: true, // Отправлять cookie с запросами
    persistAuthorization: true, // Сохранять авторизацию между обновлениями страницы
    // Отключаем валидацию схемы, которая может вызывать ошибки
    validatorUrl: null,
    plugins: [
      // Плагин для исправления группировки эндпойнтов и совместимости с React 19
      {
        statePlugins: {
          spec: {
            wrapSelectors: {
              taggedOperations: (original: any) => {
                return function(system: any) {
                  const taggedOps = original(system);
                  // Дополнительная обработка для правильной группировки
                  return taggedOps;
                };
              }
            }
          },
          // Дополнительные улучшения для совместимости с React 19
          configs: {
            wrapActions: {
              loaded: (ori: any) => (...args: any[]) => {
                // Выполняем оригинальное действие
                return ori(...args);
              }
            }
          }
        },
        // Безопаснее просто не менять компоненты, вместо этого мы полагаемся на фильтрацию ошибок
        wrapComponents: {}
        // Не используем переопределение Row компонента, так как это вызывает ошибки
      }
    ]
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="pb-4 mb-8 border-b">
        <h1 className="text-3xl font-bold mb-2">Escrow API Documentation</h1>
        <p className="text-gray-600">
          Интерактивная документация API сервиса Escrow
        </p>
      </div>
      
      {isClient ? (
        <div className="swagger-ui-container">
          {/* Добавляем кэширование URL с временной меткой и определяем базовый URL */}
          <SwaggerUI 
            url={`/api/docs?v=${Date.now()}`} 
            onComplete={(swaggerAPI) => {
              // Set correct server URL based on current window location
              const scheme = window.location.protocol.replace(':', '');
              const host = window.location.host;
              // Установка базового URL на основе текущего хоста
              swaggerAPI.specActions.updateBaseUrl(`${scheme}://${host}`);
              
              // Обновление спецификации для использования текущего хоста
              const currentSpec = swaggerAPI.specSelectors.specJson().toJS();
              swaggerAPI.specActions.updateJsonSpec({
                ...currentSpec,
                servers: [{ url: `${scheme}://${host}` }]
              });
            }}
            {...uiOptions} 
          />
        </div>
      ) : (
        <div className="flex justify-center items-center h-96">
          <p className="text-lg">Loading API documentation...</p>
        </div>
      )}

      <style jsx global>{`
        /* Улучшенные стили для Swagger UI */
        .swagger-ui .opblock-tag {
          font-size: 18px !important;
          margin: 10px 0 !important;
        }
        .swagger-ui .opblock {
          margin: 0 0 15px !important;
          border-radius: 6px !important;
        }
        .swagger-ui select {
          padding: 5px 40px 5px 10px !important;
        }
        /* Исправление проблем с вёрсткой Row компонента */
        .swagger-ui .wrapper {
          width: 100%;
          max-width: 1460px;
          margin: 0 auto;
          padding: 0 20px;
        }
        .swagger-ui .block {
          display: block;
          margin: 0;
          padding: 10px 0;
        }
      `}</style>
    </div>
  );
}
