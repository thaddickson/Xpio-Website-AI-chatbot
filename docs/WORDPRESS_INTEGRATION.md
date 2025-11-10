# WordPress Integration Guide

This guide explains how to embed the Xpio Health Lead Generation Chatbot into your WordPress website.

## Method 1: Direct Script Embedding (Recommended)

### Step 1: Upload Widget File

1. Upload `chat-widget.js` to your WordPress site
   - Option A: Use WordPress Media Library
   - Option B: Upload via FTP to `/wp-content/uploads/chatbot/`
   - Option C: Host on your backend API server and serve as static file

### Step 2: Add to WordPress Theme

Add this code to your WordPress theme's footer:

**Option A: Using Theme Footer (Appearance > Theme Editor)**

1. Go to Appearance > Theme Editor
2. Select `footer.php`
3. Add before the closing `</body>` tag:

```html
<!-- Xpio Health Chatbot -->
<script src="https://YOUR-API-DOMAIN.com/chat-widget.js"></script>
<script>
  XpioChatbot.init({
    apiUrl: 'https://YOUR-API-DOMAIN.com',
    primaryColor: '#667eea',
    position: 'bottom-right',
    greeting: "Hi! Welcome to Xpio Health. How can we help you today?",
    placeholder: "Type your message..."
  });
</script>
```

**Option B: Using functions.php (Better)**

```php
function xpio_chatbot_enqueue_scripts() {
    // Enqueue the chatbot script
    wp_enqueue_script(
        'xpio-chatbot',
        'https://YOUR-API-DOMAIN.com/chat-widget.js',
        array(),
        '1.0.0',
        true
    );

    // Initialize chatbot
    wp_add_inline_script('xpio-chatbot', "
        XpioChatbot.init({
            apiUrl: 'https://YOUR-API-DOMAIN.com',
            primaryColor: '#667eea',
            position: 'bottom-right'
        });
    ");
}
add_action('wp_enqueue_scripts', 'xpio_chatbot_enqueue_scripts');
```

## Method 2: Plugin Integration

### Step 1: Create Custom Plugin

Create a new folder: `wp-content/plugins/xpio-chatbot/`

Create `xpio-chatbot.php`:

```php
<?php
/**
 * Plugin Name: Xpio Health Chatbot
 * Description: AI-powered lead generation chatbot
 * Version: 1.0.0
 * Author: Xpio Health
 */

if (!defined('ABSPATH')) exit;

class XpioChatbot {
    private $api_url;

    public function __construct() {
        $this->api_url = get_option('xpio_chatbot_api_url', 'https://YOUR-API-DOMAIN.com');

        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('admin_menu', array($this, 'add_settings_page'));
        add_action('admin_init', array($this, 'register_settings'));
    }

    public function enqueue_scripts() {
        wp_enqueue_script(
            'xpio-chatbot',
            $this->api_url . '/chat-widget.js',
            array(),
            '1.0.0',
            true
        );

        $primary_color = get_option('xpio_chatbot_color', '#667eea');
        $position = get_option('xpio_chatbot_position', 'bottom-right');

        wp_add_inline_script('xpio-chatbot', "
            XpioChatbot.init({
                apiUrl: '" . esc_js($this->api_url) . "',
                primaryColor: '" . esc_js($primary_color) . "',
                position: '" . esc_js($position) . "'
            });
        ");
    }

    public function add_settings_page() {
        add_options_page(
            'Xpio Chatbot Settings',
            'Xpio Chatbot',
            'manage_options',
            'xpio-chatbot',
            array($this, 'render_settings_page')
        );
    }

    public function register_settings() {
        register_setting('xpio_chatbot_settings', 'xpio_chatbot_api_url');
        register_setting('xpio_chatbot_settings', 'xpio_chatbot_color');
        register_setting('xpio_chatbot_settings', 'xpio_chatbot_position');
    }

    public function render_settings_page() {
        ?>
        <div class="wrap">
            <h1>Xpio Chatbot Settings</h1>
            <form method="post" action="options.php">
                <?php settings_fields('xpio_chatbot_settings'); ?>
                <table class="form-table">
                    <tr>
                        <th>API URL</th>
                        <td>
                            <input type="text" name="xpio_chatbot_api_url"
                                   value="<?php echo esc_attr(get_option('xpio_chatbot_api_url')); ?>"
                                   class="regular-text">
                        </td>
                    </tr>
                    <tr>
                        <th>Primary Color</th>
                        <td>
                            <input type="color" name="xpio_chatbot_color"
                                   value="<?php echo esc_attr(get_option('xpio_chatbot_color', '#667eea')); ?>">
                        </td>
                    </tr>
                    <tr>
                        <th>Position</th>
                        <td>
                            <select name="xpio_chatbot_position">
                                <option value="bottom-right" <?php selected(get_option('xpio_chatbot_position'), 'bottom-right'); ?>>Bottom Right</option>
                                <option value="bottom-left" <?php selected(get_option('xpio_chatbot_position'), 'bottom-left'); ?>>Bottom Left</option>
                            </select>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }
}

new XpioChatbot();
```

### Step 2: Activate Plugin

1. Go to Plugins > Installed Plugins
2. Find "Xpio Health Chatbot"
3. Click "Activate"
4. Go to Settings > Xpio Chatbot to configure

## Method 3: Page Builder Integration

### Elementor

1. Add a "Custom HTML" widget
2. Paste the script code
3. Place on footer or specific pages

### Divi

1. Add a "Code" module
2. Enable code in body
3. Paste the script code

### WPBakery

1. Add "Raw HTML" element
2. Paste the script code

## Testing

After installation, test:

1. ✅ Chat button appears in bottom corner
2. ✅ Click opens chat window
3. ✅ Initial greeting appears
4. ✅ Can send messages and receive responses
5. ✅ Typing indicators work
6. ✅ Streaming text appears smoothly
7. ✅ Lead capture triggers email notification

## Troubleshooting

### Chatbot doesn't appear

- Check browser console for errors
- Verify API URL is correct
- Ensure script is loading (check Network tab)
- Check if jQuery or other scripts conflict

### CORS errors

- Add your WordPress domain to `ALLOWED_ORIGINS` in backend `.env`
- Restart backend server after changing

### Chat not connecting

- Verify backend is running
- Check API health endpoint: `https://YOUR-API-DOMAIN.com/health`
- Review backend logs

## Customization

### Change Colors

```javascript
XpioChatbot.init({
    apiUrl: 'https://YOUR-API-DOMAIN.com',
    primaryColor: '#FF6B6B', // Your brand color
});
```

### Custom Position

```javascript
XpioChatbot.init({
    apiUrl: 'https://YOUR-API-DOMAIN.com',
    position: 'bottom-left', // or 'bottom-right'
});
```

### Custom Greeting

```javascript
XpioChatbot.init({
    apiUrl: 'https://YOUR-API-DOMAIN.com',
    greeting: 'Hello! Ready to transform your behavioral health practice?'
});
```

## Performance Optimization

### Lazy Loading

```javascript
// Load chatbot only when user scrolls or after delay
setTimeout(function() {
    var script = document.createElement('script');
    script.src = 'https://YOUR-API-DOMAIN.com/chat-widget.js';
    script.onload = function() {
        XpioChatbot.init({ apiUrl: 'https://YOUR-API-DOMAIN.com' });
    };
    document.body.appendChild(script);
}, 3000); // Load after 3 seconds
```

### Conditional Loading

Only load on specific pages:

```php
function xpio_chatbot_enqueue_scripts() {
    // Only load on homepage and contact page
    if (is_front_page() || is_page('contact')) {
        wp_enqueue_script('xpio-chatbot', ...);
    }
}
```

## Security Considerations

1. ✅ Use HTTPS for both WordPress and API
2. ✅ Keep API URL in environment variables
3. ✅ Enable CORS only for your domain
4. ✅ Implement rate limiting on backend
5. ✅ Never expose API keys in frontend code

## Support

For issues or questions:
- Email: tech@xpiohealth.com
- Documentation: See README.md
- Backend logs: Check server logs for errors
