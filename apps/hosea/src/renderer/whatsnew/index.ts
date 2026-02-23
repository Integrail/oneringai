import v020 from './0.2.0.md?raw';
import v018 from './0.1.8.md?raw';
import v016 from './0.1.6.md?raw';

export interface WhatsNewEntry {
  version: string;
  content: string;
}

/** Ordered newest-first */
export const whatsNewEntries: WhatsNewEntry[] = [
  { version: '0.2.0', content: v020 },
  { version: '0.1.8', content: v018 },
  { version: '0.1.6', content: v016 },
];
