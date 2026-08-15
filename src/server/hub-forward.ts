/**
 * G8 enterprise hub forwarding — bridge local lineage events to hub reporting.
 *
 * Listens for locally published lineage events via the onLineagePublished hook in
 * lineage-store, and forwards them to the hub outbox (hub-client.enqueueHubEvent handles
 * seq assignment / offline queueing / backfill). When the hub is not connected,
 * enqueueHubEvent is a no-op, so standalone behavior is unaffected.
 */
import { onLineagePublished } from './lineage-store'
import { enqueueHubEvent } from './hub-client'

/** Register local lineage → hub forwarding (idempotent; repeated calls register only once) */
let registered = false

export function registerLineageHubForwarder(): void {
  if (registered) return
  registered = true
  onLineagePublished((event) => {
    enqueueHubEvent({
      type: event.type,
      taskId: event.taskId,
      runId: event.runId,
      ownerId: event.ownerId,
      payload: {
        ...(event.payload ?? {}),
        // System fields (for provenance; override same-named business payload fields)
        eventId: event.eventId,
        prevTaskId: event.prevTaskId ?? null,
        dept: event.dept ?? null,
        ts: event.ts,
      },
    })
  })
}
