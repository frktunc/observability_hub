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
 * Tüm mikroservisler için birleşik hata yakalayıcı middleware
 *
 * Özellikler:
 * - Tutarlı hata yanıt formatı
 * - Correlation ID desteği
 * - Ortama göre detay kontrolü
 * - Özelleştirilebilir log ve status mapping
 */
export declare function errorHandlerMiddleware(options?: ErrorHandlerOptions): (error: Error, req: Request, res: Response, _next: NextFunction) => void;
/**
 * Varsayılan hata yakalayıcı
 * Genellikle bu kullanılabilir
 */
export declare const defaultErrorHandler: (error: Error, req: Request, res: Response, _next: NextFunction) => void;
//# sourceMappingURL=error-handler.d.ts.map