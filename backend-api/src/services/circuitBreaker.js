require('dotenv').config();

const THRESHOLD = parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 5;
const TIMEOUT = parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT) || 30000;

let state = 'CLOSED'; // State: CLOSED | OPEN | HALF_OPEN
let failureCount = 0;
let nextAttemptTime = 0;

class CircuitBreakerOpenError extends Error {
  constructor(retryAfterMs) {
    const remainingSeconds = Math.ceil(retryAfterMs / 1000);
    super(`Facebook API Circuit Breaker is OPEN. Request blocked. Retrying in ${remainingSeconds}s.`);
    this.name = 'CircuitBreakerOpenError';
    this.code = 'CIRCUIT_BREAKER_OPEN';
    this.retryable = true;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Transitions Circuit Breaker state
 * @param {string} newState - The target state
 */
function changeState(newState) {
  console.log(`[CIRCUIT BREAKER] [FACEBOOK API] State transition: ${state} ---> ${newState}`);
  state = newState;
  if (newState === 'CLOSED') {
    failureCount = 0;
  }
}

/**
 * Wraps function call with circuit breaker pattern
 * @param {Function} fn - The async function to execute
 * @returns {Promise<any>}
 */
async function execute(fn) {
  const now = Date.now();

  if (state === 'OPEN') {
    if (now >= nextAttemptTime) {
      changeState('HALF_OPEN');
    } else {
      throw new CircuitBreakerOpenError(nextAttemptTime - now);
    }
  }

  try {
    const result = await fn();

    // If successful under HALF_OPEN, close the circuit
    if (state === 'HALF_OPEN') {
      changeState('CLOSED');
    } else if (state === 'CLOSED') {
      failureCount = 0; // Reset failures on successful call
    }

    return result;
  } catch (error) {
    if (error.retryable === false) {
      console.warn(`[CIRCUIT BREAKER] [FACEBOOK API] Non-retryable error ignored by breaker. Error: ${error.message}`);
      throw error;
    }

    if (state === 'CLOSED') {
      failureCount++;
      console.warn(`[CIRCUIT BREAKER] [FACEBOOK API] Failure recorded. Count: ${failureCount}/${THRESHOLD}. Error: ${error.message}`);
      if (failureCount >= THRESHOLD) {
        nextAttemptTime = Date.now() + TIMEOUT;
        changeState('OPEN');
      }
    } else if (state === 'HALF_OPEN') {
      console.warn(`[CIRCUIT BREAKER] [FACEBOOK API] Failure recorded during HALF_OPEN. Re-opening circuit.`);
      nextAttemptTime = Date.now() + TIMEOUT;
      changeState('OPEN');
    }

    throw error;
  }
}

module.exports = {
  execute,
  getState: () => state,
  CircuitBreakerOpenError
};
