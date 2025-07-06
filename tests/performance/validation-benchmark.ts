/**
 * Performance benchmarking tests for event validation
 * Target: 10,000+ validations per second
 */

import { SimpleEventValidator } from '../../typescript/src/validators/simple-validator.ts';

// Browser/Node compatibility declarations
declare const global: any;
declare const process: any;
declare const require: any;
declare const module: any;

interface BenchmarkResult {
  testName: string;
  totalEvents: number;
  totalTime: number;
  averageTime: number;
  throughput: number;
  memoryUsage: number;
  passed: boolean;
  target: number;
}

interface BenchmarkSuite {
  name: string;
  results: BenchmarkResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    overallThroughput: number;
    passed: boolean;
  };
}

/**
 * Performance benchmark test suite
 */
export class ValidationBenchmark {
  private validator: SimpleEventValidator;
  private results: BenchmarkResult[] = [];
  
  constructor() {
    this.validator = new SimpleEventValidator();
  }

  /**
   * Run all benchmark tests
   */
  public async runBenchmarks(): Promise<BenchmarkSuite> {
    console.log('🚀 Starting Event Validation Performance Benchmarks');
    console.log('Target: 10,000+ validations per second\n');

    // Test scenarios
    await this.benchmarkSingleValidation();
    await this.benchmarkBatchValidation();
    await this.benchmarkComplexEvents();
    await this.benchmarkInvalidEvents();
    await this.benchmarkMixedEventTypes();
    await this.benchmarkMemoryUsage();
    await this.benchmarkConcurrentValidation();

    return this.generateSummary();
  }

  /**
   * Benchmark single event validation
   */
  private async benchmarkSingleValidation(): Promise<void> {
    const testName = 'Single Event Validation';
    const eventCount = 50000;
    const target = 10000; // 10K/second

    console.log(`📊 Running ${testName}...`);

    const events = this.generateValidLogEvents(eventCount);
    const startTime = this.getPerformanceTime();
    const startMemory = this.getMemoryUsage();

    for (const event of events) {
      this.validator.validate(event);
    }

    const endTime = this.getPerformanceTime();
    const endMemory = this.getMemoryUsage();
    
    const result = this.calculateBenchmarkResult(
      testName,
      eventCount,
      endTime - startTime,
      target,
      endMemory - startMemory
    );

    this.results.push(result);
    this.logResult(result);
  }

  /**
   * Benchmark batch validation
   */
  private async benchmarkBatchValidation(): Promise<void> {
    const testName = 'Batch Event Validation';
    const eventCount = 50000;
    const batchSize = 1000;
    const target = 15000; // Higher target for batch processing

    console.log(`📊 Running ${testName}...`);

    const events = this.generateValidLogEvents(eventCount);
    const batches = this.createBatches(events, batchSize);
    
    const startTime = this.getPerformanceTime();
    const startMemory = this.getMemoryUsage();

    for (const batch of batches) {
      this.validator.validateBatch(batch);
    }

    const endTime = this.getPerformanceTime();
    const endMemory = this.getMemoryUsage();

    const result = this.calculateBenchmarkResult(
      testName,
      eventCount,
      endTime - startTime,
      target,
      endMemory - startMemory
    );

    this.results.push(result);
    this.logResult(result);
  }

  /**
   * Benchmark complex events with nested structures
   */
  private async benchmarkComplexEvents(): Promise<void> {
    const testName = 'Complex Event Validation';
    const eventCount = 25000;
    const target = 8000; // Lower target for complex events

    console.log(`📊 Running ${testName}...`);

    const events = this.generateComplexEvents(eventCount);
    const startTime = this.getPerformanceTime();
    const startMemory = this.getMemoryUsage();

    for (const event of events) {
      this.validator.validate(event);
    }

    const endTime = this.getPerformanceTime();
    const endMemory = this.getMemoryUsage();

    const result = this.calculateBenchmarkResult(
      testName,
      eventCount,
      endTime - startTime,
      target,
      endMemory - startMemory
    );

    this.results.push(result);
    this.logResult(result);
  }

  /**
   * Benchmark validation of invalid events
   */
  private async benchmarkInvalidEvents(): Promise<void> {
    const testName = 'Invalid Event Validation';
    const eventCount = 25000;
    const target = 5000; // Lower target due to error processing

    console.log(`📊 Running ${testName}...`);

    const events = this.generateInvalidEvents(eventCount);
    const startTime = this.getPerformanceTime();
    const startMemory = this.getMemoryUsage();

    for (const event of events) {
      this.validator.validate(event);
    }

    const endTime = this.getPerformanceTime();
    const endMemory = this.getMemoryUsage();

    const result = this.calculateBenchmarkResult(
      testName,
      eventCount,
      endTime - startTime,
      target,
      endMemory - startMemory
    );

    this.results.push(result);
    this.logResult(result);
  }

  /**
   * Benchmark mixed event types
   */
  private async benchmarkMixedEventTypes(): Promise<void> {
    const testName = 'Mixed Event Types Validation';
    const eventCount = 30000;
    const target = 9000;

    console.log(`📊 Running ${testName}...`);

    const events = this.generateMixedEvents(eventCount);
    const startTime = this.getPerformanceTime();
    const startMemory = this.getMemoryUsage();

    for (const event of events) {
      this.validator.validate(event);
    }

    const endTime = this.getPerformanceTime();
    const endMemory = this.getMemoryUsage();

    const result = this.calculateBenchmarkResult(
      testName,
      eventCount,
      endTime - startTime,
      target,
      endMemory - startMemory
    );

    this.results.push(result);
    this.logResult(result);
  }

  /**
   * Benchmark memory usage during validation
   */
  private async benchmarkMemoryUsage(): Promise<void> {
    const testName = 'Memory Usage Validation';
    const eventCount = 100000;
    const target = 8000;

    console.log(`📊 Running ${testName}...`);

    const initialMemory = this.getMemoryUsage();
    const events = this.generateValidLogEvents(eventCount);
    const startTime = this.getPerformanceTime();
    const startMemory = this.getMemoryUsage();

    // Validate in chunks to monitor memory
    const chunkSize = 10000;
    let maxMemoryIncrease = 0;

    for (let i = 0; i < events.length; i += chunkSize) {
      const chunk = events.slice(i, i + chunkSize);
      
      for (const event of chunk) {
        this.validator.validate(event);
      }

      const currentMemory = this.getMemoryUsage();
      const memoryIncrease = currentMemory - initialMemory;
      maxMemoryIncrease = Math.max(maxMemoryIncrease, memoryIncrease);

      // Force garbage collection if available
      this.forceGC();
    }

    const endTime = this.getPerformanceTime();

    const result = this.calculateBenchmarkResult(
      testName,
      eventCount,
      endTime - startTime,
      target,
      maxMemoryIncrease
    );

    this.results.push(result);
    this.logResult(result);
  }

  /**
   * Benchmark concurrent validation
   */
  private async benchmarkConcurrentValidation(): Promise<void> {
    const testName = 'Concurrent Validation';
    const eventCount = 50000;
    const concurrency = 4;
    const target = 12000; // Higher target for concurrent processing

    console.log(`📊 Running ${testName}...`);

    const events = this.generateValidLogEvents(eventCount);
    const chunks = this.createBatches(events, Math.ceil(eventCount / concurrency));

    const startTime = this.getPerformanceTime();
    const startMemory = this.getMemoryUsage();

    // Run validation concurrently
    const promises = chunks.map(async (chunk) => {
      const validator = new SimpleEventValidator();
      return chunk.map(event => validator.validate(event));
    });

    await Promise.all(promises);

    const endTime = this.getPerformanceTime();
    const endMemory = this.getMemoryUsage();

    const result = this.calculateBenchmarkResult(
      testName,
      eventCount,
      endTime - startTime,
      target,
      endMemory - startMemory
    );

    this.results.push(result);
    this.logResult(result);
  }

  /**
   * Generate valid log events for testing
   */
  private generateValidLogEvents(count: number): any[] {
    const events: any[] = [];
    const logLevels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
    const environments = ['production', 'staging', 'development'];

    for (let i = 0; i < count; i++) {
      events.push({
        eventId: `event-${i}-${Date.now()}`,
        eventType: 'log.message.created',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        correlationId: `correlation-${i}`,
        source: {
          service: 'test-service',
          version: '1.0.0',
          instance: 'instance-1',
          region: 'us-east-1'
        },
        metadata: {
          priority: 'normal',
          environment: environments[i % environments.length],
          tags: [`test-${i % 10}`, 'benchmark']
        },
        data: {
          level: logLevels[i % logLevels.length],
          message: `Test log message ${i}`,
          timestamp: new Date().toISOString(),
          logger: {
            name: 'test-logger',
            version: '1.0.0'
          }
        }
      });
    }

    return events;
  }

  /**
   * Generate complex events with nested structures
   */
  private generateComplexEvents(count: number): any[] {
    const events: any[] = [];

    for (let i = 0; i < count; i++) {
      events.push({
        eventId: `complex-event-${i}`,
        eventType: 'log.error.created',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        correlationId: `correlation-${i}`,
        source: {
          service: 'complex-service',
          version: '2.1.0',
          instance: `instance-${i % 5}`,
          region: 'us-west-2'
        },
        tracing: {
          traceId: `trace-${i.toString(16).padStart(32, '0')}`,
          spanId: `span-${i.toString(16).padStart(16, '0')}`,
          flags: 1
        },
        metadata: {
          priority: 'high',
          environment: 'production',
          tags: Array.from({ length: 10 }, (_, j) => `tag-${j}`),
          retryCount: i % 3
        },
        data: {
          level: 'ERROR',
          message: `Complex error message with details ${i}`,
          timestamp: new Date().toISOString(),
          logger: {
            name: 'complex-logger',
            version: '2.0.0',
            thread: `thread-${i % 4}`
          },
          context: {
            userId: `user-${i}`,
            sessionId: `session-${i}`,
            requestId: `request-${i}`,
            operation: 'complex-operation',
            component: 'error-handler'
          },
          structured: {
            fields: {
              field1: `value-${i}`,
              field2: i * 2,
              field3: i % 2 === 0,
              nestedObject: {
                nested1: `nested-${i}`,
                nested2: [1, 2, 3, i]
              }
            },
            metrics: {
              duration: Math.random() * 1000,
              memoryUsage: Math.floor(Math.random() * 1000000),
              cpuUsage: Math.random() * 100
            }
          },
          error: {
            type: 'ComplexError',
            code: `ERR_${i}`,
            stack: `Error stack trace line ${i}\n  at function${i}`,
            fingerprint: `fp-${i.toString(16)}`
          },
          source: {
            file: `complex-file-${i % 10}.ts`,
            line: 100 + (i % 500),
            function: `complexFunction${i % 20}`,
            class: `ComplexClass${i % 5}`
          }
        }
      });
    }

    return events;
  }

  /**
   * Generate invalid events for error handling tests
   */
  private generateInvalidEvents(count: number): any[] {
    const events: any[] = [];
    const invalidPatterns = [
      // Missing required fields
      () => ({ eventType: 'log.message.created' }),
      // Invalid UUID
      () => ({
        eventId: 'invalid-uuid',
        eventType: 'log.message.created',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        correlationId: 'invalid-correlation-id'
      }),
      // Invalid timestamp
      () => ({
        eventId: '123e4567-e89b-12d3-a456-426614174000',
        eventType: 'log.message.created',
        version: '1.0.0',
        timestamp: 'invalid-timestamp',
        correlationId: '123e4567-e89b-12d3-a456-426614174001'
      }),
      // Missing source
      () => ({
        eventId: '123e4567-e89b-12d3-a456-426614174000',
        eventType: 'log.message.created',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        correlationId: '123e4567-e89b-12d3-a456-426614174001',
        metadata: { priority: 'normal' }
      }),
      // Invalid event type
      () => ({
        eventId: '123e4567-e89b-12d3-a456-426614174000',
        eventType: 'invalid.event.type',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        correlationId: '123e4567-e89b-12d3-a456-426614174001',
        source: { service: 'test', version: '1.0.0' },
        metadata: { priority: 'normal' }
      })
    ];

    for (let i = 0; i < count; i++) {
      const pattern = invalidPatterns[i % invalidPatterns.length];
      events.push(pattern());
    }

    return events;
  }

  /**
   * Generate mixed event types
   */
  private generateMixedEvents(count: number): any[] {
    const events: any[] = [];
    const logEvents = this.generateValidLogEvents(Math.floor(count * 0.6));
    const complexEvents = this.generateComplexEvents(Math.floor(count * 0.3));
    const invalidEvents = this.generateInvalidEvents(Math.floor(count * 0.1));

    events.push(...logEvents, ...complexEvents, ...invalidEvents);
    
    // Shuffle array
    for (let i = events.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [events[i], events[j]] = [events[j], events[i]];
    }

    return events.slice(0, count);
  }

  /**
   * Create batches from events array
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Calculate benchmark result
   */
  private calculateBenchmarkResult(
    testName: string,
    totalEvents: number,
    totalTime: number,
    target: number,
    memoryUsage: number
  ): BenchmarkResult {
    const averageTime = totalTime / totalEvents;
    const throughput = (totalEvents / totalTime) * 1000; // events per second
    const passed = throughput >= target;

    return {
      testName,
      totalEvents,
      totalTime,
      averageTime,
      throughput,
      memoryUsage,
      passed,
      target
    };
  }

  /**
   * Get current performance time
   */
  private getPerformanceTime(): number {
    // Use performance.now() if available, otherwise Date.now()
    if (typeof performance !== 'undefined' && performance.now) {
      return performance.now();
    }
    return Date.now();
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    try {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        return process.memoryUsage().heapUsed;
      }
    } catch (error) {
      // Ignore memory usage errors in browser environments
    }
    return 0;
  }

  /**
   * Force garbage collection if available
   */
  private forceGC(): void {
    try {
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
      }
    } catch (error) {
      // Ignore GC errors
    }
  }

  /**
   * Log benchmark result
   */
  private logResult(result: BenchmarkResult): void {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const throughputFormatted = result.throughput.toLocaleString(undefined, { maximumFractionDigits: 0 });
    const targetFormatted = result.target.toLocaleString();
    const memoryMB = (result.memoryUsage / 1024 / 1024).toFixed(2);

    console.log(`${status} ${result.testName}`);
    console.log(`   Events: ${result.totalEvents.toLocaleString()}`);
    console.log(`   Time: ${result.totalTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${throughputFormatted}/sec (target: ${targetFormatted}/sec)`);
    console.log(`   Avg Time: ${result.averageTime.toFixed(4)}ms`);
    console.log(`   Memory: ${memoryMB}MB`);
    console.log();
  }

  /**
   * Generate benchmark summary
   */
  private generateSummary(): BenchmarkSuite {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const totalEvents = this.results.reduce((sum, r) => sum + r.totalEvents, 0);
    const totalTime = this.results.reduce((sum, r) => sum + r.totalTime, 0);
    const overallThroughput = (totalEvents / totalTime) * 1000;

    const summary = {
      totalTests,
      passedTests,
      overallThroughput,
      passed: passedTests === totalTests
    };

    console.log('📈 BENCHMARK SUMMARY');
    console.log('==================');
    console.log(`Tests: ${passedTests}/${totalTests} passed`);
    console.log(`Overall Throughput: ${overallThroughput.toLocaleString(undefined, { maximumFractionDigits: 0 })}/sec`);
    console.log(`Status: ${summary.passed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

    return {
      name: 'Event Validation Performance Benchmark',
      results: this.results,
      summary
    };
  }
}

/**
 * Run benchmarks if called directly
 */
function runIfMain(): void {
  try {
    if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
      async function runBenchmarks() {
        const benchmark = new ValidationBenchmark();
        const suite = await benchmark.runBenchmarks();
        
        // Exit with error code if tests failed
        if (typeof process !== 'undefined' && process.exit) {
          process.exit(suite.summary.passed ? 0 : 1);
        }
      }

      runBenchmarks().catch(console.error);
    }
  } catch (error) {
    // Ignore errors in browser environment
  }
}

// Execute if main
runIfMain(); 