/**
 * Xpio Health Lead Generation Chatbot Widget
 * Embeddable chat widget for WordPress sites
 *
 * Usage:
 * <script src="https://your-api-domain.com/chat-widget.js"></script>
 * <script>XpioChatbot.init({ apiUrl: 'https://your-api-domain.com' });</script>
 */

(function() {
  'use strict';

  const XpioChatbot = {
    config: {
      apiUrl: '',
      primaryColor: '#FC922B', // Orange brand color for button and header
      secondaryColor: '#2B2B2B',
      accentColor: '#BF5409', // Darker orange for hover states
      userBubbleColor: '#0066FF', // Blue for user messages
      aiBubbleColor: '#0066FF', // Blue for AI messages
      humanBubbleColor: '#10b981', // Green for human/Slack messages
      position: 'bottom-right', // bottom-right, bottom-left
      greeting: "Hi! Welcome to Xpio Health. How can we help you today?",
      placeholder: "Type your message..."
    },

    state: {
      isOpen: false,
      conversationId: null,
      messages: [],
      isLoading: false,
      currentStreamingMessage: ''
    },

    /**
     * Initialize the chatbot
     */
    init(options = {}) {
      this.config = { ...this.config, ...options };

      if (!this.config.apiUrl) {
        console.error('XpioChatbot: apiUrl is required');
        return;
      }

      // Create and inject styles
      this.injectStyles();

      // Create and inject HTML
      this.createWidget();

      // Fetch initial greeting from API
      this.fetchGreeting();

      console.log('✅ Xpio Health Chatbot initialized');
    },

    /**
     * Inject CSS styles
     */
    injectStyles() {
      const styles = `
        .xpio-chatbot-button {
          position: fixed;
          ${this.config.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
          bottom: 20px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: ${this.config.primaryColor};
          color: white;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          transition: transform 0.2s, box-shadow 0.2s;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .xpio-chatbot-button:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(0,0,0,0.2);
        }

        .xpio-chatbot-button.open {
          display: none;
        }

        .xpio-chat-window {
          position: fixed;
          ${this.config.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
          bottom: 20px;
          width: 450px;
          height: 700px;
          max-height: calc(100vh - 40px);
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1);
          display: none;
          flex-direction: column;
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          transform-origin: ${this.config.position.includes('right') ? 'bottom right' : 'bottom left'};
          opacity: 0;
          transform: translateY(20px) scale(0.95);
          transition: opacity 0.3s ease, transform 0.3s ease;
        }

        .xpio-chat-window.open {
          display: flex;
          animation: xpio-pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }

        @keyframes xpio-pop-in {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.9);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .xpio-chat-header {
          padding: 16px;
          background: linear-gradient(135deg, ${this.config.primaryColor} 0%, ${this.config.accentColor} 100%);
          color: white;
          border-radius: 16px 16px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .xpio-chat-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .xpio-chat-header button {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .xpio-chat-header button:hover {
          background: rgba(255,255,255,0.2);
        }

        .xpio-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #f8f9fa;
        }

        .xpio-message {
          padding: 12px;
          border-radius: 8px;
          max-width: 80%;
          word-wrap: break-word;
          line-height: 1.5;
          font-size: 14px;
        }

        .xpio-message.user {
          background: ${this.config.userBubbleColor};
          color: white;
          margin-left: auto;
          border-bottom-right-radius: 2px;
          box-shadow: 0 2px 8px rgba(0, 102, 255, 0.2);
        }

        .xpio-message.assistant {
          background: ${this.config.aiBubbleColor};
          color: white;
          border-bottom-left-radius: 2px;
          box-shadow: 0 2px 8px rgba(0, 102, 255, 0.2);
        }

        .xpio-message.human {
          background: ${this.config.humanBubbleColor};
          color: white;
          border-bottom-left-radius: 2px;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
        }

        .xpio-typing-indicator {
          display: flex;
          gap: 4px;
          padding: 12px;
          background: white;
          border-radius: 8px;
          max-width: 60px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .xpio-typing-indicator span {
          width: 8px;
          height: 8px;
          background: #999;
          border-radius: 50%;
          animation: xpio-typing 1.4s infinite;
        }

        .xpio-typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .xpio-typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes xpio-typing {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-10px); }
        }

        .xpio-chat-input {
          padding: 16px;
          border-top: 1px solid #e0e0e0;
          display: flex;
          gap: 8px;
          background: white;
          border-radius: 0 0 12px 12px;
        }

        .xpio-chat-input textarea {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 20px;
          resize: none;
          font-family: inherit;
          font-size: 14px;
          max-height: 100px;
        }

        .xpio-chat-input textarea:focus {
          outline: none;
          border-color: ${this.config.primaryColor};
        }

        .xpio-chat-input button {
          padding: 8px 16px;
          background: ${this.config.primaryColor};
          color: white;
          border: none;
          border-radius: 20px;
          cursor: pointer;
          font-weight: 600;
          transition: background 0.2s;
        }

        .xpio-chat-input button:hover:not(:disabled) {
          background: ${this.config.accentColor};
        }

        .xpio-chat-input button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .xpio-lead-badge {
          display: inline-block;
          padding: 4px 8px;
          background: #10b981;
          color: white;
          border-radius: 4px;
          font-size: 12px;
          margin-top: 8px;
        }

        @media (max-width: 768px) {
          .xpio-chat-window {
            width: 100%;
            height: 100%;
            bottom: 0;
            right: 0;
            left: 0;
            border-radius: 0;
            max-height: 100vh;
          }

          .xpio-chatbot-button {
            right: 15px;
            bottom: 15px;
          }
        }
      `;

      const styleSheet = document.createElement('style');
      styleSheet.textContent = styles;
      document.head.appendChild(styleSheet);
    },

    /**
     * Create widget HTML
     */
    createWidget() {
      const widgetHTML = `
        <button class="xpio-chatbot-button" id="xpio-chat-toggle" aria-label="Open chat" title="Xpio Delphi AI Chat">
          💬
        </button>

        <div class="xpio-chat-window" id="xpio-chat-window">
          <div class="xpio-chat-header">
            <h3>Xpio Health Delphi AI</h3>
            <button id="xpio-chat-close" aria-label="Close chat">×</button>
          </div>

          <div class="xpio-chat-messages" id="xpio-chat-messages">
            <!-- Messages will be inserted here -->
          </div>

          <div class="xpio-chat-input">
            <textarea
              id="xpio-chat-input"
              placeholder="${this.config.placeholder}"
              rows="1"
            ></textarea>
            <button id="xpio-chat-send">Send</button>
          </div>
        </div>
      `;

      const container = document.createElement('div');
      container.innerHTML = widgetHTML;
      document.body.appendChild(container);

      // Add event listeners
      this.attachEventListeners();
    },

    /**
     * Attach event listeners
     */
    attachEventListeners() {
      const toggleBtn = document.getElementById('xpio-chat-toggle');
      const closeBtn = document.getElementById('xpio-chat-close');
      const sendBtn = document.getElementById('xpio-chat-send');
      const input = document.getElementById('xpio-chat-input');
      const chatWindow = document.getElementById('xpio-chat-window');

      toggleBtn.addEventListener('click', () => this.toggleChat());
      closeBtn.addEventListener('click', () => this.toggleChat());
      sendBtn.addEventListener('click', () => this.sendMessage());

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      // Auto-resize textarea
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';
      });
    },

    /**
     * Fetch initial greeting from API
     */
    async fetchGreeting() {
      try {
        const response = await fetch(`${this.config.apiUrl}/api/chat/greeting`);
        const data = await response.json();
        if (data.message) {
          this.config.greeting = data.message;
        }
      } catch (error) {
        console.error('Failed to fetch greeting:', error);
      }
    },

    /**
     * Toggle chat window
     */
    toggleChat() {
      this.state.isOpen = !this.state.isOpen;

      const button = document.getElementById('xpio-chat-toggle');
      const chatWindow = document.getElementById('xpio-chat-window');

      if (this.state.isOpen) {
        button.classList.add('open');
        chatWindow.classList.add('open');

        // Add greeting if no messages
        if (this.state.messages.length === 0) {
          this.addMessage('assistant', this.config.greeting);
        }

        // Focus input
        document.getElementById('xpio-chat-input').focus();
      } else {
        button.classList.remove('open');
        chatWindow.classList.remove('open');
      }
    },

    /**
     * Add message to chat
     */
    addMessage(role, content) {
      this.state.messages.push({ role, content });

      const messagesContainer = document.getElementById('xpio-chat-messages');
      const messageDiv = document.createElement('div');
      messageDiv.className = `xpio-message ${role}`;
      messageDiv.textContent = content;

      messagesContainer.appendChild(messageDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },

    /**
     * Update the last assistant message (for streaming)
     */
    updateLastMessage(content) {
      const messagesContainer = document.getElementById('xpio-chat-messages');
      const messages = messagesContainer.querySelectorAll('.xpio-message.assistant');
      const lastMessage = messages[messages.length - 1];

      if (lastMessage) {
        lastMessage.textContent = content;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    },

    /**
     * Show typing indicator
     */
    showTyping() {
      const messagesContainer = document.getElementById('xpio-chat-messages');
      const typingDiv = document.createElement('div');
      typingDiv.className = 'xpio-typing-indicator';
      typingDiv.id = 'xpio-typing';
      typingDiv.innerHTML = '<span></span><span></span><span></span>';

      messagesContainer.appendChild(typingDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },

    /**
     * Hide typing indicator
     */
    hideTyping() {
      const typing = document.getElementById('xpio-typing');
      if (typing) {
        typing.remove();
      }
    },

    /**
     * Send message to API
     */
    async sendMessage() {
      const input = document.getElementById('xpio-chat-input');
      const message = input.value.trim();

      if (!message || this.state.isLoading) return;

      // Add user message
      this.addMessage('user', message);
      input.value = '';
      input.style.height = 'auto';

      // Show typing
      this.showTyping();
      this.state.isLoading = true;
      this.state.currentStreamingMessage = '';

      try {
        const response = await fetch(`${this.config.apiUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            conversationId: this.state.conversationId
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        this.hideTyping();
        this.addMessage('assistant', ''); // Add empty message to update

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'conversation_id') {
                  this.state.conversationId = data.conversationId;
                } else if (data.type === 'text') {
                  this.state.currentStreamingMessage += data.content;
                  this.updateLastMessage(this.state.currentStreamingMessage);
                } else if (data.type === 'lead_captured') {
                  console.log('✅ Lead captured!', data.leadId);
                  this.showLeadCapturedBadge();
                } else if (data.type === 'done') {
                  console.log('✅ Message complete');
                } else if (data.type === 'error') {
                  console.error('API error:', data.error);
                  this.updateLastMessage('Sorry, something went wrong. Please try again.');
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      } catch (error) {
        console.error('Error sending message:', error);
        this.hideTyping();
        this.addMessage('assistant', 'Sorry, I\'m having trouble connecting. Please try again or contact us at info@xpiohealth.com');
      } finally {
        this.state.isLoading = false;
      }
    },

    /**
     * Show lead captured badge
     */
    showLeadCapturedBadge() {
      const messagesContainer = document.getElementById('xpio-chat-messages');
      const badge = document.createElement('div');
      badge.className = 'xpio-lead-badge';
      badge.textContent = '✓ Information captured - We\'ll be in touch soon!';
      messagesContainer.appendChild(badge);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  };

  // Expose to global scope
  window.XpioChatbot = XpioChatbot;
})();
