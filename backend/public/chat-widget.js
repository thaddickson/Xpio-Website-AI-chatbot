/**
 * Multi-Tenant Lead Generation Chatbot Widget
 * Embeddable chat widget for any website
 *
 * Usage (Single Tenant - Backwards Compatible):
 * <script src="https://your-api-domain.com/chat-widget.js"></script>
 * <script>XpioChatbot.init({ apiUrl: 'https://your-api-domain.com' });</script>
 *
 * Usage (Multi-Tenant with API Key):
 * <script src="https://chat.yourplatform.com/chat-widget.js"></script>
 * <script>XpioChatbot.init({ apiKey: 'pk_live_yourcompany_xxxx' });</script>
 *
 * All branding/settings loaded automatically from tenant configuration
 */

(function() {
  'use strict';

  const XpioChatbot = {
    config: {
      // Multi-tenant: API key identifies the tenant
      apiKey: null,

      // Can be auto-detected or overridden
      apiUrl: '',

      // Branding (loaded from tenant settings if apiKey provided)
      primaryColor: '#FC922B',
      secondaryColor: '#1a1a1a',
      accentColor: '#BF5409',
      userBubbleColor: '#0066FF',
      aiBubbleColor: '#2B2B2B',
      humanBubbleColor: '#10b981',
      position: 'bottom-right',
      greeting: "Hi! How can we help you today?",
      placeholder: "Type your message...",
      chatTitle: "Chat with us",
      logoUrl: null,
      showWatermark: true,
      calendlyUrl: null
    },

    state: {
      isOpen: false,
      conversationId: null,
      messages: [],
      isLoading: false,
      currentStreamingMessage: '',
      isHandedOff: false,
      pollingInterval: null,
      hasShownProactiveGreeting: false,
      tenantLoaded: false
    },

    /**
     * Initialize the chatbot
     */
    async init(options = {}) {
      this.config = { ...this.config, ...options };

      // If API key provided, load tenant settings
      if (this.config.apiKey) {
        await this.loadTenantSettings();
      } else if (!this.config.apiUrl) {
        console.error('XpioChatbot: apiUrl or apiKey is required');
        return;
      }

      // Create and inject styles
      this.injectStyles();

      // Create and inject HTML
      this.createWidget();

      // Fetch initial greeting from API
      this.fetchGreeting();

      // Show proactive greeting after delay
      this.showProactiveGreeting();

      console.log('✅ Chatbot initialized', this.config.apiKey ? `(Tenant: ${this.config.apiKey.split('_')[2]})` : '');
    },

    /**
     * Load tenant settings from API key
     */
    async loadTenantSettings() {
      try {
        // Extract API URL from script src or use default
        if (!this.config.apiUrl) {
          const scripts = document.querySelectorAll('script[src*="chat-widget"]');
          if (scripts.length > 0) {
            const scriptUrl = new URL(scripts[scripts.length - 1].src);
            this.config.apiUrl = scriptUrl.origin;
          }
        }

        const response = await fetch(`${this.config.apiUrl}/api/widget/config`, {
          headers: {
            'X-API-Key': this.config.apiKey
          }
        });

        if (!response.ok) {
          console.warn('Failed to load tenant settings, using defaults');
          return;
        }

        const data = await response.json();

        // Apply tenant branding
        if (data.branding) {
          if (data.branding.primaryColor) this.config.primaryColor = data.branding.primaryColor;
          if (data.branding.chatTitle) this.config.chatTitle = data.branding.chatTitle;
          if (data.branding.greeting) this.config.greeting = data.branding.greeting;
          if (data.branding.logoUrl) this.config.logoUrl = data.branding.logoUrl;
        }

        // Apply tenant features
        if (data.features) {
          this.config.showWatermark = !data.features.removeWatermark;
        }

        // Apply integrations
        if (data.calendlyUrl) {
          this.config.calendlyUrl = data.calendlyUrl;
        }

        this.state.tenantLoaded = true;
        console.log('✅ Tenant settings loaded');
      } catch (error) {
        console.error('Error loading tenant settings:', error);
      }
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
          background: #2B2B2B;
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
          color: ${this.config.primaryColor};
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
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: #ffffff;
        }

        .xpio-message {
          padding: 12px 16px;
          border-radius: 18px;
          max-width: 75%;
          word-wrap: break-word;
          line-height: 1.5;
          font-size: 14px;
          position: relative;
          animation: xpio-message-in 0.3s ease;
        }

        @keyframes xpio-message-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .xpio-message.user {
          background: ${this.config.userBubbleColor};
          color: white;
          margin-left: auto;
          align-self: flex-end;
          border-bottom-right-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 102, 255, 0.2);
        }

        .xpio-message.assistant {
          background: ${this.config.aiBubbleColor};
          color: white;
          align-self: flex-start;
          border-bottom-left-radius: 4px;
          box-shadow: 0 2px 8px rgba(43, 43, 43, 0.25);
        }

        .xpio-message.assistant::before {
          content: '';
          position: absolute;
          left: -32px;
          top: 0;
          width: 24px;
          height: 24px;
          background-image: url('https://xpiohealth.com/wp-content/uploads/2022/04/Xpio-Health-Web-Logo.png');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }

        .xpio-message.human {
          background: ${this.config.humanBubbleColor};
          color: white;
          align-self: flex-start;
          border-bottom-left-radius: 4px;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
        }

        .xpio-message.human::before {
          content: '👨‍💼';
          position: absolute;
          left: -32px;
          top: 0;
          font-size: 20px;
        }

        .xpio-message.user::before {
          content: '👤';
          position: absolute;
          right: -32px;
          top: 0;
          font-size: 20px;
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

        .xpio-quick-actions {
          padding: 8px 16px 0;
          background: white;
          border-top: 1px solid #e0e0e0;
          display: flex;
          gap: 8px;
          justify-content: center;
        }

        .xpio-quick-action-btn {
          padding: 8px 16px;
          background: ${this.config.primaryColor};
          color: white;
          border: none;
          border-radius: 20px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .xpio-quick-action-btn:hover {
          background: ${this.config.accentColor};
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }

        .xpio-chat-input {
          padding: 16px;
          border-top: 1px solid #e0e0e0;
          display: flex;
          gap: 8px;
          background: white;
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

        .xpio-privacy-footer {
          padding: 8px 16px;
          background: #f8f9fa;
          border-top: 1px solid #e0e0e0;
          text-align: center;
          font-size: 11px;
          color: #666;
          border-radius: 0 0 16px 16px;
        }

        .xpio-privacy-footer a {
          color: ${this.config.primaryColor};
          text-decoration: none;
        }

        .xpio-privacy-footer a:hover {
          text-decoration: underline;
        }

        .xpio-proactive-message {
          position: fixed;
          ${this.config.position.includes('right') ? 'right: 90px;' : 'left: 90px;'}
          bottom: 30px;
          background: white;
          padding: 12px 16px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          max-width: 280px;
          font-size: 14px;
          line-height: 1.4;
          color: #333;
          z-index: 9998;
          animation: xpio-slide-in 0.4s ease-out;
          display: none;
        }

        .xpio-proactive-message.show {
          display: block;
        }

        .xpio-proactive-message::before {
          content: '';
          position: absolute;
          ${this.config.position.includes('right') ? 'right: -8px;' : 'left: -8px;'}
          bottom: 20px;
          width: 0;
          height: 0;
          border-style: solid;
          ${this.config.position.includes('right')
            ? 'border-width: 8px 0 8px 8px; border-color: transparent transparent transparent white;'
            : 'border-width: 8px 8px 8px 0; border-color: transparent white transparent transparent;'}
        }

        .xpio-proactive-close {
          position: absolute;
          top: 4px;
          right: 4px;
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          font-size: 16px;
          padding: 0;
          width: 20px;
          height: 20px;
          line-height: 1;
        }

        .xpio-proactive-close:hover {
          color: #333;
        }

        @keyframes xpio-slide-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
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

        <div class="xpio-proactive-message" id="xpio-proactive-message">
          <button class="xpio-proactive-close" id="xpio-proactive-close" aria-label="Close">×</button>
          <div>👋 Hi! Need help with behavioral health technology? I'm here to answer your questions!</div>
        </div>

        <div class="xpio-chat-window" id="xpio-chat-window">
          <div class="xpio-chat-header">
            <h3>Xpio Health Delphi AI</h3>
            <button id="xpio-chat-close" aria-label="Close chat">×</button>
          </div>

          <div class="xpio-chat-messages" id="xpio-chat-messages">
            <!-- Messages will be inserted here -->
          </div>

          <div class="xpio-quick-actions">
            <button class="xpio-quick-action-btn" id="xpio-schedule-btn" title="Schedule a meeting with Thad">
              📅 Schedule a Meeting
            </button>
          </div>

          <div class="xpio-chat-input">
            <textarea
              id="xpio-chat-input"
              placeholder="${this.config.placeholder}"
              rows="1"
            ></textarea>
            <button id="xpio-chat-send">Send</button>
          </div>

          <div class="xpio-privacy-footer">
            By using this chat, you agree to our <a href="${this.config.apiUrl}/privacy-policy.html" target="_blank">Privacy Policy</a>
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
      const proactiveMessage = document.getElementById('xpio-proactive-message');
      const proactiveClose = document.getElementById('xpio-proactive-close');

      toggleBtn.addEventListener('click', () => this.toggleChat());
      closeBtn.addEventListener('click', () => this.toggleChat());
      sendBtn.addEventListener('click', () => this.sendMessage());

      // Schedule meeting button
      const scheduleBtn = document.getElementById('xpio-schedule-btn');
      if (scheduleBtn) {
        scheduleBtn.addEventListener('click', () => {
          window.open('https://calendly.com/thad-xpiohealth/30min', '_blank');
        });
      }

      // Proactive message handlers
      if (proactiveMessage) {
        proactiveMessage.addEventListener('click', (e) => {
          if (e.target !== proactiveClose) {
            this.hideProactiveMessage();
            this.toggleChat();
          }
        });
      }

      if (proactiveClose) {
        proactiveClose.addEventListener('click', (e) => {
          e.stopPropagation();
          this.hideProactiveMessage();
        });
      }

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
        const headers = {};
        if (this.config.apiKey) {
          headers['X-API-Key'] = this.config.apiKey;
        }

        const response = await fetch(`${this.config.apiUrl}/api/chat/greeting`, { headers });
        const data = await response.json();
        if (data.message) {
          this.config.greeting = data.message;
        }
      } catch (error) {
        console.error('Failed to fetch greeting:', error);
      }
    },

    /**
     * Show proactive greeting after delay
     */
    showProactiveGreeting() {
      // Check if already shown in this session
      if (sessionStorage.getItem('xpio_proactive_shown')) {
        return;
      }

      // Show after 2 seconds (fast engagement for 5-second attention span)
      setTimeout(() => {
        const proactiveMessage = document.getElementById('xpio-proactive-message');
        if (proactiveMessage && !this.state.isOpen) {
          proactiveMessage.classList.add('show');
          sessionStorage.setItem('xpio_proactive_shown', 'true');
          this.state.hasShownProactiveGreeting = true;

          // Auto-hide after 25 seconds if not interacted with
          setTimeout(() => {
            this.hideProactiveMessage();
          }, 25000);
        }
      }, 2000);
    },

    /**
     * Hide proactive message
     */
    hideProactiveMessage() {
      const proactiveMessage = document.getElementById('xpio-proactive-message');
      if (proactiveMessage) {
        proactiveMessage.classList.remove('show');
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

      // If handed off to human, send to Slack thread instead of AI
      if (this.state.isHandedOff) {
        this.state.isLoading = true;
        try {
          await fetch(`${this.config.apiUrl}/api/slack/send-to-thread`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              conversationId: this.state.conversationId,
              message: message
            }),
          });
        } catch (error) {
          console.error('Error sending to Slack:', error);
        } finally {
          this.state.isLoading = false;
        }
        return;
      }

      // Show typing
      this.showTyping();
      this.state.isLoading = true;
      this.state.currentStreamingMessage = '';

      try {
        const headers = {
          'Content-Type': 'application/json',
        };

        // Add API key if provided (multi-tenant mode)
        if (this.config.apiKey) {
          headers['X-API-Key'] = this.config.apiKey;
        }

        const response = await fetch(`${this.config.apiUrl}/api/chat`, {
          method: 'POST',
          headers,
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
                } else if (data.type === 'handed_off') {
                  console.log('🤝 Handed off to human!', data.threadTs);
                  this.state.isHandedOff = true;
                  this.startPollingForSlackMessages();
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
    },

    /**
     * Start polling for Slack messages (when handed off to human)
     */
    startPollingForSlackMessages() {
      console.log('🔄 Starting to poll for Slack messages...');

      // Poll every 2 seconds
      this.state.pollingInterval = setInterval(async () => {
        try {
          const response = await fetch(`${this.config.apiUrl}/api/slack/poll/${this.state.conversationId}`);

          if (!response.ok) return;

          const data = await response.json();

          if (data.messages && data.messages.length > 0) {
            // Display each new message from Slack (human)
            data.messages.forEach(msg => {
              console.log('📨 New message from Slack:', msg.text);
              this.addMessage('human', msg.text);
            });
          }
        } catch (error) {
          console.error('Error polling Slack messages:', error);
        }
      }, 2000);
    },

    /**
     * Stop polling (when conversation ends)
     */
    stopPollingForSlackMessages() {
      if (this.state.pollingInterval) {
        clearInterval(this.state.pollingInterval);
        this.state.pollingInterval = null;
        console.log('🛑 Stopped polling for Slack messages');
      }
    }
  };

  // Expose to global scope
  window.XpioChatbot = XpioChatbot;
})();
