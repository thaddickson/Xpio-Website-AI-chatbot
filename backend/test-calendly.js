import dotenv from 'dotenv';
import { getAvailableTimes } from './src/services/calendlyService.js';

dotenv.config();

console.log('Testing Calendly integration...');
console.log('API Token present:', !!process.env.CALENDLY_API_TOKEN);
console.log('Event link:', process.env.CALENDLY_EVENT_LINK);

getAvailableTimes()
  .then(result => {
    console.log('\n✅ Calendly API Success!');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('\n❌ Calendly API Error:');
    console.error(error);
  });
