console.log('--- 1. Testing Exponential Backoff Calculation ---');
const calculateDelay = (retryCount) => 1000 * Math.pow(2, retryCount);

console.log('Retry Count 0 (1st retry):', calculateDelay(0), 'ms (Expected: 1000ms)');
console.log('Retry Count 1 (2nd retry):', calculateDelay(1), 'ms (Expected: 2000ms)');
console.log('Retry Count 2 (3rd retry):', calculateDelay(2), 'ms (Expected: 4000ms)');
console.log('Retry Count 3 (4th retry):', calculateDelay(3), 'ms (Expected: 8000ms)');


console.log('\n--- 2. Testing Dead Letter Queue Payload Conversion ---');
const mockSendFailedMsg = {
  schema_version: 1,
  command_id: 'cmd-uuid-123',
  event_id: 'evt-uuid-456',
  retry_count: 3,
  last_error: 'Graph API Token Expired',
  payload: {
    action: 'reply',
    target: {
      page_id: 'page-111',
      comment_id: 'comment-222'
    },
    reply_text: 'Xin chào!'
  }
};

const makeDeadLetter = (message) => {
  const deadLetterEvent = {
    ...message,
    failed_at: new Date().toISOString(),
    final_error: message.last_error || 'Execution threshold exceeded',
    original_topic: 'send_failed'
  };
  delete deadLetterEvent.last_error;
  return deadLetterEvent;
};

const dlqPayload = makeDeadLetter(mockSendFailedMsg);
console.log('Original Message (last_error exists):', mockSendFailedMsg.last_error !== undefined);
console.log('DLQ Message (last_error exists):', dlqPayload.last_error !== undefined);
console.log('DLQ Message (final_error exists):', dlqPayload.final_error);
console.log('DLQ Message (failed_at exists):', dlqPayload.failed_at);
console.log('DLQ Message (original_topic exists):', dlqPayload.original_topic);
console.log('DLQ Full Payload:', JSON.stringify(dlqPayload, null, 2));
