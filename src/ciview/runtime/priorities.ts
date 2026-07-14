/** Higher number runs first in p-queue. */
export const PRIORITY = {
  user: 20,
  poll: 10,
  idle: 5,
} as const;

export type PriorityBand = keyof typeof PRIORITY;
