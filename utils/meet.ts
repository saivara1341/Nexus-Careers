// utils/meet.ts

/**
 * Generates a random Google Meet link.
 * Note: This is a client-side utility and does not integrate with Google Calendar APIs for scheduled meetings.
 * It simply creates a valid, unique-looking Meet link.
 */
export const generateGoogleMeetLink = (): string => {
    const baseUrl = 'https://meet.google.com/';
    // Generate a unique-looking code in the format: aaa-bbbb-ccc
    const randomCode = Math.random().toString(36).substring(2, 5) + 
                       '-' + 
                       Math.random().toString(36).substring(2, 6) + 
                       '-' + 
                       Math.random().toString(36).substring(2, 5);
    return baseUrl + randomCode;
};
