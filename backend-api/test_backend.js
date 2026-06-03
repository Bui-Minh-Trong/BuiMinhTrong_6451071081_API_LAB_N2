const jwt = require('jsonwebtoken');
const circuitBreaker = require('./src/services/circuitBreaker');

console.log('--- 1. Testing JWT Token Signing and Verification ---');
const secret = 'test_secret';
const payload = { username: 'admin', role: 'admin' };
const token = jwt.sign(payload, secret, { expiresIn: '1h' });
console.log('Signed JWT:', token);

try {
  const decoded = jwt.verify(token, secret);
  console.log('Decoded claims:', decoded);
  console.log('Token validation: SUCCESS');
} catch (e) {
  console.error('Token validation: FAILED', e.message);
}

try {
  jwt.verify(token, 'wrong_secret');
  console.log('Token with wrong secret: PASSED (Unexpected!)');
} catch (e) {
  console.log('Token validation with wrong secret: REJECTED (Expected: ' + e.message + ')');
}


console.log('\n--- 2. Testing Facebook API Circuit Breaker ---');
console.log('Initial CB State:', circuitBreaker.getState());

const failingApiCall = async () => {
  throw new Error('Graph API rate limit exceeded');
};

const runCB = async () => {
  for (let i = 0; i < 6; i++) {
    try {
      await circuitBreaker.execute(failingApiCall);
    } catch (err) {
      console.log(`Execution ${i + 1} failed: ${err.message}`);
    }
  }
  console.log('State after failure threshold reached:', circuitBreaker.getState());
};

runCB();
