// Ticket number formatting utility

import type { TicketFormat } from '../types/index.js';

export function formatTicketNumber(
  sequenceNumber: number,
  format: TicketFormat,
  prefix?: string | null,
  digitCount = 3,
): string {
  const padded = String(sequenceNumber).padStart(digitCount, '0');

  switch (format) {
    case 'numeric':
      return padded;
    case 'alphanumeric':
      if (!prefix) throw new Error('Prefix required for alphanumeric format');
      return `${prefix}${padded}`;
    case 'custom':
      if (!prefix) throw new Error('Prefix required for custom format');
      return `${prefix}${padded}`;
    default:
      return padded;
  }
}