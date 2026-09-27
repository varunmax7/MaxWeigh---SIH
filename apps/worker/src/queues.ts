/**
 * Queue names consumed by the worker (implementation.md §3.3).
 *
 * The web app enqueues by these names; each gains a handler in the phase that
 * introduces the feature — reports in P8, thumbnails in P6, analytics in P9.
 */
export const QUEUES = {
  reportRender: 'report.render',
  reportSign: 'report.sign',
  docxBuild: 'docx.build',
  thumbMake: 'thumb.make',
  analyticsRefresh: 'analytics.refresh',
  notifyEmail: 'notify.email',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** Every queue the worker is responsible for draining. */
export const ALL_QUEUES: readonly QueueName[] = Object.values(QUEUES);
