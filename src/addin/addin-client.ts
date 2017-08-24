import { AddinClientArgs } from './client-interfaces/addin-client-args';
import { AddinClientCloseModalArgs } from './client-interfaces/addin-client-close-modal-args';
import { AddinClientNavigateArgs } from './client-interfaces/addin-client-navigate-args';
import { AddinClientReadyArgs } from './client-interfaces/addin-client-ready-args';
import { AddinClientShowModalArgs } from './client-interfaces/addin-client-show-modal-args';
import { AddinClientShowModalResult } from './client-interfaces/addin-client-show-modal-result';
import { AddinHostMessage } from './host-interfaces/addin-host-message';
import { AddinHostMessageEventData } from './host-interfaces/addin-host-message-event-data';

/**
 * Collection of regexs for our whitelist of host origins.
 */
const allowedOrigins = [
  /^https\:\/\/[\w\-\.]+\.blackbaud\.com$/,
  /^https\:\/\/[\w\-\.]+\.blackbaud\-dev\.com$/,
  /^http\:\/\/[\w\-\.]+\.blackbaud\-dev\.com$/,
  /^https\:\/\/[\w\-\.]+\.blackbaudhosting\.com$/,
  /^https\:\/\/[\w\-\.]+\.bbcloudservices\.com$/,
  /^https\:\/\/localhost\:[0-9]+$/
];

/**
 * Counter to provide unique ids for each auth token request.
 */
let lastAuthTokenRequestId = 0;

/**
 * Counter to provide unique ids for each modal request.
 */
let lastModalRequestId = 0;

/**
 * Reads a query string value from the current window location.
 * @param variable  Name of the query string parameter to ready.
 * @returns         The value of the query string parameter.
 */
function getQueryVariable(variable: any) {
  const query = window.location.search.substring(1);
  const vars = query.split('&');
  for (const v of vars) {
    const pair = v.split('=');
    if (decodeURIComponent(pair[0]) === variable) {
      return decodeURIComponent(pair[1]);
    }
  }
  console.log('Query variable %s not found', variable);
}

/**
 * Client for interacting with the parent page hosting the add-in.
 */
export class AddinClient {

  /**
   * Tracks pending request to reeceive an auth-token from the host.
   */
  private authTokenRequests: any[] = [];

  /**
   * Tracks modal add-ins that have been launched from this add-in.
   */
  private modalRequests: any[] = [];

  /**
   * The origin of the host page.
   */
  private trustedOrigin: string;

  /**
   * A message handler listening to post-message events from the host page.
   */
  private windowMessageHandler: (event: MessageEvent) => void;

  /**
   * setInterval id for tracking height changes of the iframe.
   */
  private heightChangeIntervalId: any;

  constructor(private args: AddinClientArgs) {
    this.windowMessageHandler = (event) => {
      this.handleMessage(event);
    };

    // Listen to messages from the host page.
    window.addEventListener('message', this.windowMessageHandler);

    // Inform the host page that the add-in is loaded and listening for messages.
    this.raiseAddinReadyMessage();
  }

  /**
   * Cleans up the AddinClient, releasing all resources.
   */
  public destroy() {
    window.removeEventListener('message', this.windowMessageHandler);

    if (this.heightChangeIntervalId) {
      clearInterval(this.heightChangeIntervalId);
    }
  }

  /**
   * Requests the host page to navigate.
   * @param args Arguments describing the navigation request.
   */
  public navigate(args: AddinClientNavigateArgs) {
    this.postMessageToHostPage({
      message: {
        url: args.url
      },
      messageType: 'navigate'
    });
  }

  /**
   * Requests an authentication token for the current user.
   * @returns {Promise<any>} Returns a promise which will resolve with the token value.
   */
  public getAuthToken(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const authTokenRequestId = ++lastAuthTokenRequestId;

      this.authTokenRequests[authTokenRequestId] = {
        reject,
        resolve
      };

      this.postMessageToHostPage({
        message: {
          authTokenRequestId
        },
        messageType: 'get-auth-token'
      });
    });
  }

  /**
   * Informs the add-in client that the add-in is initialized and ready to be shown.
   * @param args Arguments describing how the add-in should render.
   */
  public ready(args: AddinClientReadyArgs) {
    this.postMessageToHostPage({
      message: args,
      messageType: 'addin-ready'
    });
  }

  /**
   * Requests the host page to launch a modal add-in.
   * @param args Arguments for launcing the modal.
   * @returns {Promise<any>} Returns a promise that will be resolved when the modal add-in is closed.
   * Promise will resolve with context data passed by from the modal add-in's closeModal call.
   */
  public showModal(args: AddinClientShowModalArgs): AddinClientShowModalResult {
    return {
      modalClosed: new Promise<any>((resolve, reject) => {
        const modalRequestId = ++lastModalRequestId;

        this.modalRequests[modalRequestId] = {
          reject,
          resolve
        };

        this.postMessageToHostPage({
          message: {
            args,
            modalRequestId
          },
          messageType: 'show-modal'
        });
      })
    };
  }

  /**
   * Informs the host to close this modal add-in.
   * Should only be used from within the modal add-in and not the parent add-in.
   * @param args Arguments to provide a context object back to the parent add-in.
   */
  public closeModal(args: AddinClientCloseModalArgs) {
    this.postMessageToHostPage({
      message: args,
      messageType: 'close-modal'
    });
  }

  /**
   * Post a message to the host page informing it that the add-in is
   * now started and listening for messages from the host.
   */
  private raiseAddinReadyMessage() {
    // No sensitive data should be provided with this message!  This is the initial
    // message posted to the host page to establish whether the host origin is a
    // trusted origin and therefore will post to any host, trusted or untrusted.
    // The host should respond with a host-ready message which will include the origin
    // and will be validated against a whitelist of allowed origins so that subsequent
    // messages can be posted only to that trusted origin.
    this.postMessageToHostPage({
      messageType: 'ready'
    }, '*');
  }

  /**
   * Handles the close-modal message from the host.
   * This is emitted to add-ins which have previously launched a modal, which is now
   * closing.
   * @param message The message data, which includes a context object from the closing modal, which should be passed
   * to the calling modal in the showModal promise.
   */
  private handleCloseModalMessage(message: AddinHostMessage) {
    const modalRequests = this.modalRequests;
    const modalRequestId = message.modalRequestId;
    const modalRequest = modalRequests[modalRequestId];

    modalRequest.resolve(message.context);

    modalRequests[modalRequestId] = undefined;
  }

  /**
   * Handles host message responses to a get-auth-token request.
   * @param data The message.
   */
  private handleAuthTokenMessage(data: AddinHostMessageEventData) {
    const authTokenRequests = this.authTokenRequests;
    const authTokenRequestId = data.message.authTokenRequestId;
    const authTokenRequest = authTokenRequests[authTokenRequestId];

    /* tslint:disable-next-line switch-default */
    switch (data.messageType) {
      case 'auth-token':
        const authToken = data.message.authToken;
        authTokenRequest.resolve(authToken);
        break;
      case 'auth-token-fail':
        authTokenRequest.reject(data.message.reason);
        break;
    }

    authTokenRequests[authTokenRequestId] = undefined;
  }

  /**
   * Handles message events received from the add-in host page.
   * @param event The event posted from the host.
   */
  private handleMessage(event: MessageEvent) {
    const data = event.data as AddinHostMessageEventData;

    if (data && data.source === 'bb-addin-host') {
      if (data.messageType === 'host-ready') {
        // The 'host-ready' message is the only message that's not validated against
        // the host origin since that is what's being established in the message.
        // This MUST be the first message posted by the host page or all further
        // communications with the host page will be blocked.
        this.setKnownAllowedHostOrigin(event.origin);

        this.trackHeightChangesOfAddinContent();

        // Pass key data to the add-in for it to initiailze.
        this.args.callbacks.init({
          context: data.message.context,
          envId: data.message.envId
        });

      } else if (this.isFromValidOrigin(event)) {
        /* tslint:disable-next-line switch-default */
        switch (data.messageType) {
          case 'auth-token':
          case 'auth-token-fail':
            this.handleAuthTokenMessage(data);
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

  /**
   * Validates and registers a value as the origin of the parent page hosting the add-in.
   * If the provided origin matches against our trusted whitelist, then it will be saved.
   * Post messages will implicitly go to this origin and received messages will be filtered
   * to just messages from this origin.
   * @param hostOrigin
   */
  private setKnownAllowedHostOrigin(hostOrigin: string) {
    for (const allowedOrigin of allowedOrigins) {
      if (allowedOrigin.test(hostOrigin)) {
        this.trustedOrigin = hostOrigin;
        return;
      }
    }
  }

  /**
   * Starts a timeout interval to watch for height changes
   * of the iframe content.
   */
  private trackHeightChangesOfAddinContent() {
    let currentHeight: number;

    this.heightChangeIntervalId = setInterval(() => {
      const newHeight = document.body.offsetHeight;

      if (newHeight !== currentHeight) {
        currentHeight = newHeight;

        this.postMessageToHostPage({
          message: {
            height: newHeight + 'px'
          },
          messageType: 'height-change'
        });
      }
    }, 1000);
  }

  /**
   * Posts a message to the parent window.
   * @param message The message content to post.
   * @param targetOrigin Optional. If provided, then the message will be posted to this origin.
   *                     If not, then it will post to the pre-determined host page origin.
   */
  private postMessageToHostPage(message: any, targetOrigin?: string) {
    message.source = 'bb-addin-client';
    message.addinId = getQueryVariable('addinId');

    targetOrigin = targetOrigin || this.trustedOrigin;

    if (targetOrigin) {
      window.parent.postMessage(message, targetOrigin);
    } else {
      this.warnInvalidOrigin();
    }
  }

  /**
   * Checks whether a MessageEvent is from the execetd host origin.
   * @param event
   */
  private isFromValidOrigin(event: MessageEvent): boolean {
    return event.origin === this.trustedOrigin;
  }

  /**
   * Log that a message was received with an invalid origin.
   */
  private warnInvalidOrigin() {
    console.warn(
      'The origin is not trusted because the host-ready message has not been ' +
      'sent or because the host origin is not a whitelisted origin.'
    );
  }
}
