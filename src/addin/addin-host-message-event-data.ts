import { AddinHostMessage } from './addin-host-message';

export interface AddinHostMessageEventData {
  messageType: string;

  source: string;

  message: AddinHostMessage
}
