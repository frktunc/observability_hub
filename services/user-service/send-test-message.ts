import { logger } from './src/bootstrap/logger';

async function sendTestMessage() {
  console.log('Attempting to connect to RabbitMQ and send a test message...');
  try {
    await logger.connect();
    console.log('Logger connected to RabbitMQ.');

    const testMessage = `This is a test message from user-service at ${new Date().toISOString()}`;
    const context = {
      testId: `test-${Date.now()}`,
      source: 'send-test-message.ts',
    };

    console.log(`Sending message: "${testMessage}" with context:`, context);

    const result = await logger.info(testMessage, context);

    if (result.success) {
      console.log('Message published successfully!', { messageId: result.messageId });
    } else {
      console.error('Failed to publish message:', result.error);
    }
  } catch (error) {
    console.error('An error occurred during the test:', error);
  } finally {
    await logger.close();
    console.log('Logger connection closed.');
  }
}

sendTestMessage();
