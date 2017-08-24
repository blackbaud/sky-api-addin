import { AddinClient } from './addin-client';
import { AddinClientArgs } from './client-interfaces/addin-client-args';
import { AddinClientCloseModalArgs } from './client-interfaces/addin-client-close-modal-args';
import { AddinClientInitArgs } from './client-interfaces/addin-client-init-args';
import { AddinClientNavigateArgs } from './client-interfaces/addin-client-navigate-args';
import { AddinClientReadyArgs } from './client-interfaces/addin-client-ready-args';
import { AddinClientShowModalArgs } from './client-interfaces/addin-client-show-modal-args';
import { AddinClientShowModalResult } from './client-interfaces/addin-client-show-modal-result';
import { AddinHostMessage } from './host-interfaces/addin-host-message';
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

        spyOn(window.parent, 'postMessage').and.callFake((message, targetOrigin) => {
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
        const readyArgs: AddinClientReadyArgs = {};
        let postedMessage: any;
        let postedOrigin: string;

        const client = new AddinClient({
          callbacks: {
            init: () => { return; }
          }
        });

        initializeHost();

        spyOn(window.parent, 'postMessage').and.callFake((message, targetOrigin) => {
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

});
