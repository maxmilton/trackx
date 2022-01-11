import type * as mri from 'mri';

export interface GlobalOptions extends mri.Argv {
  /** File path to TrackX API config. */
  config: string;
}
