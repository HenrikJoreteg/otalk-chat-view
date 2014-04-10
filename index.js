var _ = require('underscore');
var domify = require('domify');
var StayDown = require('staydown');
var View = require('ampersand-view');
var State = require('ampersand-state');


var ViewState = State.extend({
    type: 'chatView',
    session: {
        editing: 'boolean',
        typing: 'boolean',
        paused: 'boolean',
        active: 'boolean'
    }
});


module.exports = function (BaseView, options) {
    var templates = options.templates;

    return BaseView.extend({
        template: templates.base,

        initialize: function () {
            this.state = new ViewState();

            this.listenTo(this.state, 'change:active', this.handleActive);

            this.listenTo(this.model.messages, 'change', this.refreshModel);
            this.listenTo(this.model.messages, 'sort', this.renderCollection);

            this.render();
        },

        events: {
            'keydown [role="chat-input"]': 'handleKeyDown',
            'keyup [role="chat-input"]': 'handleKeyUp'
        },

        handleActive: function () {
            if (this.state.active) {
                this.sendChatState('active');
            } else {
                this.sendChatState('gone');
            }
        },

        handleKeyDown: function (e) {
            if (e.which === 13 && !e.shiftKey) {
                this.sendChat();
                e.preventDefault();
            } else if (e.which === 38 && this.$chatInput.value === '' && this.model.lastSentMessageID) {
                this.state.editing = true;
                var prev = this.model.messages.find(this.model.lastSentMessageID);
                if (prev) {
                    this.$chatInput.value = prev.body;
                } else {
                    this.state.editing = false;
                }
                e.preventDefault();
            } else if (e.which === 40 && this.state.editing) {
                this.state.editing = false;
                e.preventDefault();
            } else if (!e.ctrlKey && !e.metaKey) {
                if (!this.state.typing || this.state.paused) {
                    this.state.typing = true;
                    this.state.paused = false;
                    this.model.sendChatState('composing');
                }
            }
        },

        handleKeyUp: function (e) {
            this.resizeInput();
            if (this.state.typing && this.$chatInput.value.length === 0) {
                this.state.typing = false;
                this.model.sendChatState('active');
            } else if (this.state.typing) {
                this.pausedTyping();
            }
        },

        pausedTyping: _.debounce(function () {
            if (this.state.typing && !this.state.paused) {
                this.state.paused = true;
                this.model.sendChatState('paused');
            }
        }, 3000),

        render: function () {
            if (this.rendered) {
                this.staydown.checkdown();
                this.resizeInput();
                return this;
            }

            var self = this;

            this.rendered = true;

            this.renderAndBind();

            this.registerBindings(this.state, {
                editing: ['[role="chat-input"]', 'class'],
                typing: ['[role="chat-input"]', 'class'],
                paused: ['[role="chat-input"]', 'class']
            });

            this.$chatInput = this.get('[role="chat-input"] textarea');
            this.$chatBox = this.get('[role="chat-input"]');
            this.$messageList = this.get('[role="message-list"]');

            this.staydown = new StayDown({
                target: this.$messageList,
                interval: 500
            });

            this.renderCollection();

            this.listenTo(this.model.messages, 'add', this.handleChatAdded);

            window.addEventListener('resize', _.bind(this.resizeInput, this));

            this.staydown.checkdown();
            this.resizeInput();

            return this;
        },

        renderCollection: function () {
            var self = this;

            // Empty out the messages container
            while (this.$messageList.firstChild) {
                this.$messageList.removeChild(this.$messageList.firstChild);
            }

            this.model.messages.each(function (model, i) {
                self.appendModel(model);
            });
            this.staydown.checkdown();
        },

        handleChatAdded: function (model) {
            this.appendModel(model, true);
        },

        refreshModel: function (model) {
            var existing = this.get('#chat-' + model.cid);
            var refreshed = domify(this.chatHTML(model, true));
            existing.parentElement.replaceChild(refreshed, existing);
        },

        appendModel: function (model, preload) {
            var self = this;
            var useExistingGroup = this.chatShouldGroupWith(model, this.lastModel);
            var newEl, first, last, items;

            newEl = domify(this.chatHTML(model, useExistingGroup));

            if (useExistingGroup) {
                items = this.$messageList.getElementsByTagName('li');
                last = items[items.length - 1];
                last.getElementsByClassName('messageWrapper')[0].appendChild(newEl);
                this.staydown.checkdown();
            } else {
                this.staydown.append(newEl);
            }

            this.lastModel = model;
        },

        resizeInput: _.throttle(function () {
            var height;
            var scrollHeight;
            var newHeight;
            var newPadding;
            var paddingDelta;
            var maxHeight = 102;

            this.$chatInput.removeAttribute('style');
            height = this.$chatInput.clientHeight;
            scrollHeight = this.$chatInput.scrollHeight;
            newHeight = scrollHeight + 2;

            if (newHeight > maxHeight) newHeight = maxHeight;
            if (newHeight > height) {
                this.$chatInput.style.height = "" + newHeight + "px";
                newPadding = newHeight + 21;
                paddingDelta = newPadding - parseInt(this.$messageList.style.paddingBottom, 10);
                if (!!paddingDelta) {
                    this.$messageList.style.paddingBottom = "" + newPadding + "px";
                }
            }
        }, 300),

        chatHTML: function (msg, useExistingGroup) {
            var classes = [];

            if (msg.isMine) classes.push('mine');
            if (msg.pendingAck) classes.push('pendingAck');
            if (msg.delayed) classes.push('delayed');
            if (msg.edited) classes.push('edited');
            if (msg.pendingReceipt) classes.push('pendingReceipt');
            if (msg.receiptReceived) classes.push('delivered');
            if (msg.meAction) classes.push('meAction');
            if (msg.errorCondition) classes.push('error');


            if (useExistingGroup) {
                return templates.chat({
                    contact: this.model,
                    message: msg,
                    classList: classes
                });
            } else {
                return templates.chatGroup({
                    contact: this.model,
                    message: msg,
                    classList: classes
                });
            }
        },

        chatShouldGroupWith: function (msg, prevMsg) {
            if (msg.type === 'groupchat') {
                return !!prevMsg && prevMsg.fromFullJID === msg.fromFullJID;
            } else {
                return !!prevMsg && prevMsg.fromBareJID === msg.fromBareJID;
            }
        },

        sendChat: function () {
            var val = this.$chatInput.value;

            if (val) {
                this.staydown.intend_down = true;

                if (this.state.editing) {
                    this.model.sendChat(val, this.model.lastSentMessageID);
                } else {
                    this.model.sendChat(val);
                }
            }

            this.state.editing = false;
            this.state.typing = false;
            this.state.paused = false;
            this.$chatInput.value = '';
        }
    });
};
