import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for chat API to prevent abuse
 */
export const chatRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again in 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter rate limiter for lead capture
 */
export const leadCaptureRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 lead submissions per hour per IP
  message: {
    error: 'Too many submissions. Please contact us directly at info@xpiohealth.com'
  }
});

export default { chatRateLimiter, leadCaptureRateLimiter };
