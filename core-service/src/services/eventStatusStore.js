const events = new Map();

function upsertEvent(eventId, patch) {
  if (!eventId) return null;

  const current = events.get(eventId) || {
    event_id: eventId,
    status: 'received',
    history: [],
    created_at: new Date().toISOString()
  };

  const status = patch.status || current.status;
  const updated = {
    ...current,
    ...patch,
    event_id: eventId,
    status,
    updated_at: new Date().toISOString(),
    history: [
      ...current.history,
      {
        status,
        at: new Date().toISOString(),
        note: patch.note || null
      }
    ].slice(-20)
  };

  events.set(eventId, updated);
  return updated;
}

function getEvent(eventId) {
  return events.get(eventId) || null;
}

function hasCompletedEvent(eventId) {
  const event = events.get(eventId);
  return Boolean(event && ['processed', 'ignored'].includes(event.status));
}

function listEvents() {
  return Array.from(events.values())
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
}

module.exports = {
  upsertEvent,
  getEvent,
  hasCompletedEvent,
  listEvents
};
