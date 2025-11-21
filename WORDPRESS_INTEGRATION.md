# WordPress Integration Guide

## Prerequisites

- ✅ Backend deployed to Railway (see RAILWAY_DEPLOYMENT.md)
- ✅ Railway deployment URL (e.g., `https://xpio-website-ai-chatbot.up.railway.app`)
- ✅ WordPress admin access to xpiohealth.com

## Method 1: Add to Theme (Recommended)

This method adds the chatbot to ALL pages of your WordPress site.

### Step 1: Log into WordPress Admin

1. Go to https://xpiohealth.com/wp-admin
2. Log in with your credentials

### Step 2: Edit Theme Footer

1. In WordPress admin, go to **Appearance → Theme File Editor**
2. If you see a warning, click "I understand"
3. On the right sidebar, find and click `footer.php`
4. Scroll to the bottom, find `</body>` tag
5. **Paste this code RIGHT BEFORE** `</body>`:

```html
<!-- Xpio Health AI Chatbot -->
<script src="https://YOUR-RAILWAY-URL.up.railway.app/chat-widget.js"></script>
<script>
  XpioChatbot.init({
    apiUrl: 'https://YOUR-RAILWAY-URL.up.railway.app',
    primaryColor: '#FC922B',
    position: 'bottom-right'
  });
</script>
```

6. **Replace** `YOUR-RAILWAY-URL` with your actual Railway deployment URL
7. Click "Update File"

### Step 3: Test It!

1. Visit your website: https://xpiohealth.com
2. You should see a chat bubble in the bottom-right corner
3. Click it and start chatting!

---

## Method 2: Using a Plugin (Alternative)

If you don't want to edit theme files, use a plugin to inject the code.

### Option A: Insert Headers and Footers Plugin

1. In WordPress admin, go to **Plugins → Add New**
2. Search for "Insert Headers and Footers"
3. Install and activate
4. Go to **Settings → Insert Headers and Footers**
5. Paste the chatbot code (from Method 1) in the **Footer** section
6. Click "Save"

### Option B: Custom HTML Widget

1. Go to **Appearance → Widgets**
2. Add a "Custom HTML" widget to your footer
3. Paste the chatbot code (from Method 1)
4. Save

---

## Method 3: Add to Specific Pages Only

If you only want the chatbot on certain pages:

### Using Gutenberg/Block Editor:

1. Edit the page where you want the chatbot
2. Add a "Custom HTML" block
3. Paste the chatbot code (from Method 1)
4. Publish/Update the page

### Using Classic Editor:

1. Edit the page
2. Switch to "Text" tab (not "Visual")
3. Paste the chatbot code at the bottom
4. Publish/Update the page

---

## Customization Options

You can customize the chatbot by changing these options in the init() call:

```javascript
XpioChatbot.init({
  // Required: Your Railway API URL
  apiUrl: 'https://YOUR-RAILWAY-URL.up.railway.app',

  // Optional: Primary brand color (hex code)
  primaryColor: '#FC922B',  // Xpio Health orange

  // Optional: Chat bubble position
  position: 'bottom-right',  // or 'bottom-left'

  // Optional: Initial greeting message
  greeting: 'Hi! How can I help with your healthcare technology needs?',

  // Optional: Chat bubble size
  bubbleSize: '60px',

  // Optional: Z-index (if it appears behind other elements)
  zIndex: 9999
});
