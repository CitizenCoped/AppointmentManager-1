import nodemailer from 'nodemailer';
import { Appointment } from '@shared/schema';
import { log } from '../logger';
import { formatDate, formatTime } from '../../client/src/lib/format';
import { getAppointmentTotalClientCollections } from '../../shared/appointmentFinancials.js';
import { generateDepositConfirmToken } from '../middleware/depositToken';

// Create reusable transporter object using SMTP transport
export const createTransporter = () => {
  // We need to get credentials from environment variables
  // These will be set using the ask_secrets tool when needed
  const email = process.env.GMAIL_EMAIL;
  const password = process.env.GMAIL_APP_PASSWORD;
  
  if (!email || !password) {
    log('Gmail credentials not found in environment variables', 'emailService');
    return null;
  }
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: email,
      pass: password
    }
  });
};

/**
 * Send an email notification
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const transporter = createTransporter();
    if (!transporter) {
      return false;
    }
    
    const from = process.env.GMAIL_EMAIL;
    
    // Set up email options
    const mailOptions = {
      from: `"Appointment System" <${from}>`,
      to,
      subject,
      html
    };
    
    // Send email
    await transporter.sendMail(mailOptions);
    log(`Email sent to ${to}`, 'emailService');
    return true;
  } catch (error) {
    log(`Error sending email: ${error}`, 'emailService');
    return false;
  }
}

/**
 * Generate email content for new appointment
 */
export function generateNewAppointmentEmail(appointment: Appointment): string {
  // Calculate duration and other dynamic values
  const endTime = appointment.endTime || (() => {
    const [hours, minutes] = appointment.startTime.split(':').map(Number);
    return `${hours + 1}:${minutes.toString().padStart(2, '0')}`;
  })();
  
  // Determine location type message
  const locationType = appointment.callType === 'out-call' ? "OUTCALL TO CLIENT" : "INCALL AT YOUR LOCATION";
  
  // Format notes section
  const clientNotesSection = appointment.hasClientNotes && appointment.clientNotes 
    ? appointment.clientNotes 
    : "No notes provided";
  
  // Calculate due to provider (if not directly available)
  const providerBalanceDue = appointment.providerBalanceDue || 
    ((appointment.contractPrice || 0) - (appointment.clientDeposit || 0));
  
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #2c3e50;">APPOINTMENT DETAILS:</h2>
      <p><strong>Client:</strong> ${appointment.clientName || 'Not specified'}</p>
      <p><strong>Phone:</strong> ${appointment.phoneNumber || 'Not provided'}</p>
      <p><strong>Date:</strong> ${formatDate(appointment.startDate)}</p>
      <p><strong>Time:</strong> ${formatTime(appointment.startTime)} - ${formatTime(endTime)}</p>
      <p><strong>Duration:</strong> ${appointment.callDuration || 1} hour(s)</p>
      <p><strong>Revenue:</strong> $${appointment.contractPrice || 0}</p>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #2c3e50;">Location Information:</h3>
        <p><strong>Location Type:</strong> ${locationType}</p>
        <p><strong>Address:</strong> ${[
          appointment.streetAddress,
          appointment.addressLine2,
          appointment.city,
          appointment.state,
          appointment.zipCode
        ].filter(Boolean).join(', ') || 'Not specified'}</p>
        <p><strong>Location Notes:</strong> ${appointment.outcallDetails || 'None'}</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #2c3e50;">Financial Details:</h3>
        <p><strong>Deposit Received:</strong> $${appointment.clientDeposit || 0} via ${appointment.paymentProcessUsed || 'Not specified'}</p>
        <p><strong>Balance Due:</strong> $${providerBalanceDue}</p>
        <p><strong>Travel Expenses:</strong> $${appointment.travelExpense || 0}</p>
        <p><strong>Hosting Expenses:</strong> $${appointment.hostingExpense || 0}</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #2c3e50;">Client Notes:</h3>
        <p>${clientNotesSection}</p>
      </div>
      
      <p>This appointment has been added to your calendar. Please confirm receipt.</p>
      
      <p><strong>Set by:</strong> ${appointment.setBy}</p>
      
      <p style="margin-top: 30px; font-size: 12px; color: #7f8c8d;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  `;
}

/**
 * Generate email content for appointment status update
 */
export function generateStatusUpdateEmail(
  appointment: Appointment,
  status: string
): string {
  // Calculate duration and other dynamic values
  const endTime = appointment.endTime || (() => {
    const [hours, minutes] = appointment.startTime.split(':').map(Number);
    return `${hours + 1}:${minutes.toString().padStart(2, '0')}`;
  })();
  
  // Calculate updated times if rescheduled
  const updatedEndTime = appointment.updatedEndTime || 
    (appointment.updatedStartTime ? (() => {
      const [hours, minutes] = appointment.updatedStartTime.split(':').map(Number);
      return `${hours + 1}:${minutes.toString().padStart(2, '0')}`;
    })() : '');
  
  // Determine location type message
  const locationType = appointment.callType === 'out-call' ? "OUTCALL TO CLIENT" : "INCALL AT YOUR LOCATION";
  
  // Format notes section
  const clientNotesSection = appointment.hasClientNotes && appointment.clientNotes 
    ? appointment.clientNotes 
    : "No notes provided";
  
  // Calculate due to provider (if not directly available)
  const providerBalanceDue = appointment.providerBalanceDue || 
    ((appointment.contractPrice || 0) - (appointment.clientDeposit || 0));
  
  // Determine if deposit should be applied to future booking based on cancellation details
  const applyToFutureBooking = appointment.cancellationDetails && 
    (appointment.cancellationDetails.includes("apply") || 
     appointment.cancellationDetails.includes("credit") || 
     appointment.cancellationDetails.includes("honor"))
    ? "YES" : "NO";
    
  // Generate email based on status
  switch (status) {
    case 'Reschedule':
      return `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #f39c12;">RESCHEDULED APPOINTMENT:</h2>
          <p><strong>Client:</strong> ${appointment.clientName || 'Not specified'}</p>
          <p><strong>Phone:</strong> ${appointment.phoneNumber || 'Not provided'}</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #e74c3c;">ORIGINAL SCHEDULE:</h3>
            <p><strong>Date:</strong> ${formatDate(appointment.startDate)}</p>
            <p><strong>Time:</strong> ${formatTime(appointment.startTime)} - ${formatTime(endTime)}</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #27ae60;">NEW SCHEDULE:</h3>
            <p><strong>Date:</strong> ${formatDate(appointment.updatedStartDate || '')}</p>
            <p><strong>Time:</strong> ${formatTime(appointment.updatedStartTime || '')} - ${formatTime(updatedEndTime)}</p>
            <p><strong>Duration:</strong> ${appointment.callDuration || 1} hour(s)</p>
            <p><strong>Revenue:</strong> $${appointment.contractPrice || 0}</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2c3e50;">Location Information:</h3>
            <p><strong>Location Type:</strong> ${locationType}</p>
            <p><strong>Address:</strong> ${[
              appointment.streetAddress,
              appointment.addressLine2,
              appointment.city,
              appointment.state,
              appointment.zipCode
            ].filter(Boolean).join(', ') || 'Not specified'}</p>
            <p><strong>Location Notes:</strong> ${appointment.outcallDetails || 'None'}</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2c3e50;">Financial Details:</h3>
            <p><strong>Deposit Received:</strong> $${appointment.clientDeposit || 0} via ${appointment.paymentProcessUsed || 'Not specified'}</p>
            <p><strong>Balance Due:</strong> $${providerBalanceDue}</p>
            <p><strong>Travel Expenses:</strong> $${appointment.travelExpense || 0}</p>
            <p><strong>Hosting Expenses:</strong> $${appointment.hostingExpense || 0}</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2c3e50;">Client Notes:</h3>
            <p>${clientNotesSection}</p>
          </div>
          
          <p>Your calendar has been updated with these changes. Please confirm receipt.</p>
          
          <p><strong>Set by:</strong> ${appointment.setBy}</p>
          
          <p style="margin-top: 30px; font-size: 12px; color: #7f8c8d;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      `;
    
    case 'Cancel':
      const depositRefundedToClient = appointment.depositRefundedToClient || 0;
      const baseUrl =
        process.env.APP_BASE_URL ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : "https://serasomatic.vercel.app");
      const token = generateDepositConfirmToken(appointment.id);
      const confirmUrl = `${baseUrl}/confirm-deposit-return/${appointment.id}?token=${encodeURIComponent(token)}`;
      
      return `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #e74c3c;">APPOINTMENT CANCELLED</h2>
          <p><strong>Client:</strong> ${appointment.clientName || 'Not specified'}</p>
          <p><strong>Phone:</strong> ${appointment.phoneNumber || 'Not provided'}</p>
          <p><strong>Original Date:</strong> ${formatDate(appointment.startDate)}</p>
          <p><strong>Original Time:</strong> ${formatTime(appointment.startTime)} - ${formatTime(endTime)}</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2c3e50;">Cancellation Information:</h3>
            <p><strong>Cancelled by:</strong> ${appointment.whoCanceled === 'client' ? 'Client' : 'Provider'}</p>
            <p><strong>Reason:</strong> ${appointment.cancellationDetails || 'Not specified'}</p>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <h3 style="margin-top: 0; color: #856404;">Deposit Return Information:</h3>
            <p><strong>Original Client Deposit:</strong> $${appointment.clientDeposit || 0}</p>
            <p><strong>Amount of Deposit to be Returned:</strong> $${depositRefundedToClient}</p>
            ${depositRefundedToClient > 0 ? `
              <p style="margin-top: 15px;">
                <strong>Please <a href="${confirmUrl}" style="color: #007bff; text-decoration: none; font-weight: bold;">Click Here</a> to confirm that the client has been refunded.</strong>
              </p>
            ` : '<p><strong>No deposit refund required.</strong></p>'}
          </div>
          
          <p>This appointment has been removed from your calendar.</p>
          
          <p><strong>Set by:</strong> ${appointment.setBy}</p>
          
          <p style="margin-top: 30px; font-size: 12px; color: #7f8c8d;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      `;
    
    case 'Complete':
      return `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #27ae60;">APPOINTMENT COMPLETED:</h2>
          <p><strong>Client:</strong> ${appointment.clientName || 'Not specified'}</p>
          <p><strong>Phone:</strong> ${appointment.phoneNumber || 'Not provided'}</p>
          <p><strong>Date:</strong> ${formatDate(appointment.startDate)}</p>
          <p><strong>Time:</strong> ${formatTime(appointment.startTime)} - ${formatTime(endTime)}</p>
          <p><strong>Duration:</strong> ${appointment.callDuration || 1} hour(s)</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2c3e50;">Financial Summary:</h3>
            <p><strong>Total Client Collections:</strong> $${getAppointmentTotalClientCollections(appointment)}</p>
            <p><strong>Cash Payment:</strong> $${appointment.cashCollections || 0}</p>
            <p><strong>Digital Payment:</strong> $${appointment.electronicCollections || 0}</p>
            <p><strong>Payment Method:</strong> ${appointment.paymentProcessor || 'Not specified'}</p>
            <p><strong>Payment Notes:</strong> ${appointment.paymentNotes || 'None'}</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2c3e50;">Appointment Outcome:</h3>
            <p><strong>See client again:</strong> ${appointment.seeClientAgain ? 'YES' : 'NO'}</p>
            <p><strong>Notes:</strong> ${appointment.appointmentNotes || 'None'}</p>
          </div>
          
          <p>This appointment has been marked as complete in your calendar.</p>
          
          <p><strong>Set by:</strong> ${appointment.setBy}</p>
          
          <p style="margin-top: 30px; font-size: 12px; color: #7f8c8d;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      `;
    
    default:
      return `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #3498db;">Appointment Status Update</h2>
          <p>Your appointment status has been updated to: ${status}</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2c3e50;">Appointment Details:</h3>
            <p><strong>Client:</strong> ${appointment.clientName || 'Not specified'}</p>
            <p><strong>Date:</strong> ${formatDate(appointment.startDate)}</p>
            <p><strong>Time:</strong> ${formatTime(appointment.startTime)} - ${formatTime(endTime)}</p>
          </div>
          
          <p>Please log in to the appointment management system for more details.</p>
          
          <p><strong>Set by:</strong> ${appointment.setBy}</p>
          
          <p style="margin-top: 30px; font-size: 12px; color: #7f8c8d;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      `;
  }
}

/**
 * Send notification for a new appointment
 */
export async function sendNewAppointmentNotification(
  appointment: Appointment
): Promise<boolean> {
  try {
    // First determine who to send the email to
    let recipientEmail = process.env.NOTIFICATION_EMAIL; // Default notification email
    
    // If client has email and wants to receive notifications
    if (appointment.clientEmail && appointment.clientUsesEmail) {
      recipientEmail = appointment.clientEmail;
    }
    
    if (!recipientEmail) {
      log('No recipient email found for appointment notification', 'emailService');
      return false;
    }
    
    const subject = `NEW APPOINTMENT: ${appointment.clientName || 'Client'} on ${formatDate(appointment.startDate)} at ${formatTime(appointment.startTime)}`;
    const html = generateNewAppointmentEmail(appointment);
    
    return await sendEmail(recipientEmail, subject, html);
  } catch (error) {
    log(`Error sending new appointment notification: ${error}`, 'emailService');
    return false;
  }
}

/**
 * Send notification for appointment status change
 */
export async function sendStatusUpdateNotification(
  appointment: Appointment,
  status: string
): Promise<boolean> {
  try {
    // Determine who to send the email to
    let recipientEmail = process.env.NOTIFICATION_EMAIL; // Default notification email
    
    // If client has email and wants to receive notifications
    if (appointment.clientEmail && appointment.clientUsesEmail) {
      recipientEmail = appointment.clientEmail;
    }
    
    if (!recipientEmail) {
      log('No recipient email found for status update notification', 'emailService');
      return false;
    }
    
    // Set subject based on status
    let subject = '';
    switch(status) {
      case 'Reschedule':
        subject = `RESCHEDULED: ${appointment.clientName} moved from ${formatDate(appointment.startDate)} to ${formatDate(appointment.updatedStartDate || '')}`;
        break;
      case 'Cancel':
        subject = `CANCELLED: ${appointment.clientName} appointment on ${formatDate(appointment.startDate)} at ${formatTime(appointment.startTime)}`;
        break;
      case 'Complete':
        subject = `COMPLETED: ${appointment.clientName} appointment on ${formatDate(appointment.startDate)}`;
        break;
      default:
        subject = `Appointment ${status} Notification`;
    }
    
    const html = generateStatusUpdateEmail(appointment, status);
    
    return await sendEmail(recipientEmail, subject, html);
  } catch (error) {
    log(`Error sending status update notification: ${error}`, 'emailService');
    return false;
  }
}