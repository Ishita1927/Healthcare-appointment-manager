import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

export interface CalendarEventDetails {
  appointmentId: string;
  doctorName: string;
  patientName: string;
  specialization: string;
  date: string; // 'YYYY-MM-DD'
  startTime: string; // 'HH:MM'
  endTime: string; // 'HH:MM'
  summary: string;
  description: string;
  patientEmail: string;
  doctorEmail: string;
}

/**
 * Generate standard RFC5545 iCalendar (.ics) string
 */
export function generateICalString(event: CalendarEventDetails): string {
  const startDt = event.date.replace(/-/g, '') + 'T' + event.startTime.replace(/:/g, '') + '00';
  const endDt = event.date.replace(/-/g, '') + 'T' + event.endTime.replace(/:/g, '') + '00';
  const nowDt = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ClinicPulse Healthcare//Appointment Manager//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:appt-${event.appointmentId}@clinicpulse.health`,
    `DTSTAMP:${nowDt}`,
    `DTSTART:${startDt}`,
    `DTEND:${endDt}`,
    `SUMMARY:${event.summary}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    'LOCATION:ClinicPulse Health Clinic / Virtual Consultation',
    'STATUS:CONFIRMED',
    `ORGANIZER;CN=ClinicPulse:mailto:no-reply@clinicpulse.health`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=${event.doctorName}:mailto:${event.doctorEmail}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=${event.patientName}:mailto:${event.patientEmail}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

/**
 * Generate Direct 1-click Google Calendar Add URL
 */
export function generateGoogleCalendarUrl(event: CalendarEventDetails): string {
  const startDt = event.date.replace(/-/g, '') + 'T' + event.startTime.replace(/:/g, '') + '00';
  const endDt = event.date.replace(/-/g, '') + 'T' + event.endTime.replace(/:/g, '') + '00';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.summary,
    dates: `${startDt}/${endDt}`,
    details: `${event.description}\n\nDoctor: ${event.doctorName} (${event.specialization})\nPatient: ${event.patientName}`,
    location: 'ClinicPulse Medical Centre, Suite 400',
    add: `${event.patientEmail},${event.doctorEmail}`
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Google Calendar API OAuth2 Service
 */
function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/calendar/oauth2callback';

  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function createGoogleCalendarEvent(event: CalendarEventDetails, authTokens?: any): Promise<{ eventId?: string; htmlLink?: string }> {
  const oauth2Client = getOAuth2Client();
  const directLink = generateGoogleCalendarUrl(event);

  if (!oauth2Client || !authTokens) {
    console.log('[Calendar Service] Using direct 1-click Google Calendar link & iCal support.');
    return { htmlLink: directLink };
  }

  try {
    oauth2Client.setCredentials(authTokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const startDateTime = `${event.date}T${event.startTime}:00`;
    const endDateTime = `${event.date}T${event.endTime}:00`;

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: event.summary,
        description: event.description,
        location: 'ClinicPulse Medical Centre',
        start: { dateTime: new Date(startDateTime).toISOString() },
        end: { dateTime: new Date(endDateTime).toISOString() },
        attendees: [
          { email: event.patientEmail, displayName: event.patientName },
          { email: event.doctorEmail, displayName: event.doctorName }
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 }
          ]
        }
      }
    });

    return { eventId: res.data.id || undefined, htmlLink: res.data.htmlLink || directLink };
  } catch (err: any) {
    console.warn('[Calendar Service] Google Calendar API error, returning direct URL fallback:', err.message);
    return { htmlLink: directLink };
  }
}

export async function deleteGoogleCalendarEvent(eventId: string, authTokens?: any): Promise<boolean> {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client || !authTokens || !eventId) return false;

  try {
    oauth2Client.setCredentials(authTokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    await calendar.events.delete({ calendarId: 'primary', eventId });
    return true;
  } catch (err: any) {
    console.warn('[Calendar Service] Failed to delete event via API:', err.message);
    return false;
  }
}
