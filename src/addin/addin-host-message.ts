export interface AddinHostMessage {
  tokenRequestId?: number;

  token?: string;

  reason?: string;

  envId?: string;

  context?: any;
}
