import { Request, Response, NextFunction } from 'express';

/**
 * Hata yanıtı biçimi
 */
export interface ErrorResponse {
  error: {
    message: string;
    type: string;
    correlationId: string;
    timestamp: string;
    details?: any;
  };
}

/**
 * Hata yakalayıcı yapılandırma seçenekleri
 */
export interface ErrorHandlerOptions {
  /**
   * Geliştirme ortamında stack trace dahil edilsin mi?
   * @default development'ta true, production'da false
   */
  includeStackTrace?: boolean;

  /**
   * Hatalar konsola yazılsın mı?
   * @default true
   */
  logErrors?: boolean;

  /**
   * Özel hata günlüğü fonksiyonu
   */
  customLogger?: (error: Error, req: Request) => void;

  /**
   * Özel hata adı - HTTP status kodu eşleşmesi
   */
  statusCodeMapping?: Record<string, number>;

  /**
   * Hata detayları yanıta dahil edilsin mi?
   * @default production'da false
   */
  includeDetails?: boolean;
}

/**
 * Varsayılan hata adı - HTTP durum kodu eşlemeleri
 */
const defaultStatusCodeMapping: Record<string, number> = {
  ValidationError: 400,
  CastError: 400,
  NotFoundError: 404,
  UnauthorizedError: 401,
  ForbiddenError: 403,
  ConflictError: 409,
  TooManyRequestsError: 429,
  TimeoutError: 408,
  PayloadTooLargeError: 413,
  UnsupportedMediaTypeError: 415,
  UnprocessableEntityError: 422,
  InternalServerError: 500,
  NotImplementedError: 501,
  BadGatewayError: 502,
  ServiceUnavailableError: 503,
  GatewayTimeoutError: 504,
};

/**
 * Tüm mikroservisler için birleşik hata yakalayıcı middleware
 * 
 * Özellikler:
 * - Tutarlı hata yanıt formatı
 * - Correlation ID desteği
 * - Ortama göre detay kontrolü
 * - Özelleştirilebilir log ve status mapping
 */
export function errorHandlerMiddleware(options: ErrorHandlerOptions = {}) {
  const {
    includeStackTrace = process.env.NODE_ENV === 'development',
    logErrors = true,
    customLogger,
    statusCodeMapping = {},
    includeDetails = process.env.NODE_ENV !== 'production'
  } = options;

  const statusCodes = { ...defaultStatusCodeMapping, ...statusCodeMapping };

  return (error: Error, req: Request, res: Response, _next: NextFunction): void => {
    const correlationId = req.correlationId || 'unknown';
    const timestamp = new Date().toISOString();
    const statusCode = statusCodes[error.name] || 500;

    // Hataları logla
    if (logErrors) {
      if (customLogger) {
        customLogger(error, req);
      } else {
        console.error(`[${correlationId}] ${req.method} ${req.path}`, {
          name: error.name,
          message: error.message,
          stack: includeStackTrace ? error.stack : undefined,
          correlationId,
          timestamp
        });
      }
    }

    // Hata yanıtı oluştur
    const errorResponse: ErrorResponse = {
      error: {
        message: error.message || 'Internal Server Error',
        type: error.name || 'Error',
        correlationId,
        timestamp
      }
    };

    // Geliştirme ortamında detay ekle
    if (includeDetails) {
      errorResponse.error.details = {
        method: req.method,
        path: req.path,
        statusCode,
        stack: includeStackTrace ? error.stack : undefined
      };
    }

    // JSON hata yanıtı döndür
    res.status(statusCode).json(errorResponse);
  };
}

/**
 * Varsayılan hata yakalayıcı
 * Genellikle bu kullanılabilir
 */
export const defaultErrorHandler = errorHandlerMiddleware();
