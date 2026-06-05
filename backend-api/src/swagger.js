const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Facebook Page Backend API - Bai 1',
      version: '1.0.0',
      description: 'Swagger UI de demo Bai 1: login, lay bai viet, dang bai va lay comment qua backend proxy.'
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local demo server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              example: 'admin'
            },
            password: {
              type: 'string',
              example: 'admin123'
            }
          }
        },
        CreatePostRequest: {
          type: 'object',
          required: ['message'],
          properties: {
            message: {
              type: 'string',
              example: 'Demo Bai 1 - dang bai qua backend proxy'
            }
          }
        },
        ReplyCommentRequest: {
          type: 'object',
          required: ['message'],
          properties: {
            message: {
              type: 'string',
              example: 'Cam on ban da binh luan!'
            }
          }
        },
        StandardSuccess: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object'
            },
            error: {
              nullable: true,
              example: null
            },
            timestamp: {
              type: 'string',
              example: '2026-06-05T00:00:00.000Z'
            }
          }
        },
        StandardError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            data: {
              nullable: true,
              example: null
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'FB_TOKEN_EXPIRED'
                },
                message: {
                  type: 'string',
                  example: 'Page access token is expired or invalid.'
                },
                details: {
                  nullable: true
                },
                retryable: {
                  type: 'boolean',
                  example: false
                }
              }
            },
            timestamp: {
              type: 'string',
              example: '2026-06-05T00:00:00.000Z'
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Auth',
        description: 'Dang nhap lay JWT'
      },
      {
        name: 'Facebook Page',
        description: 'API proxy toi Facebook Graph API'
      },
      {
        name: 'System',
        description: 'Health check'
      }
    ],
    paths: {
      '/health': {
        get: {
          tags: ['System'],
          summary: 'Kiem tra backend dang chay',
          responses: {
            200: {
              description: 'Backend dang hoat dong',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/StandardSuccess'
                  }
                }
              }
            }
          }
        }
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Dang nhap admin va lay JWT',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LoginRequest'
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Dang nhap thanh cong',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/StandardSuccess'
                  }
                }
              }
            },
            401: {
              description: 'Sai tai khoan hoac mat khau',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/StandardError'
                  }
                }
              }
            }
          }
        }
      },
      '/posts': {
        get: {
          tags: ['Facebook Page'],
          summary: 'Lay danh sach bai viet cua Page',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'page_id',
              in: 'query',
              required: false,
              schema: {
                type: 'string'
              },
              description: 'Neu bo trong se dung PAGE_ID trong .env'
            }
          ],
          responses: {
            200: {
              description: 'Danh sach bai viet tu Facebook',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/StandardSuccess'
                  }
                }
              }
            },
            401: {
              description: 'JWT hoac Page token khong hop le',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/StandardError'
                  }
                }
              }
            }
          }
        }
      },
      '/post': {
        post: {
          tags: ['Facebook Page'],
          summary: 'Dang bai moi len Facebook Page',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'page_id',
              in: 'query',
              required: false,
              schema: {
                type: 'string'
              },
              description: 'Neu bo trong se dung PAGE_ID trong .env'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreatePostRequest'
                }
              }
            }
          },
          responses: {
            201: {
              description: 'Dang bai thanh cong',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/StandardSuccess'
                  }
                }
              }
            }
          }
        }
      },
      '/comments': {
        get: {
          tags: ['Facebook Page'],
          summary: 'Lay comment cua mot bai viet theo post_id',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'post_id',
              in: 'query',
              required: true,
              schema: {
                type: 'string'
              },
              description: 'ID bai viet Facebook'
            }
          ],
          responses: {
            200: {
              description: 'Danh sach comment tu Facebook',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/StandardSuccess'
                  }
                }
              }
            }
          }
        }
      },
      '/comments/{postId}': {
        get: {
          tags: ['Facebook Page'],
          summary: 'Alias lay comment cua mot bai viet theo path',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'postId',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: 'ID bai viet Facebook'
            }
          ],
          responses: {
            200: {
              description: 'Danh sach comment tu Facebook',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/StandardSuccess'
                  }
                }
              }
            }
          }
        }
      },
      '/comments/{commentId}/reply': {
        post: {
          tags: ['Facebook Page'],
          summary: 'Tra loi mot comment',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'commentId',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: 'ID comment Facebook'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ReplyCommentRequest'
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Tra loi comment thanh cong',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/StandardSuccess'
                  }
                }
              }
            }
          }
        }
      },
      '/comments/{commentId}/hide': {
        post: {
          tags: ['Facebook Page'],
          summary: 'An mot comment',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'commentId',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: 'ID comment Facebook'
            }
          ],
          responses: {
            200: {
              description: 'An comment thanh cong',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/StandardSuccess'
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: []
});

module.exports = {
  swaggerUi,
  swaggerSpec
};
