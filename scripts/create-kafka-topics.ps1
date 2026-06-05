$topics = @(
  "raw_events",
  "reply_commands",
  "manual_review",
  "send_failed",
  "send_retry",
  "dead_letter"
)

foreach ($topic in $topics) {
  docker exec fb_api_kafka kafka-topics `
    --create `
    --if-not-exists `
    --topic $topic `
    --bootstrap-server kafka:29092 `
    --partitions 3 `
    --replication-factor 1
}

docker exec fb_api_kafka kafka-topics --list --bootstrap-server kafka:29092
