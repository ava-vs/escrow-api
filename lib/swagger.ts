import { createSwaggerSpec } from 'next-swagger-doc';
import fs from 'fs';
import path from 'path';

/**
 * Converts Next.js route parameter format [param] to OpenAPI format {param}
 */
const convertNextPathToOpenApi = (nextPath: string): string => {
  // Replace [paramName] with {paramName}
  return nextPath.replace(/\[(\w+)\]/g, '{$1}');
};

/**
 * Scans directory recursively to find all route.ts files
 */
const scanRoutesDir = (dir: string, basePath = '/api'): Record<string, any> => {
  const routes: Record<string, any> = {};
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip auth folder since it's handled separately
      if (entry.name === 'auth' || entry.name === 'docs') continue;
      
      const subPath = path.join(basePath, entry.name);
      const subRoutes = scanRoutesDir(fullPath, subPath);
      Object.assign(routes, subRoutes);
    } else if (entry.name === 'route.ts') {
      // Convert path to OpenAPI format and add route
      const openApiPath = convertNextPathToOpenApi(basePath);
      routes[openApiPath] = {
        path: openApiPath,
        file: fullPath,
      };
    }
  }
  
  return routes;
};

/**
 * Returns the appropriate tag name for a given API path
 */
const getTagForPath = (path: string): string => {
  if (path.includes('/orders')) return 'orders';
  if (path.includes('/users')) return 'users';
  if (path.includes('/documents')) return 'documents';
  if (path.includes('/group-orders')) return 'group-orders';
  return 'default';
};

/**
 * Returns the resource name for a tag (singular form for API endpoints)
 */
const getResourceNameForTag = (tag: string): string => {
  switch (tag) {
    case 'orders': return 'order';
    case 'users': return 'user';
    case 'documents': return 'document';
    case 'group-orders': return 'group order';
    default: return 'resource';
  }
};

/**
 * Swagger configuration for API documentation
 */
export const getApiDocs = () => {
  const apiDir = path.join(process.cwd(), 'app/api');
  const routePaths = scanRoutesDir(apiDir);
  
  // Add debugging log for development
  console.log('Found API routes:', Object.keys(routePaths));
  
  // Generate schemas based on Zod schemas from route files
  const schemas: Record<string, any> = {
    Error: {
      type: 'object',
      properties: {
        error: { type: 'string' },
        details: { type: 'object' }
      }
    },
    Order: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        customerId: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['CREATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    },
    User: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
        type: { type: 'string', enum: ['ADMIN', 'FREELANCER', 'CUSTOMER'] },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    },
    Document: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        type: { type: 'string' },
        url: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    },
    Milestone: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        orderId: { type: 'string', format: 'uuid' },
        description: { type: 'string' },
        amount: { type: 'string' },
        status: { type: 'string', enum: ['PENDING', 'COMPLETED', 'CANCELLED'] },
        deadline: { type: 'string', format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    },
    GroupOrder: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['CREATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    }
  };
  
  // Define paths based on available routes
  const paths: Record<string, any> = {};
  
  // Определяем теги с описаниями для группировки эндпойнтов
  const tags = [
    { name: 'orders', description: 'Управление заказами' },
    { name: 'users', description: 'Управление пользователями' },
    { name: 'documents', description: 'Управление документами' },
    { name: 'group-orders', description: 'Управление групповыми заказами' },
    { name: 'default', description: 'Другие API-маршруты' }
  ];
  
  // Упрощаем подход к созданию API спецификации
  // Создаем индивидуальные операции для каждой категории
  
  // Функция определения категории по пути
  const getRouteCategory = (path: string): string => {
    if (path.includes('/orders/') || path === '/api/orders') return 'orders';
    if (path.includes('/users/') || path === '/api/users') return 'users';
    if (path.includes('/documents/') || path === '/api/documents') return 'documents';
    if (path.includes('/group-orders/') || path === '/api/group-orders') return 'group-orders';
    return 'default';
  };
  Object.keys(routePaths).forEach(routePath => {
    const category = getRouteCategory(routePath);
    const tagName = category;
    
    // Add GET route
    paths[routePath] = {
      get: {
        tags: [tagName],
        summary: `Get ${getResourceNameForTag(tagName)}s`,
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: `#/components/schemas/${routePath.split('/')[2] === 'orders' ? 'Order' : 
                           routePath.split('/')[2] === 'users' ? 'User' : 
                           routePath.split('/')[2] === 'documents' ? 'Document' : 'Object'}`
                  }
                }
              }
            }
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          }
        }
      }
    };
    
    // If route might support POST
    if (routePath !== '/api/seed') {
      paths[routePath].post = {
        tags: [tagName],
        summary: `Create ${getResourceNameForTag(tagName)}`,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object'
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: `#/components/schemas/${routePath.split('/')[2] === 'orders' ? 'Order' : 
                           routePath.split('/')[2] === 'users' ? 'User' : 
                           routePath.split('/')[2] === 'documents' ? 'Document' : 'Object'}`
                }
              }
            }
          },
          '400': {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          }
        }
      };
    }
    
    // Add route for specific item if ID pattern is present
    const itemPath = `${routePath}/{id}`;
    
    paths[itemPath] = {
      get: {
        tags: [tagName],
        summary: `Get ${getResourceNameForTag(tagName)} by ID`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid'
            },
            description: 'ID of the resource to retrieve'
          }
        ],
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  $ref: `#/components/schemas/${routePath.split('/')[2] === 'orders' ? 'Order' : 
                           routePath.split('/')[2] === 'users' ? 'User' : 
                           routePath.split('/')[2] === 'documents' ? 'Document' : 'Object'}`
                }
              }
            }
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          }
        }
      },
      patch: {
        tags: [tagName],
        summary: `Update ${getResourceNameForTag(tagName)}`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid'
            },
            description: 'ID of the resource to update'
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Updated successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: `#/components/schemas/${routePath.split('/')[2] === 'orders' ? 'Order' : 
                           routePath.split('/')[2] === 'users' ? 'User' : 
                           routePath.split('/')[2] === 'documents' ? 'Document' : 'Object'}`
                }
              }
            }
          },
          '400': {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          }
        }
      },
      delete: {
        tags: [tagName],
        summary: `Delete ${getResourceNameForTag(tagName)}`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid'
            },
            description: 'ID of the resource to delete'
          }
        ],
        responses: {
          '204': {
            description: 'Deleted successfully'
          },
          '404': {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          }
        }
      }
    };
  });
  
  // Check if we have any API paths, if not, provide some examples
  if (Object.keys(paths).length === 0) {
    console.log('No API paths found, adding example paths for demonstration');
    
    // Add example paths if no real paths are found
    paths['/api/orders'] = {
      get: {
        tags: ['orders'],
        summary: `Get ${getResourceNameForTag('orders')}s`,
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Order'
                  }
                }
              }
            }
          }
        }
      }
    };
    
    paths['/api/users'] = {
      get: {
        tags: ['users'],
        summary: `Get ${getResourceNameForTag('users')}s`,
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/User'
                  }
                }
              }
            }
          }
        }
      }
    };
  }
  
  console.log('API paths found:', Object.keys(paths));
  
  const spec = createSwaggerSpec({
    apiFolder: 'app/api',
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Escrow API Documentation',
        version: '1.0.0',
        description: 'Документация API сервиса Escrow для управления сделками через условное депонирование',
        contact: {
          name: 'API Support',
          email: 'support@example.com',
        },
      },
      servers: [
        {
          url: '/',
          description: 'API Server',
        },
      ],
      tags,
      components: {
        schemas,
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [
        {
          BearerAuth: [],
        },
      ],
      paths,
    },
  });
  
  return spec;
};
