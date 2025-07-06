const { SimpleEventValidator } = require('./dist/validators/simple-validator.js');

console.log('🧪 System Validation Test (Fixed)\n');

const validator = new SimpleEventValidator();

// Valid event (now with required data.timestamp)
const validEvent = {
  eventId: '123e4567-e89b-12d3-a456-426614174000',
  eventType: 'log.message.created',
  version: '1.0.0',
  timestamp: '2024-01-15T10:30:00.000Z',
  correlationId: '123e4567-e89b-12d3-a456-426614174001',
  source: { service: 'test', version: '1.0.0' },
  metadata: { priority: 'normal' },
  data: { 
    level: 'INFO', 
    message: 'test message',
    timestamp: '2024-01-15T10:30:00.000Z'  // ✅ Added required field
  }
};

// Invalid event (missing required fields)
const invalidEvent = {
  eventType: 'invalid'
};

console.log('1️⃣ Testing valid event...');
const result1 = validator.validate(validEvent);
console.log('   Result:', result1.valid ? '✅ PASS' : '❌ FAIL');
if (!result1.valid) {
  console.log('   Errors:', result1.errors.map(e => e.message).join(', '));
}

console.log('\n2️⃣ Testing invalid event...');
const result2 = validator.validate(invalidEvent);
console.log('   Result:', result2.valid ? '❌ FAIL (should reject)' : '✅ PASS (correctly rejected)');

console.log('\n🎯 Overall System Status:');
const systemWorking = result1.valid && !result2.valid;
console.log('   Validation System:', systemWorking ? '✅ WORKING PERFECTLY' : '❌ HAS ISSUES');

// Performance quick test
console.log('\n⚡ Quick Performance Test...');
const start = Date.now();
for(let i = 0; i < 1000; i++) {
  validator.validate(validEvent);
}
const end = Date.now();
const throughput = (1000 / (end - start)) * 1000;
console.log(`   Throughput: ${Math.round(throughput).toLocaleString()}/second`);
console.log('   Performance:', throughput > 10000 ? '✅ EXCELLENT' : '⚠️ NEEDS OPTIMIZATION');

console.log('\n🏆 FINAL STATUS: ALL SYSTEMS', systemWorking ? 'OPERATIONAL ✅' : 'NEED ATTENTION ❌'); 