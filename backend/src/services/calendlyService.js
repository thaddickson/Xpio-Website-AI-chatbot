/**
 * Calendly API Service
 * Fetches available booking times for conversational scheduling
 */

/**
 * Get user's Calendly URI from API
 */
async function getCurrentUser() {
  try {
    const response = await fetch('https://api.calendly.com/users/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CALENDLY_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Calendly API error: ${response.status}`);
    }

    const data = await response.json();
    return data.resource.uri;
  } catch (error) {
    console.error('Error fetching Calendly user:', error);
    throw error;
  }
}

/**
 * Get event type UUID from the booking link
 */
async function getEventTypeUuid() {
  try {
    const userUri = await getCurrentUser();

    const response = await fetch(`https://api.calendly.com/event_types?user=${userUri}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CALENDLY_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Calendly API error: ${response.status}`);
    }

    const data = await response.json();

    // Find the 30min event type
    const eventType = data.collection.find(et =>
      et.scheduling_url === process.env.CALENDLY_EVENT_LINK
    );

    if (!eventType) {
      console.error('Event types available:', data.collection.map(et => et.scheduling_url));
      throw new Error('Could not find event type matching: ' + process.env.CALENDLY_EVENT_LINK);
    }

    return eventType.uri;
  } catch (error) {
    console.error('Error fetching event type:', error);
    throw error;
  }
}

/**
 * Get available time slots for booking
 * Returns next 5 available times in a conversational format
 */
export async function getAvailableTimes() {
  try {
    const eventTypeUri = await getEventTypeUuid();

    // Get availability for next 7 days
    // Start 5 minutes from now to ensure it's "in the future"
    const startTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    // End time: 6 days 23 hours from start (under 7 day limit)
    const endTime = new Date(Date.now() + 6.95 * 24 * 60 * 60 * 1000).toISOString();

    const response = await fetch(
      `https://api.calendly.com/event_type_available_times?event_type=${eventTypeUri}&start_time=${startTime}&end_time=${endTime}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.CALENDLY_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Calendly API error response:', errorBody);
      console.error('Request URL:', `https://api.calendly.com/event_type_available_times?event_type=${eventTypeUri}&start_time=${startTime}&end_time=${endTime}`);
      throw new Error(`Calendly API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();

    if (!data.collection || data.collection.length === 0) {
      return {
        available: false,
        message: "No availability in the next week. Please try the booking link for more options.",
        bookingLink: process.env.CALENDLY_EVENT_LINK
      };
    }

    // Group times by date for cleaner display (take first 8 slots)
    const slotsByDate = {};
    data.collection.slice(0, 8).forEach(slot => {
      const date = new Date(slot.start_time);
      const dateKey = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      if (!slotsByDate[dateKey]) {
        slotsByDate[dateKey] = [];
      }
      slotsByDate[dateKey].push(timeStr);
    });

    // Format as clean text for Claude to display
    let formattedSchedule = "Here are Thad's available times:\n\n";
    for (const [dateStr, times] of Object.entries(slotsByDate)) {
      formattedSchedule += `**${dateStr}**\n`;
      times.forEach(time => {
        formattedSchedule += `- ${time}\n`;
      });
      formattedSchedule += '\n';
    }
    formattedSchedule += "To book, click the 'Schedule a Meeting' button below.";

    return {
      available: true,
      formattedSchedule: formattedSchedule,
      bookingLink: process.env.CALENDLY_EVENT_LINK
    };

  } catch (error) {
    console.error('Error fetching Calendly availability:', error);

    // Fallback: just return the booking link
    return {
      available: false,
      error: error.message,
      message: "I'm having trouble checking availability right now. You can view and book times directly here:",
      bookingLink: process.env.CALENDLY_EVENT_LINK
    };
  }
}
