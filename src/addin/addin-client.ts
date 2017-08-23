import { AddinClientArgs } from './addin-client-args';
import { AddinClientCloseModalArgs } from './addin-client-close-modal-args';
import { AddinClientShowModalArgs } from './addin-client-show-modal-args';
import { AddinClientUIReadyArgs } from './addin-client-ui-ready-args';
import { AddinHostMessageEventData } from './addin-host-message-event-data';

const allowedOrigins = [
  /^https\:\/\/[\w\-\.]+\.blackbaud\.com$/,
  /^https\:\/\/[\w\-\.]+\.blackbaud\-dev\.com$/,
  /^http\:\/\/[\w\-\.]+\.blackbaud\-dev\.com$/,
  /^https\:\/\/[\w\-\.]+\.blackbaudhosting\.com$/,
  /^https\:\/\/[\w\-\.]+\.bbcloudservices\.com$/,
  /^https\:\/\/localhost\:[0-9]+$/
];

let lastTokenRequestId = 0;
let lastModalRequestId = 0;

function getQueryVariable(variable: any) {
  let query = window.location.search.substring(1);
  let vars = query.split('&');
  for (let i = 0; i < vars.length; i++) {
    let pair = vars[i].split('=');
    if (decodeURIComponent(pair[0]) === variable) {
      return decodeURIComponent(pair[1]);
    }
  }
  console.log('Query variable %s not found', variable);
}

export class AddinClient {
  private tokenRequests: any[] = [];

  private modalRequests: any[] = [];

  private trustedOrigin: string;

  private windowMessageHandler: (event: MessageEvent) => void;

  private heightChangeIntervalId: any;

  private currentHeight: number;

  constructor(private args: AddinClientArgs) {
    this.windowMessageHandler = (event) => {
      this.handleMessage(event);
    };

    window.addEventListener('message', this.windowMessageHandler);

    this.ready();
  }

  public ready() {
    // No sensitive data should be provided with this message!  This is the initial
    // message posted to the host page to establish whether the host origin is a
    // trusted origin and therefore will post to any host, trusted or untrusted.
    // The host should respond with a host-ready message which will include the origin
    // and will be validated against a whitelist of allowed origins so that subsequent
    // messages can be posted only to that trusted origin.
    this.postMessage({
      messageType: 'ready'
    }, '*');
  }

  public destroy() {
    window.removeEventListener('message', this.windowMessageHandler);

    if (this.heightChangeIntervalId) {
      clearInterval(this.heightChangeIntervalId);
    }
  }

  public navigate(url: string) {
    this.postMessage({
      messageType: 'navigate',
      message: {
        url: url
      }
    });
  }

  public getToken(disableRedirect?: boolean) {
    return new Promise<string>((resolve, reject) => {
      const tokenRequestId = ++lastTokenRequestId;

      this.tokenRequests[tokenRequestId] = {
        reject,
        resolve
      };

      this.postMessage({
        messageType: 'get-token',
        message: {
          disableRedirect,
          tokenRequestId: tokenRequestId
        }
      });
    });
  }

  public UIReady(args: AddinClientUIReadyArgs) {
    this.postMessage({
      messageType: 'ui-ready',
      message: args
    });
  }

  public showModal(args: AddinClientShowModalArgs) {
    return new Promise<string>((resolve, reject) => {
      const modalRequestId = ++lastModalRequestId;

      this.modalRequests[modalRequestId] = {
        reject,
        resolve
      };

      this.postMessage({
        messageType: 'show-modal',
        message: {
          args: args,
          modalRequestId: modalRequestId
        }
      });
    });
  }

  public closeModal(args: AddinClientCloseModalArgs) {
    this.postMessage({
      messageType: 'close-modal',
      message: args
    });
  }

  private handleCloseModalMessage(message: any) {
    const modalRequests = this.modalRequests;
    const modalRequestId = message.modalRequestId;
    const modalRequest = modalRequests[modalRequestId];

    modalRequest.resolve(message.context);

    modalRequests[modalRequestId] = undefined;
  }

  private handleTokenMessage(data: AddinHostMessageEventData) {
    const tokenRequests = this.tokenRequests;
    const tokenRequestId = data.message.tokenRequestId;
    const tokenRequest = tokenRequests[tokenRequestId];

    /* tslint:disable-next-line switch-default */
    switch (data.messageType) {
      case 'token':
        const token = data.message.token;
        tokenRequest.resolve(token);
        break;
      case 'token-fail':
        tokenRequest.reject(data.message.reason);
        break;
    }

    tokenRequests[tokenRequestId] = undefined;
  }

  private handleMessage(event: MessageEvent) {
    const data = event.data as AddinHostMessageEventData;

    if (data && data.source === 'bb-addin-host') {
      if (data.messageType === 'host-ready') {
        // The 'host-ready' message is the only message that's not validated against
        // the host origin since that is what's being established in the message.
        // This MUST be the first message posted by the host page or all further
        // communications with the host page will be blocked.
        this.setKnownAllowedHostOrigin(event.origin);

        this.heightChangeIntervalId = setInterval(() => {
          const currentHeight = document.body.offsetHeight;

          if (currentHeight !== this.currentHeight) {
            this.currentHeight = currentHeight;

            this.postMessage({
              messageType: 'height-change',
              message: {
                height: currentHeight + 'px'
              }
            });
          }
        }, 1000);

        this.args.callbacks.ready({
          envId: data.message.envId,
          context: data.message.context
        });
      } else if (this.isFromValidOrigin(event)) {
        /* tslint:disable-next-line switch-default */
        switch (data.messageType) {
          case 'token':
          case 'token-fail':
            this.handleTokenMessage(data);
            break;
          case 'close-modal':
            this.handleCloseModalMessage(data.message);
            break;
          case 'button-click':
            this.args.callbacks.buttonClick();
            break;
        }
      } else {
        this.warnInvalidOrigin();
      }
    }
  }

  private setKnownAllowedHostOrigin(hostOrigin: string) {
    for (const allowedOrigin of allowedOrigins) {
      if (allowedOrigin.test(hostOrigin)) {
        this.trustedOrigin = hostOrigin;
        return;
      }
    }
  }

  private postMessage(message: any, trustedOrigin?: string) {
    message.source = 'bb-addin-client';
    message.addinId = getQueryVariable('addinId');

    trustedOrigin = trustedOrigin || this.trustedOrigin;

    if (trustedOrigin) {
      window.parent.postMessage(message, trustedOrigin);
    } else {
      this.warnInvalidOrigin();
    }
  }

  private isFromValidOrigin(event: MessageEvent): boolean {
    return event.origin === this.trustedOrigin;
  }

  private warnInvalidOrigin() {
    console.warn(
      'The origin is not trusted because the host-ready message has not been ' +
      'sent or because the host origin is not a whitelisted origin.'
    );
  }
}
