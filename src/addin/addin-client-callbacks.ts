import { AddinClientReadyArgs } from './addin-client-ready-args';

export interface AddinClientCallbacks {

  ready: (args: AddinClientReadyArgs) => void;

  buttonClick?: () => void;

}
