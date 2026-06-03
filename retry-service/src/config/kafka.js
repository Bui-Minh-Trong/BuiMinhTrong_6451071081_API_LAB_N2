const { Kafka } = require('kafkajs');
require('dotenv').config();

const broker = process.env.KAFKA_BROKER || 'localhost:9092';

const kafka = new Kafka({
  clientId: 'retry-service',
  brokers: [broker]
});

module.exports = kafka;
