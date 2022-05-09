import type * as mri from 'mri';

// XXX: mri is the underlying CLI parser used by sade
export interface GlobalOptions extends mri.Argv {
  /** File path to TrackX API config. */
  config: string;
}
