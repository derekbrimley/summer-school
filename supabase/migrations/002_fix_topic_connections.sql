-- Add unique constraint to prevent duplicate connections
create unique index uq_topic_connections_from_to
  on topic_connections (from_topic, to_topic);
