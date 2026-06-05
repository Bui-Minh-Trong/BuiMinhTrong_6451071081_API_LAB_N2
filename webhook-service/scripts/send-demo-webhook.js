const crypto = require('crypto');

const targetUrl = process.env.WEBHOOK_URL || 'http://localhost:3001/webhook';
const appSecret = process.env.APP_SECRET || process.env.FACEBOOK_APP_SECRET || 'demo_app_secret';
const pageId = process.env.DEMO_PAGE_ID || process.env.PAGE_ID || 'demo_page_001';
const postId = process.env.DEMO_POST_ID || `${pageId}_post_001`;
const commentId = process.env.DEMO_COMMENT_ID || `${postId}_comment_${Date.now()}`;
const senderId = process.env.DEMO_USER_ID || 'demo_user_001';
const message = process.env.DEMO_MESSAGE || 'Shop oi gia bao nhieu?';

const payload = {
  object: 'page',
  entry: [
    {
      id: pageId,
      time: Math.floor(Date.now() / 1000),
      changes: [
        {
          field: 'feed',
          value: {
            item: 'comment',
            verb: 'add',
            post_id: postId,
            comment_id: commentId,
            sender_id: senderId,
            message,
            created_time: Math.floor(Date.now() / 1000)
          }
        }
      ]
    }
  ]
};

async function main() {
  const rawBody = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', appSecret)
    .update(Buffer.from(rawBody))
    .digest('hex');

  console.log('[DEMO WEBHOOK] Sending signed Facebook-like payload...');
  console.log(`[DEMO WEBHOOK] URL: ${targetUrl}`);
  console.log(`[DEMO WEBHOOK] page_id=${pageId}, post_id=${postId}, comment_id=${commentId}`);
  console.log(`[DEMO WEBHOOK] message="${message}"`);

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': `sha256=${signature}`
    },
    body: rawBody
  });

  const responseText = await response.text();
  console.log(`[DEMO WEBHOOK] HTTP ${response.status}`);
  console.log(responseText);

  if (!response.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[DEMO WEBHOOK] Failed:', error.message);
  process.exit(1);
});
