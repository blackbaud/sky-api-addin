# sky-api-addin
[![npm](https://img.shields.io/npm/v/@blackbaud/sky-api-addin.svg)](https://www.npmjs.com/package/@blackbaud/sky-api-addin)
[![status](https://travis-ci.org/blackbaud/sky-api-addin.svg?branch=master)](https://travis-ci.org/blackbaud/sky-api-addin)

The SKY API add-in library facilitates creating custom add-ins to extend UI experiences within Blackbaud applications. There are various flavors of extension points, but the general pattern is the same. The add-in is registered by providing the URL that will be loaded in an iframe within the application.

This library must be used in your add-in for it to render in the Blackbaud application. The AddinClient class will integrate with the host page, passing data and commands between the host and the addin.

## Installation

- Ensure that you have Node v6+ and NPM v3+. To verify this, run `node -v` and `npm -v` at the command line.
- Install the library as a dependency of your project by running `npm install @blackbaud/sky-api-addin --save` in your project's folder.

## Usage

### Prerequisites

This library makes extensive use of [ES6-style Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise), so in order to support browsers that do not yet have native support for Promises (such as Internet Explorer 11) you will need to include a Promise polyfill such as [`es6-promise`](https://github.com/stefanpenner/es6-promise) and use the [auto-polyfill feature](https://github.com/stefanpenner/es6-promise#auto-polyfill) of the library so that `Promise` is added to the global environment.  This will need to be loaded on your page before the add-in library.

### ES6/TypeScript

#### Initializing the Add-in
All add-ins must use this library in order to show in the host application. You will need to construct the `AddinClient` and register for any callbacks from the host page that you wish to handle.  You *must* register for `init`, which will pass key context information to your add-in.

Your `init` function will be called with an arguments object that contains:

 - `envId` - The environment id for the host page
 - `context` - Additional context of the host page, which will vary for different extension points.
 - `ready` - A callback to inform the add-in client that the add-in is initialized and ready to be shown.

Using the information provided in the `init` arguments, the add-in should determine if and how it should be rendered.  Then it should call the `ready` callback, informing the host page.

```js
var client = new AddinClient({
  callbacks: {
    init: (args) => {
      args.ready({ showUI: true, title: 'My Custom Tile Title' });
    }
  }
});
```

#### Tile and Tab Add-ins
For tile or tab add-ins, the URL for the add-in will be rendered in a visible iframe on the page, where you can render any custom content.  The iframe will initially be hidden until an initialize protocol is completed between the host and the add-in.

The host page will handle rendering the tile or tab component around the add-in iframe.  When calling the `ready` callback, the `title` field will indicate the title for the tile or tab component.  Initially, the entire tile/tab will be hidden, and will show on the page if `showUI` is set to `true` in the callback.  You can set it to `false` to indicate that the tile/tab should not be shown, based on the user's privileges or context of the current record, etc.

Tile and tab add-ins will automatically track the height of the add-in's content and resize its container accordingly.

#### Button Add-ins
For button add-ins, the add-in iframe will always be hidden.  The `init` protocol is still used, where `showUI` indicates whether the button should show or not on the page.  The `title` field will specify the label for the button.

When doing a button add-in, an additional callback for `buttonClick` should be configured.  This will be invoked whenever the user clicks the button for the add-in to take action.

```js
var client = new AddinClient({
  callbacks: {
    init: (args) => {
      args.ready({ showUI: true, title: 'My Custom Button Label' });
    },
    buttonClick: () => {
      // Show a modal or take action.
    }
  }
});
```

#### Authentication
The `AddinClient` provides a `getAuthToken` function for getting an authentication token from the host application.  The token will be a signed JWT with the user's id.  This can be used to look up Sky API tokens for the user or reference then user in an external system.  The JWT should be validated in any system that it passed to before trusting the contents.

##### Getting the authentication token
The `getAuthToken` function will return a promise which will resolve when the token value.

```js
var client = new AddinClient({...});
client.getAuthToken().then((token: string) => {
  // use the token.
});
```
##### Validating the token

#### Showing a modal
The add-in is capable of launching a modal experience over the full page, whether it is a button, tile, or tab add-in type.  The modal will not be scoped to the bounds of the tile.

To launch a modal, call the `showModal` function on the client, passing the URL for the modal and any context data to pass to the modal.

```js
// Parent add-in launching a modal
var client = new AddinClient({...});
client.showModal({
  url: '<modal-addin-url>',
  context: { /* arbitrary context object to pass to modal */ }
});
```
##### Modal Add-in
The host page will launch a full screen iframe for the URL provided, and load it as an add-in the same way it does for tile add-ins.  This page must pull in this same library and use the AddinClient.

The modal add-in will be responsible for rendering the modal element itself.  To create a native modal experience, the add-in may set the body background to `transparent` and launch a SKY UX modal within its full screen iframe.

Like a typical add-in, the modal add-in should register for the `init` callback and will receive `envId` in the arguments. The `context` field for arguments will match the context object passed into the `showModal` call from the parent add-in.  Note that this is crossing iframes so the object has been serialized and deserialized.  It can be used for passing data but not functions.

##### Closing the Modal
The modal add-in is responsible for triggering the close with the `closeModal` function on the client.  It is able to pass context information back to the parent add-in:

```js
// Modal add-in rendered in full screen iframe
var client = new AddinClient({...});
client.closeModal({
  context: { /* arbitrary context object to pass to parent add-in */ }
});
```
The parent add-in can listen to the close event via the `modalClosed` promise returned from `showModal`. The promise will resolve when the modal is closed and include the context data returned from the modal:

```js
// Parent add-in launching a modal
var client = new AddinClient({...});
var modal = client.showModal({
  url: '<modal-addin-url>',
  context: { /* arbitrary context object to pass to modal */ }
});

modal.modalClosed.then((context) => {
  // Handle that the modal is closed.
  // Use the context data passed back from closeModal.
});
```

#### Navigating the parent page
The add-in can choose to navigate the parent page based on user ineractions.  To do so, call `navigate` on the `AddinClient` object.  This function takes an object argument with property `url` for where to navigate. A fully qualified url should be used.

```js
var client = new AddinClient({...});
client.navigate({ url: '<target_url>' });
```

### Vanilla JavaScript/ES5

The SKY API add-in library is also distributed as a UMD bundle.  If you're using ES5 with Node or a tool like Browserify you can `require()` it:

```js
var BBSkyApiAddin = require('@blackbaud/sky-api-addin');
var client = new BBSkyApiAddin.AddinClient({...});
```

If you're using no module loader at all, then you can load the `dist/bundles/sky-api-addin.umd.js` file onto your page and via a `<script>` element or concatenated with the rest of your page's JavaScript and access it via the global `BBSkyApiAddin` variable:

```js
// BBSkyApiAddin is global here.
var client = new BBSkyApiAddin.AddinClient({...});
```
