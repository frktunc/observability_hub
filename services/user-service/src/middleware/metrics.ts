import { Counter, Histogram, register } from 'prom-client';
import { Request, Response, NextFunction } from 'express';

function getOrCreateMetric(name: string, MetricClass: any, config: any) {
  if (register.getSingleMetric(name)) {
    return register.getSingleMetric(name);
  }
  return new MetricClass(config);
}

export const httpRequestsTotal = getOrCreateMetric('http_requests_total', Counter, {
  name: 'http_requests_total',
  help: 'Toplam HTTP istek sayısı',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDurationSeconds = getOrCreateMetric('http_request_duration_seconds', Histogram, {
  name: 'http_request_duration_seconds',
  help: 'HTTP isteklerinin yanıt süreleri (saniye)',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
});

export function prometheusMetricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const route = req.route && req.route.path ? req.route.path : req.path;
  const end = httpRequestDurationSeconds.startTimer({
    method: req.method,
    route,
  });

  res.on('finish', () => {
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });
    end({ status_code: res.statusCode });
  });

  next();
} 