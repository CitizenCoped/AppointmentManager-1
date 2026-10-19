# Appointment Scheduling Platform

## Overview

This is a comprehensive appointment scheduling and management platform designed for service providers. The application provides complete business operations management including appointment creation, client tracking, financial management, Google Calendar integration, and analytics. Built with modern TypeScript architecture, it features a React frontend with Express.js backend, PostgreSQL database, and multiple external service integrations.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with Hot Module Replacement (HMR)
- **Routing**: Wouter for client-side routing
- **UI Components**: Shadcn/ui + Radix UI component library
- **Styling**: Tailwind CSS with custom CSS variables
- **State Management**: TanStack Query v5 for server state management
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with TypeScript (tsx for development)
- **Framework**: Express.js with middleware-based architecture
- **Authentication**: Session-based authentication with bcrypt password hashing
- **Database**: PostgreSQL with Drizzle ORM and Neon serverless hosting
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple
- **API Design**: RESTful endpoints with comprehensive error handling

### Database Schema
- **Primary Tables**: appointments, users, providers, sessions
- **Planned Tables**: clients (for centralized client management)
- **ORM**: Drizzle with type-safe queries and migrations
- **Connection**: Neon serverless PostgreSQL with WebSocket support
- **Validation**: Zod schemas for type-safe data validation
- **New Fields**: 
  - `reschedule_occurrences`: Tracks the number of times an appointment has been rescheduled

## Key Components

### Authentication System
- Session-based authentication with PostgreSQL session storage
- Password hashing using bcrypt with configurable salt rounds
- Protected routes middleware for secure access control
- User registration, login, and logout handlers

### Appointment Management
- Complete appointment lifecycle management (Schedule → Reschedule → Complete/Cancel)
- Client information tracking with contact details and preferences
- Financial tracking including deposits, revenue, expenses, and collections
- Status-based appointment processing with automated notifications

### Client Management
- Centralized client database with automatic deduplication
- Advanced search across name, email, phone, and notes
- Real-time filtering by status (Active, VIP, Inactive) and marketing channels
- Client detail view with appointment history and analytics
- Client metrics: lifetime value, appointment count, last visit tracking
- Bulk export to CSV for reporting
- Status-based client segmentation (auto-assigned based on activity)
- Integrated with appointment system via client_id foreign key
- See `clients.md` for implementation details

### External Service Integrations
- **Google Calendar API**: Dual-calendar system (active/archive) with OAuth2 authentication
- **Email Notifications**: Nodemailer/SendGrid integration for appointment notifications
- **File Upload**: Multer-based file handling for data imports

### Service Layer Architecture
- `calendarService.ts`: Google Calendar integration with event lifecycle management
- `emailService.ts`: Email notification system with template support
- `notificationService.ts`: Orchestrates multiple notification channels
- `importService.ts`: Data import/validation with transformation logic
- `revenueService.ts`: Financial calculations and revenue tracking

## Data Flow

### Appointment Lifecycle
1. **Creation**: New appointment → Database insertion → Calendar event creation → Email notification
2. **Updates**: Status changes → Revenue calculations → Calendar event updates → Status notifications
3. **Completion**: Final status → Archive calendar move → Financial reconciliation

### Authentication Flow
1. User registration/login → Password validation → Session creation → Protected route access
2. Session persistence → PostgreSQL session store → Automatic session management

### Notification Pipeline
1. Appointment event trigger → Service orchestration → Parallel execution:
   - Email notification dispatch
   - Google Calendar API calls
   - Database updates with event tracking

## External Dependencies

### Core Dependencies
- **Google APIs**: OAuth2 client for Calendar API integration
- **Email Services**: Nodemailer for SMTP or SendGrid for cloud email
- **Database**: Neon PostgreSQL serverless with WebSocket connections
- **Authentication**: bcrypt for password security, express-session for session management

### Development Dependencies
- **Build Tools**: Vite, esbuild for production builds
- **Type Safety**: TypeScript with strict configuration
- **Validation**: Zod for runtime type validation and schema definition
- **Testing**: Built-in service testing endpoints for integration validation

### Environment Variables Required
See `.env.example` for the complete, annotated list and `docs/cred-update/spec.md` for
status and recovery steps. Verify a local setup with `npm run check:creds`; production
exposes `GET /api/health` (presence flags only, no values).

Hard requirements: `DATABASE_URL`, `SESSION_SECRET`. Everything else degrades gracefully
(calendar sync, email, AI extraction switch off when their variables are absent).

Warning: `SESSION_SECRET` also encrypts stored TOTP secrets (`TOTP_ENCRYPTION_KEY` is an
optional override). Rotating either without re-encrypting `users.totp_secret` breaks every
authenticator enrolment.

## Deployment Strategy

### Production Build Process
1. **Frontend**: Vite builds React app to `dist/public` with optimized assets
2. **Backend**: esbuild compiles TypeScript server to `dist/index.js`
3. **Database**: Drizzle migrations ensure schema consistency
4. **Static Assets**: Express serves built frontend from `dist/public`

### Hosting Configuration
- **Platform**: Replit with autoscale deployment target
- **Runtime**: Node.js 20 with PostgreSQL 16 module
- **Port Configuration**: Internal 5000 → External 80 mapping
- **Build Commands**: `npm run build` → `npm run start`

### Environment Setup
- Development: `npm run dev` with tsx hot reloading
- Production: Compiled JavaScript execution with optimized assets
- Database: Automatic schema push with `npm run db:push`

## Changelog

Changelog:
- June 25, 2025: Initial setup
- January 11, 2025: Updated email service to use production URL for deposit confirmation links
- January 11, 2025: Added status-based emojis to calendar appointment titles (✅ for Complete, ❌ for Cancel, 🔄 for Reschedule, 📅 for Scheduled)
- January 11, 2025: Fixed calendar emoji update bug - now properly updates title emoji when moving events to archive calendar for Complete/Cancel status
- January 11, 2025: Enhanced Google Calendar integration to support multiple reschedules:
  - Updated date/time selection logic to properly use reschedule dates
  - Improved calendar event search to check both active and archive calendars
  - Fixed issue where multiple reschedules would fail to update the calendar event
  - Ensured rescheduled appointments always stay in the active calendar
  - Updated event descriptions to show "CURRENT SCHEDULE" for better clarity
- January 11, 2025: Fixed critical bug preventing multiple reschedules from updating Google Calendar:
  - Modified notification service to detect date/time changes for appointments already in "Reschedule" status
  - Updated routes to trigger notifications for reschedule date changes, not just status changes
  - Appointments can now be rescheduled infinitely until marked Complete or Canceled
  - Created documentation file: reschedule-morethanonce.md
- January 11, 2025: Added reschedule occurrences tracking:
  - Added `reschedule_occurrences` column to appointments table
  - Automatically increments counter each time an appointment is rescheduled
  - Tracks total number of reschedules for business metrics and analytics
- July 12, 2025: Implemented Future Earnings Analytics feature:
  - Added new Analytics tab "Future Earnings" for projecting revenue from scheduled appointments
  - Created API endpoint `/api/analytics/future-earnings` with timeframe filtering
  - Added California timezone support (PDT, UTC-7) for accurate date calculations
  - Fixed issue where rescheduled appointments use `updated_start_date` instead of original date
  - Implemented confidence scoring based on appointment status and reschedule history
  - Added interactive visualizations including revenue timeline and provider breakdown
  - Supports filtering by time periods (Today, 1/2/3 weeks, 1 month, All future)
- July 12, 2025: Enhanced Analytics Dashboard with additional time frame filters:
  - Added "Today" filter to view appointments from current day only
  - Added "Last 7 Days", "Last 14 Days", and "Last 21 Days" options
  - Improved granular filtering for better historical appointment analysis
- July 23, 2025: Implemented comprehensive Client Management Module:
  - Created centralized clients table with normalized database schema
  - Built full CRUD API endpoints for client operations
  - Developed client management UI with search, filters, and detail views
  - Successfully migrated 38 unique clients from 54 appointments
  - Implemented client analytics: lifetime value, appointment counts, status tracking
  - Added bulk export to CSV functionality
  - Fixed search functionality with debouncing for better performance
  - All appointments now linked to clients via foreign key relationship

### Conversation Create (AI-Powered)
- AI-powered appointment creation from conversation data
- Entry point: "New Appointment" dropdown on Dashboard and Appointments pages
- Two options: "Manual Create" (existing form) and "Conversation Create" (AI-powered)
- Supports: pasted text (SMS/MMS), WhatsApp .zip exports, CSV files, screenshot images
- Backend: `POST /api/conversation/analyze` processes uploads and calls Anthropic Claude
- Service: `server/services/conversationService.ts` handles file parsing and AI extraction
- Frontend: `client/src/pages/appointments/conversation-create.tsx` with tab-based upload UI
- Pre-fills the existing appointment form via sessionStorage transfer
- Protected by authentication middleware
- **Rebook Sub-feature**: Type "Rebook [client name] for [date/time]" to look up an existing client's previous appointment, pull all their details (provider, marketing channel, call type, phone, revenue, etc.), and pre-fill the form with the new date/time. Uses exact name matching with fallback to partial match. Shows a "Rebooked from [client]'s previous appointment" banner on the form.

## User Preferences

Preferred communication style: Simple, everyday language.