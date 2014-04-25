# otalk-chat-view

A companion module to `otalk-client`, this module provides all of the logic
necessary for implementing a chat view. You only need to provide the templates.

## Installing

```sh
$ npm install otalk-chat-view
```

## Using

```javascript
var templates = require('./templates');
var BasePage = require('./base');

var createChatView = require('otalk-chat-view');
var ChatPage = createChatView(BasePage, {
    templates: {
        base: templates.pages.chat,
        chat: templates.includes.chat,
        chatGroup = tempates.includes.chatWrapper
    }
});
```

## View Markup Assumptions

- `chat-input` role

    A `<div/>` or `<form/>` that also contains a `<textarea />` element inside it.

- `message-list` role

    A `<ul/>` where all chats will be inserted (where each `<li/>` is for a group
    of chats all from the same participant).

- `messages-wrapper` class

    A wrapping `<div/>` inside each chat group `<li/>` where messages will be inserted.

### Sample HTML Layout

```html
<div>
  ... your chat view header
  <ul role="message-list">
    <li>
      ... display contact avatar, etc
      <div class="messages-wrapper">
        ... individual message items
      </div>
    </li>
  </ul>
  <form role="chat-input">
    <textarea></textarea>
  </form>
</div>
```

## Model Assumptions

A `Contact` model of some sort is assumed, which provides:

- `.messages`

    A collection of chat message models.

- `.lastSentMessageID`

    The ID of the last sent message, which is needed to do message correction.

- `.sendChatState(state)`

    Sends a typing/paused notification to the contact.

- `.sendChat(body, replaceID)`

    Creates and sends a new message, optionally marked as a correction edit for
    the last sent message.


A `Message` model is assumed to provide:

- `.type`
- `.fromFullJID`
- `.fromBareJID`

## License

MIT

## Created By

If you like this, follow [@lancestout](http://twitter.com/lancestout) on twitter.
