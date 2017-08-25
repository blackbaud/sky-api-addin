# sky-api-addin
SKY API add-in client

[![npm](https://img.shields.io/npm/v/@blackbaud/sky-api-addin.svg)](https://www.npmjs.com/package/@blackbaud/sky-api-addin)
[![status](https://travis-ci.org/blackbaud/sky-api-addin.svg?branch=master)](https://travis-ci.org/blackbaud/sky-api-addin)

## Usage

This library facilitates creating custom add-ins to extend UI experiences within Blackbaud applications.  There are various flavors of extension points, but the general pattern is the same.  The add-in is registered by providing the URL that will be loaded in an iFrame within the application.

This library must be used in your add-in for it to render in the Blackbaud application. The `AddinClient` class will integrate with the host page, passing data and commands between the host and the addin.

#### Initializing the Add-in

All add-ins Construct the `AddinClient` and register for any callbacks from the host page that you wish to handle.  You *must* register for `init`, which will pass the add-in key context information.

Construct the `AddinClient` and register for any callbacks from the host page that you wish to handle.  You *must* register for `init`, which will pass key context information to your add-in.

Your `init` function will be called with an arguments object that contains:

 - `envId` - The environment id for the host page
 - `context` - Additional context of the host page, which will vary for different extensibility points.
 - `ready` - A callback to inform the add-in client that the add-in is initialized and ready to be shown.

Using the information provided in the `init` arguments, the add-in should determine if and how it should be rendered.  Then it should call the `ready` callback, informing the host page.

```js
this.client = new AddinClient({
  callbacks: {
    init: (args) => {
      args.ready({ showUI: true, title: 'My Custom Tile Title' });
    }
  }
});
```

#### Tile and Tab Add-ins
For tile or tab add-ins, the URL for the add-in will be rendered in a visible iFrame on the page, where you can render any custom content.  The iFrame will initially be hidden until an initialize protocol is completed between the host and the add-in.

The host page will handle rendering the tile or tab component around the add-in iframe.  When calling the `ready` callback, the `title` field will indicate the title for the tile or tab component.  Initially, the entire tile/tab will be hidden, and will show on the page if `showUI` is set to `true` in the callback.  You can set it to `false` to indicate that the tile/tab should not be shown, based on the user's privileges or context of the current record, etc.

#### Button Add-ins
For button add-ins, the add-in iFrame will always be hidden.  The `init` protocol is still used, where `showUI` indicates whether the button should show or not on the page.  The `title` field will specify the label for the button.

When doing a button add-in, an additional callback for `buttonClick` should be configured.  This will be invoked whenever the user clicks the button for the add-in to take action.

```js
this.client = new AddinClient({
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

#### Showing a modal

#### Navigating the parent page
The add-in can choose to navigate the parent page based on user ineractions.  To do so, call `navigate` on the `AddinClient` object.  This function takes an object argument with property `url` for where to navigate.

```js
this.client = new AddinClient({...}
this.client.navigate({ url: '<target_url>' });
```
