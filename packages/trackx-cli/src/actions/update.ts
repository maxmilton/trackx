import type { GlobalOptions } from '../types';
import { logger } from '../utils';

// TODO: Update installation flow including:
//  - Notice messages for each version
//  - Optional DB backup (may take a long time and disk space!)
//  - Required DB SQL migrations
//    ↳ https://github.com/lukeed/ley

export default function action(opts: GlobalOptions): void {
  if (opts._.length > 0) {
    throw new Error(`Unexpected positional arguments: ${String(opts._)}`);
  }

  logger.error('Automatic updates are not supported yet');
}
