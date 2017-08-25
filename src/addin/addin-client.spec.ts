import { AddinClient } from './addin-client';
// import { AddinClientArgs } from './client-interfaces/addin-client-args';
import { AddinClientCloseModalArgs } from './client-interfaces/addin-client-close-modal-args';
import { AddinClientInitArgs } from './client-interfaces/addin-client-init-args';
import { AddinClientNavigateArgs } from './client-interfaces/addin-client-navigate-args';
import { AddinClientReadyArgs } from './client-interfaces/addin-client-ready-args';
// import { AddinClientShowModalArgs } from './client-interfaces/addin-client-show-modal-args';
// import { AddinClientShowModalResult } from './client-interfaces/addin-client-show-modal-result';
// import { AddinHostMessage } from './host-interfaces/addin-host-message';
import { AddinHostMessageEventData } from './host-interfaces/addin-host-message-event-data';

const TEST_HOST_ORIGIN = 'https://host.nxt.blackbaud.com';

function postMessageFromHost(msg: AddinHostMessageEventData, origin?: string) {
  if (!origin) { origin = TEST_HOST_ORIGIN; }

  window.dispatchEvent(new MessageEvent('message', {
    data: msg,
    origin
  }));
}

function initializeHost() {
  const msg: AddinHostMessageEventData = {
    message: {
      context: 'my_context',
      envId: 'my_envid'
    },
    messageType: 'host-ready',
    source: 'bb-addin-host'
  };

  postMessageFromHost(msg);
}

describe('AddinClient ', () => {

  // Set the addinId query string.
  (AddinClient as any).getQueryString = () => {
    return '?test=value&addinId=test_id&test2=value2';
  };

  describe('constructor', () => {

    it('should raise "ready" message to "*" on constructor including the addinId from the query string.', () => {

      let post: any;

      window.parent.postMessage = (message, targetOrigin) => {
        post = {
          message,
          targetOrigin
        };
      };

      const client = new AddinClient({
        callbacks: {
          init: () => { return; }
        }
      });
      client.destroy();

      expect(post.message.messageType).toBe('ready');
      expect(post.message.source).toBe('bb-addin-client');
      expect(post.message.addinId).toBe('test_id');
      expect(post.targetOrigin).toBe('*');

    });

  });

  describe('handleMessage', () => {

    describe('host-ready', () => {

      it('should not call the "init" callback event if the source is not "bb-addin-host".',
        () => {
          let initCalled = false;
          const client = new AddinClient({
            callbacks: {
              init: () => { initCalled = true; }
            }
          });

          const msg: AddinHostMessageEventData = {
            message: {},
            messageType: 'host-ready',
            source: 'not-bb-addin-host'
          };

          postMessageFromHost(msg);

          client.destroy();

          expect(initCalled).toBe(false);
        });

      it('should call the "init" callback if source is "bb-addin-host" and pass through context and event id.',
        () => {
          let initArgs: any;

          const client = new AddinClient({
            callbacks: {
              init: (args: AddinClientInitArgs) => {
                initArgs = args;
              }
            }
          });

          const msg: AddinHostMessageEventData = {
            message: {
              context: 'my_context',
              envId: 'my_envid'
            },
            messageType: 'host-ready',
            source: 'bb-addin-host'
          };

          postMessageFromHost(msg);

          client.destroy();

          expect(initArgs.context).toBe('my_context');
          expect(initArgs.envId).toBe('my_envid');
        });

    });

    describe('button-click', () => {

      it('should call the "buttonClick" callback.',
        () => {
          let buttonClickCalled = false;

          const client = new AddinClient({
            callbacks: {
              buttonClick: () => { buttonClickCalled = true; },
              init: () => { return; }
            }
          });

          initializeHost();

          const msg: AddinHostMessageEventData = {
            message: {},
            messageType: 'button-click',
            source: 'bb-addin-host'
          };

          postMessageFromHost(msg);
          client.destroy();

          expect(buttonClickCalled).toBe(true);
        });

    });

    describe('auth-token', () => {

      it('should pass result back through promise from getAuthToken.',
        () => {
          let tokenReceived: string = null;

          const client = new AddinClient({
            callbacks: {
              init: () => { return; }
            }
          });

          initializeHost();

          client.getAuthToken().then((token: string) => {
            tokenReceived = token;
          });

          const msg: AddinHostMessageEventData = {
            message: {
              authToken: 'the auth token',
              authTokenRequestId: 1 // One because this is the first request for this client.
            },
            messageType: 'auth-token',
            source: 'bb-addin-host'
          };

          postMessageFromHost(msg);
          client.destroy();

          // Delay the vaildation until after the post message is done.
          setTimeout(() => {
            expect(tokenReceived).toBe('the auth token');
          }, 1);

        });

    });

    describe('auth-token-fail', () => {

      it('should reject the promise from getAuthToken and return the reason.',
        () => {
          let reasonReceived: string = null;

          const client = new AddinClient({
            callbacks: {
              init: () => { return; }
            }
          });

          initializeHost();

          client.getAuthToken().catch((reason: string) => {
            reasonReceived = reason;
          });

          const msg: AddinHostMessageEventData = {
            message: {
              authTokenRequestId: 1, // One because this is the first request for this client.
              reason: 'the reason'
            },
            messageType: 'auth-token-fail',
            source: 'bb-addin-host'
          };

          postMessageFromHost(msg);
          client.destroy();

          // Delay the vaildation until after the post message is done.
          setTimeout(() => {
            expect(reasonReceived).toBe('the reason');
          }, 1);

        });

    });

  });

  describe('init ready callback', () => {

    it('should raise "addin-ready" event.',
      () => {
        const readyArgs: AddinClientReadyArgs = {};
        let postedMessage: any;
        let postedOrigin: string;

        const client = new AddinClient({
          callbacks: {
            init: (args: AddinClientInitArgs) => {
              args.ready(readyArgs);
            }
          }
        });

        const msg: AddinHostMessageEventData = {
          message: {},
          messageType: 'host-ready',
          source: 'bb-addin-host'
        };

        spyOn(window.parent, 'postMessage').and.callFake((message: any, targetOrigin: string) => {
          postedMessage = message;
          postedOrigin = targetOrigin;
        });

        postMessageFromHost(msg);

        client.destroy();

        expect(postedMessage.message).toBe(readyArgs);
        expect(postedMessage.messageType).toBe('addin-ready');
        expect(postedOrigin).toBe(TEST_HOST_ORIGIN);
      });

  });

  describe('closeModal', () => {

    it('should raise "close-modal" event.',
      () => {
        let postedMessage: any;
        let postedOrigin: string;

        const client = new AddinClient({
          callbacks: {
            init: () => { return; }
          }
        });

        initializeHost();

        spyOn(window.parent, 'postMessage').and.callFake((message: any, targetOrigin: string) => {
          postedMessage = message;
          postedOrigin = targetOrigin;
        });

        const args: AddinClientCloseModalArgs = {};

        client.closeModal(args);

        client.destroy();

        expect(postedMessage.message).toBe(args);
        expect(postedMessage.messageType).toBe('close-modal');
        expect(postedOrigin).toBe(TEST_HOST_ORIGIN);
      });

  });

  describe('getAuthToken', () => {

    it('should raise "get-auth-token" event with increasing request id.',
      () => {
        let postedMessage: any;
        let postedOrigin: string;

        const client = new AddinClient({
          callbacks: {
            init: () => { return; }
          }
        });

        initializeHost();

        spyOn(window.parent, 'postMessage').and.callFake((message: any, targetOrigin: string) => {
          postedMessage = message;
          postedOrigin = targetOrigin;
        });

        client.getAuthToken();

        expect(postedMessage.message.authTokenRequestId).toBe(1);
        expect(postedMessage.messageType).toBe('get-auth-token');
        expect(postedOrigin).toBe(TEST_HOST_ORIGIN);

        client.getAuthToken();

        // A second call should increment the request id
        expect(postedMessage.message.authTokenRequestId).toBe(2);
        expect(postedMessage.messageType).toBe('get-auth-token');
        expect(postedOrigin).toBe(TEST_HOST_ORIGIN);

        client.destroy();
      });

  });

  describe('navigate', () => {

    it('should raise "navigate" event with proper url.',
      () => {
        let postedMessage: any;
        let postedOrigin: string;

        const client = new AddinClient({
          callbacks: {
            init: () => { return; }
          }
        });

        initializeHost();

        spyOn(window.parent, 'postMessage').and.callFake((message: any, targetOrigin: string) => {
          postedMessage = message;
          postedOrigin = targetOrigin;
        });

        const args: AddinClientNavigateArgs = {
          url: 'https://renxt.blackbaud.com?test=1'
        };

        client.navigate(args);

        client.destroy();

        expect(postedMessage.message.url).toBe(args.url);
        expect(postedMessage.messageType).toBe('navigate');
        expect(postedOrigin).toBe(TEST_HOST_ORIGIN);
      });

  });

});
