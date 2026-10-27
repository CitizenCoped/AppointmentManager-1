import { 
  appointments, 
  type Appointment, 
  type InsertAppointment,
  users, 
  type User, 
  type InsertUser,
  providers,
  type Provider,
  type InsertProvider,
  providerCredentials,
  type ProviderCredentials,
  type InsertProviderCredentials,
  providerCompensation,
  type ProviderCompensation,
  type InsertProviderCompensation,
  providerContacts,
  type ProviderContacts,
  type InsertProviderContacts,
  providerDocuments,
  type ProviderDocuments,
  type InsertProviderDocuments,
  auditLogs,
  type AuditLog,
  type InsertAuditLog,
  clients,
  type Client,
  type InsertClient
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, like, sql, asc, desc } from "drizzle-orm";
import { computeAppointmentFinancials } from "./services/appointmentFinancials.js";

// Interface for all storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser & { invitePending?: boolean }): Promise<User>;
  updateUserTotp(
    id: number,
    data: {
      totpSecret?: string | null;
      totpEnabled?: boolean;
      totpRecoveryCodes?: string[] | null;
    },
  ): Promise<User | undefined>;
  updateUserPassword(
    id: number,
    passwordHash: string,
    options?: { clearInvitePending?: boolean },
  ): Promise<User | undefined>;
  
  // Provider operations
  getProviders(): Promise<Provider[]>;
  getProvider(id: number): Promise<Provider | undefined>;
  getProviderByEmail(email: string): Promise<Provider | undefined>;
  listProviders(filters?: {
    search?: string;
    department?: string;
    status?: string;
    archived?: boolean;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ providers: Provider[]; total: number }>;
  createProvider(provider: InsertProvider): Promise<Provider>;
  updateProvider(id: number, provider: Partial<InsertProvider>): Promise<Provider | undefined>;
  archiveProvider(id: number, userId?: number): Promise<Provider | undefined>;
  unarchiveProvider(id: number, userId?: number): Promise<Provider | undefined>;
  deleteProvider(id: number): Promise<boolean>;
  
  // Provider Credentials operations
  getProviderCredentials(providerId: number): Promise<ProviderCredentials[]>;
  createProviderCredentials(credentials: InsertProviderCredentials): Promise<ProviderCredentials>;
  updateProviderCredentials(id: number, credentials: Partial<InsertProviderCredentials>): Promise<ProviderCredentials | undefined>;
  deleteProviderCredentials(id: number): Promise<boolean>;
  
  // Provider Compensation operations
  getProviderCompensation(providerId: number): Promise<ProviderCompensation[]>;
  getCurrentProviderCompensation(providerId: number): Promise<ProviderCompensation | undefined>;
  createProviderCompensation(compensation: InsertProviderCompensation): Promise<ProviderCompensation>;
  updateProviderCompensation(id: number, compensation: Partial<InsertProviderCompensation>): Promise<ProviderCompensation | undefined>;
  deleteProviderCompensation(id: number): Promise<boolean>;
  
  // Provider Contacts operations
  getProviderContacts(providerId: number): Promise<ProviderContacts[]>;
  createProviderContact(contact: InsertProviderContacts): Promise<ProviderContacts>;
  updateProviderContact(id: number, contact: Partial<InsertProviderContacts>): Promise<ProviderContacts | undefined>;
  deleteProviderContact(id: number): Promise<boolean>;
  
  // Provider Documents operations
  getProviderDocuments(providerId: number): Promise<ProviderDocuments[]>;
  createProviderDocument(document: InsertProviderDocuments): Promise<ProviderDocuments>;
  deleteProviderDocument(id: number): Promise<boolean>;
  
  // Audit Log operations
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(entity: string, entityId: number): Promise<AuditLog[]>;
  
  // Appointment operations
  getAppointments(): Promise<Appointment[]>;
  getAppointment(id: number): Promise<Appointment | undefined>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, appointment: Partial<InsertAppointment>): Promise<Appointment | undefined>;
  updateCalendarEventId(id: number, calendarEventId: string): Promise<Appointment | undefined>;
  confirmDepositReturn(id: number): Promise<Appointment | undefined>;
  deleteAppointment(id: number): Promise<boolean>;
  
  // Client operations
  getClients(filters?: {
    search?: string;
    status?: string;
    marketingChannel?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ clients: Client[]; total: number }>;
  getClient(id: number): Promise<Client | undefined>;
  getClientByEmail(email: string): Promise<Client | undefined>;
  getClientByPhone(phone: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<boolean>;
  getClientAppointments(clientId: number): Promise<Appointment[]>;
  updateClientMetrics(clientId: number): Promise<void>;
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }
  
  async createUser(
    insertUser: InsertUser & { invitePending?: boolean },
  ): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUserTotp(
    id: number,
    data: {
      totpSecret?: string | null;
      totpEnabled?: boolean;
      totpRecoveryCodes?: string[] | null;
    },
  ): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async updateUserPassword(
    id: number,
    passwordHash: string,
    options?: { clearInvitePending?: boolean },
  ): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({
        password: passwordHash,
        ...(options?.clearInvitePending ? { invitePending: false } : {}),
      })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }
  
  // Provider methods
  async getProviders(): Promise<Provider[]> {
    return await db.select().from(providers).where(eq(providers.isArchived, false));
  }
  
  async getProvider(id: number): Promise<Provider | undefined> {
    const result = await db.select().from(providers).where(eq(providers.id, id));
    return result[0];
  }
  
  async getProviderByEmail(email: string): Promise<Provider | undefined> {
    const result = await db.select().from(providers).where(eq(providers.email, email));
    return result[0];
  }
  
  async listProviders(filters?: {
    search?: string;
    department?: string;
    status?: string;
    archived?: boolean;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ providers: Provider[]; total: number }> {
    let conditions: any[] = [];
    
    // Apply filters
    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          like(providers.firstName, searchTerm),
          like(providers.lastName, searchTerm),
          like(providers.email, searchTerm),
          like(providers.phone, searchTerm),
          like(providers.bio, searchTerm)
        )
      );
    }
    
    if (filters?.department) {
      conditions.push(eq(providers.department, filters.department));
    }
    
    if (filters?.status) {
      conditions.push(eq(providers.status, filters.status));
    }
    
    if (filters?.archived !== undefined) {
      conditions.push(eq(providers.isArchived, filters.archived));
    } else {
      conditions.push(eq(providers.isArchived, false));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(providers)
      .where(whereClause);
    
    const total = countResult[0]?.count || 0;
    
    // Get paginated results
    let query = db.select().from(providers).where(whereClause);
    
    // Apply sorting
    if (filters?.sortBy) {
      const column = providers[filters.sortBy as keyof typeof providers];
      if (column) {
        query = filters.sortOrder === 'desc' ? query.orderBy(desc(column)) : query.orderBy(asc(column));
      }
    } else {
      query = query.orderBy(asc(providers.lastName), asc(providers.firstName));
    }
    
    // Apply pagination
    if (filters?.limit && filters?.offset !== undefined) {
      query = query.limit(filters.limit).offset(filters.offset);
    } else if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    const providersList = await query;
    
    return { providers: providersList, total };
  }
  
  async createProvider(provider: InsertProvider): Promise<Provider> {
    // Set the display name for backward compatibility
    const displayName = provider.preferredName || `${provider.firstName} ${provider.lastName}`;
    
    const result = await db.insert(providers).values({
      ...provider,
      name: displayName,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    // Create audit log
    await this.createAuditLog({
      entity: 'provider',
      entityId: result[0].id,
      action: 'CREATE',
      metadata: { provider: result[0] }
    });
    
    return result[0];
  }
  
  async updateProvider(id: number, provider: Partial<InsertProvider>): Promise<Provider | undefined> {
    const existing = await this.getProvider(id);
    if (!existing) return undefined;
    
    // Update display name if names changed
    let displayName = existing.name;
    if (provider.firstName || provider.lastName || provider.preferredName) {
      const firstName = provider.firstName || existing.firstName;
      const lastName = provider.lastName || existing.lastName;
      const preferredName = provider.preferredName || existing.preferredName;
      displayName = preferredName || `${firstName} ${lastName}`;
    }
    
    const result = await db
      .update(providers)
      .set({
        ...provider,
        name: displayName,
        updatedAt: new Date()
      })
      .where(eq(providers.id, id))
      .returning();
    
    // Create audit log
    await this.createAuditLog({
      entity: 'provider',
      entityId: id,
      action: 'UPDATE',
      diff: { before: existing, after: result[0] }
    });
    
    return result[0];
  }
  
  async archiveProvider(id: number, userId?: number): Promise<Provider | undefined> {
    const result = await db
      .update(providers)
      .set({
        isArchived: true,
        status: 'TERMINATED',
        endDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(providers.id, id))
      .returning();
    
    if (result[0]) {
      await this.createAuditLog({
        entity: 'provider',
        entityId: id,
        action: 'ARCHIVE',
        actorUserId: userId
      });
    }
    
    return result[0];
  }
  
  async unarchiveProvider(id: number, userId?: number): Promise<Provider | undefined> {
    const result = await db
      .update(providers)
      .set({
        isArchived: false,
        status: 'ACTIVE',
        endDate: null,
        updatedAt: new Date()
      })
      .where(eq(providers.id, id))
      .returning();
    
    if (result[0]) {
      await this.createAuditLog({
        entity: 'provider',
        entityId: id,
        action: 'UNARCHIVE',
        actorUserId: userId
      });
    }
    
    return result[0];
  }
  
  async deleteProvider(id: number): Promise<boolean> {
    // Only allow deletion if archived
    const provider = await this.getProvider(id);
    if (!provider || !provider.isArchived) {
      return false;
    }
    
    const result = await db.delete(providers).where(eq(providers.id, id)).returning();
    
    if (result.length > 0) {
      await this.createAuditLog({
        entity: 'provider',
        entityId: id,
        action: 'DELETE',
        metadata: { deletedProvider: provider }
      });
    }
    
    return result.length > 0;
  }
  
  // Provider Credentials methods
  async getProviderCredentials(providerId: number): Promise<ProviderCredentials[]> {
    return await db
      .select()
      .from(providerCredentials)
      .where(eq(providerCredentials.providerId, providerId));
  }
  
  async createProviderCredentials(credentials: InsertProviderCredentials): Promise<ProviderCredentials> {
    const result = await db.insert(providerCredentials).values({
      ...credentials,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    await this.createAuditLog({
      entity: 'provider_credentials',
      entityId: result[0].id,
      action: 'CREATE',
      metadata: { providerId: credentials.providerId }
    });
    
    return result[0];
  }
  
  async updateProviderCredentials(id: number, credentials: Partial<InsertProviderCredentials>): Promise<ProviderCredentials | undefined> {
    const result = await db
      .update(providerCredentials)
      .set({
        ...credentials,
        updatedAt: new Date()
      })
      .where(eq(providerCredentials.id, id))
      .returning();
    
    if (result[0]) {
      await this.createAuditLog({
        entity: 'provider_credentials',
        entityId: id,
        action: 'UPDATE'
      });
    }
    
    return result[0];
  }
  
  async deleteProviderCredentials(id: number): Promise<boolean> {
    const result = await db.delete(providerCredentials).where(eq(providerCredentials.id, id)).returning();
    
    if (result.length > 0) {
      await this.createAuditLog({
        entity: 'provider_credentials',
        entityId: id,
        action: 'DELETE'
      });
    }
    
    return result.length > 0;
  }
  
  // Provider Compensation methods
  async getProviderCompensation(providerId: number): Promise<ProviderCompensation[]> {
    return await db
      .select()
      .from(providerCompensation)
      .where(eq(providerCompensation.providerId, providerId))
      .orderBy(desc(providerCompensation.effectiveDate));
  }
  
  async getCurrentProviderCompensation(providerId: number): Promise<ProviderCompensation | undefined> {
    const result = await db
      .select()
      .from(providerCompensation)
      .where(
        and(
          eq(providerCompensation.providerId, providerId),
          or(
            eq(providerCompensation.endDate, null),
            sql`${providerCompensation.endDate} > NOW()`
          )
        )
      )
      .orderBy(desc(providerCompensation.effectiveDate))
      .limit(1);
    
    return result[0];
  }
  
  async createProviderCompensation(compensation: InsertProviderCompensation): Promise<ProviderCompensation> {
    const result = await db.insert(providerCompensation).values({
      ...compensation,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    await this.createAuditLog({
      entity: 'provider_compensation',
      entityId: result[0].id,
      action: 'CREATE',
      metadata: { providerId: compensation.providerId }
    });
    
    return result[0];
  }
  
  async updateProviderCompensation(id: number, compensation: Partial<InsertProviderCompensation>): Promise<ProviderCompensation | undefined> {
    const result = await db
      .update(providerCompensation)
      .set({
        ...compensation,
        updatedAt: new Date()
      })
      .where(eq(providerCompensation.id, id))
      .returning();
    
    if (result[0]) {
      await this.createAuditLog({
        entity: 'provider_compensation',
        entityId: id,
        action: 'UPDATE'
      });
    }
    
    return result[0];
  }
  
  async deleteProviderCompensation(id: number): Promise<boolean> {
    const result = await db.delete(providerCompensation).where(eq(providerCompensation.id, id)).returning();
    
    if (result.length > 0) {
      await this.createAuditLog({
        entity: 'provider_compensation',
        entityId: id,
        action: 'DELETE'
      });
    }
    
    return result.length > 0;
  }
  
  // Provider Contacts methods
  async getProviderContacts(providerId: number): Promise<ProviderContacts[]> {
    return await db
      .select()
      .from(providerContacts)
      .where(eq(providerContacts.providerId, providerId))
      .orderBy(desc(providerContacts.isPrimary));
  }
  
  async createProviderContact(contact: InsertProviderContacts): Promise<ProviderContacts> {
    const result = await db.insert(providerContacts).values({
      ...contact,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    await this.createAuditLog({
      entity: 'provider_contacts',
      entityId: result[0].id,
      action: 'CREATE',
      metadata: { providerId: contact.providerId }
    });
    
    return result[0];
  }
  
  async updateProviderContact(id: number, contact: Partial<InsertProviderContacts>): Promise<ProviderContacts | undefined> {
    const result = await db
      .update(providerContacts)
      .set({
        ...contact,
        updatedAt: new Date()
      })
      .where(eq(providerContacts.id, id))
      .returning();
    
    if (result[0]) {
      await this.createAuditLog({
        entity: 'provider_contacts',
        entityId: id,
        action: 'UPDATE'
      });
    }
    
    return result[0];
  }
  
  async deleteProviderContact(id: number): Promise<boolean> {
    const result = await db.delete(providerContacts).where(eq(providerContacts.id, id)).returning();
    
    if (result.length > 0) {
      await this.createAuditLog({
        entity: 'provider_contacts',
        entityId: id,
        action: 'DELETE'
      });
    }
    
    return result.length > 0;
  }
  
  // Provider Documents methods
  async getProviderDocuments(providerId: number): Promise<ProviderDocuments[]> {
    return await db
      .select()
      .from(providerDocuments)
      .where(eq(providerDocuments.providerId, providerId))
      .orderBy(desc(providerDocuments.uploadedAt));
  }
  
  async createProviderDocument(document: InsertProviderDocuments): Promise<ProviderDocuments> {
    const result = await db.insert(providerDocuments).values({
      ...document,
      uploadedAt: new Date(),
      createdAt: new Date()
    }).returning();
    
    await this.createAuditLog({
      entity: 'provider_documents',
      entityId: result[0].id,
      action: 'CREATE',
      metadata: { providerId: document.providerId, fileName: document.fileName }
    });
    
    return result[0];
  }
  
  async deleteProviderDocument(id: number): Promise<boolean> {
    const doc = await db.select().from(providerDocuments).where(eq(providerDocuments.id, id));
    
    if (doc.length === 0) return false;
    
    const result = await db.delete(providerDocuments).where(eq(providerDocuments.id, id)).returning();
    
    if (result.length > 0) {
      await this.createAuditLog({
        entity: 'provider_documents',
        entityId: id,
        action: 'DELETE',
        metadata: { deletedDocument: doc[0] }
      });
    }
    
    return result.length > 0;
  }
  
  // Audit Log methods
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values({
      ...log,
      createdAt: new Date()
    }).returning();
    
    return result[0];
  }
  
  async getAuditLogs(entity: string, entityId: number): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entity, entity),
          eq(auditLogs.entityId, entityId)
        )
      )
      .orderBy(desc(auditLogs.createdAt));
  }
  
  // Appointment methods
  async getAppointments(): Promise<Appointment[]> {
    return await db.select().from(appointments);
  }
  
  async getAppointment(id: number): Promise<Appointment | undefined> {
    const result = await db.select().from(appointments).where(eq(appointments.id, id));
    return result[0];
  }
  
  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const financials = computeAppointmentFinancials(insertAppointment);
    const now = new Date();

    const result = await db.insert(appointments).values({
      ...insertAppointment,
      totalDirectCosts: financials.totalDirectCosts,
      providerBalanceDue: financials.providerBalanceDue,
      totalClientCollections: financials.totalClientCollections,
      excessCollections: financials.excessCollections,
      uncollectedContractBalance: financials.uncollectedContractBalance,
      recognizedRevenue: financials.recognizedRevenue,
      deferredRevenue: financials.deferredRevenue,
      realizedRevenue: financials.realizedRevenue,
      createdAt: now,
      updatedAt: now,
    }).returning();

    const created = result[0];
    if (created?.clientId) {
      await this.updateClientMetrics(created.clientId);
    }
    return created;
  }
  
  /**
   * Update the calendar event ID for an appointment
   */
  async updateCalendarEventId(id: number, calendarEventId: string): Promise<Appointment | undefined> {
    const result = await db.update(appointments)
      .set({
        calendarEventId,
        updatedAt: new Date()
      })
      .where(eq(appointments.id, id))
      .returning();
    
    return result[0];
  }

  async confirmDepositReturn(id: number): Promise<Appointment | undefined> {
    // First get the current appointment to ensure we have the deposit amount
    const appointment = await this.getAppointment(id);
    if (!appointment) {
      return undefined;
    }

    // If no deposit return amount is set, default to full deposit return
    // Use deposit amount as the default return amount if depositRefundedToClient is null or 0
    const depositRefundedToClient = (appointment.depositRefundedToClient && appointment.depositRefundedToClient > 0) 
      ? appointment.depositRefundedToClient 
      : (appointment.clientDeposit ?? 0);

    // updateAppointment refreshes client metrics after the write
    return this.updateAppointment(id, {
      depositReturned: true,
      depositRefundedToClient: depositRefundedToClient,
      dispositionStatus: 'Cancel' // Ensure it's marked as cancelled
    });
  }
  
  async updateAppointment(id: number, updateData: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    // Get the current appointment
    const currentAppointment = await this.getAppointment(id);
    
    if (!currentAppointment) {
      return undefined;
    }
    
    // Handle reschedule occurrences
    let rescheduleOccurrences = currentAppointment.rescheduleOccurrences || 0;
    
    // Increment if status changes to "Reschedule" for the first time
    if (updateData.dispositionStatus === 'Reschedule' && currentAppointment.dispositionStatus !== 'Reschedule') {
      rescheduleOccurrences += 1;
    }
    // Also increment if already in "Reschedule" status and dates/times are being updated
    else if (currentAppointment.dispositionStatus === 'Reschedule' && 
             (updateData.updatedStartDate || updateData.updatedStartTime || 
              updateData.updatedEndDate || updateData.updatedEndTime)) {
      rescheduleOccurrences += 1;
    }
    
    const mergedAppointment: Appointment = {
      ...currentAppointment,
      ...updateData,
      rescheduleOccurrences,
    };

    const financials = computeAppointmentFinancials(mergedAppointment);

    const result = await db.update(appointments)
      .set({
        ...updateData,
        totalDirectCosts: financials.totalDirectCosts,
        providerBalanceDue: financials.providerBalanceDue,
        totalClientCollections: financials.totalClientCollections,
        excessCollections: financials.excessCollections,
        uncollectedContractBalance: financials.uncollectedContractBalance,
        recognizedRevenue: financials.recognizedRevenue,
        deferredRevenue: financials.deferredRevenue,
        realizedRevenue: financials.realizedRevenue,
        rescheduleOccurrences,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();

    const updated = result[0];
    if (updated) {
      const previousClientId = currentAppointment.clientId;
      const nextClientId = updated.clientId;
      if (previousClientId) {
        await this.updateClientMetrics(previousClientId);
      }
      if (nextClientId && nextClientId !== previousClientId) {
        await this.updateClientMetrics(nextClientId);
      }
    }
    
    return updated;
  }
  
  async deleteAppointment(id: number): Promise<boolean> {
    const existing = await this.getAppointment(id);
    const result = await db.delete(appointments).where(eq(appointments.id, id)).returning();
    const deleted = result.length > 0;
    if (deleted && existing?.clientId) {
      await this.updateClientMetrics(existing.clientId);
    }
    return deleted;
  }
  
  // Client methods
  async getClients(filters?: {
    search?: string;
    status?: string;
    marketingChannel?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ clients: Client[]; total: number }> {
    const { or, and, like, sql } = await import("drizzle-orm");
    
    let conditions: any[] = [];
    
    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          like(clients.name, searchTerm),
          like(clients.email, searchTerm),
          like(clients.phoneNumber, searchTerm),
          like(clients.internalNotes, searchTerm)
        )
      );
    }
    
    if (filters?.status && filters.status !== '') {
      conditions.push(eq(clients.status, filters.status));
    }
    
    if (filters?.marketingChannel && filters.marketingChannel !== '') {
      conditions.push(eq(clients.marketingChannel, filters.marketingChannel));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients)
      .where(whereClause);
    
    const total = countResult[0]?.count || 0;
    
    // Get paginated results
    let query = db.select().from(clients).where(whereClause);
    
    if (filters?.limit && filters?.offset !== undefined) {
      query = query.limit(filters.limit).offset(filters.offset);
    } else if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    const clientsList = await query;
    
    return { clients: clientsList, total };
  }
  
  async getClient(id: number): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.id, id));
    return result[0];
  }
  
  async getClientByEmail(email: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.email, email));
    return result[0];
  }
  
  async getClientByPhone(phone: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.phoneNumber, phone));
    return result[0];
  }
  
  async createClient(client: InsertClient): Promise<Client> {
    const result = await db.insert(clients).values(client).returning();
    return result[0];
  }
  
  async updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined> {
    const result = await db
      .update(clients)
      .set({
        ...client,
        updatedAt: new Date()
      })
      .where(eq(clients.id, id))
      .returning();
    
    return result[0];
  }
  
  async deleteClient(id: number): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id)).returning();
    return result.length > 0;
  }
  
  async getClientAppointments(clientId: number): Promise<Appointment[]> {
    return await db
      .select()
      .from(appointments)
      .where(eq(appointments.clientId, clientId));
  }
  
  async updateClientMetrics(clientId: number): Promise<void> {
    const clientAppointments = await this.getClientAppointments(clientId);
    
    // Lifetime GCC = sum of each appointment's gross cash contribution (all statuses)
    let lifetimeGrossCashCollections = 0;
    let appointmentCount = 0;
    let lastAppointmentDate: Date | null = null;
    
    for (const appointment of clientAppointments) {
      const f = computeAppointmentFinancials(appointment);
      lifetimeGrossCashCollections += f.grossCashCollectionsContribution;
      appointmentCount++;

      // Prefer rescheduled schedule date when present
      const scheduleDateStr = appointment.updatedStartDate || appointment.startDate;
      if (scheduleDateStr) {
        const scheduleDate = new Date(scheduleDateStr);
        if (!Number.isNaN(scheduleDate.getTime())) {
          if (!lastAppointmentDate || scheduleDate > lastAppointmentDate) {
            lastAppointmentDate = scheduleDate;
          }
        }
      }
    }
    
    await db
      .update(clients)
      .set({
        lifetimeGrossCashCollections,
        appointmentCount,
        lastAppointmentDate,
        updatedAt: new Date()
      })
      .where(eq(clients.id, clientId));
  }
  
  // Initialize default data if needed
  async initializeDefaultProviders(): Promise<void> {
    const existingProviders = await this.getProviders();
    
    if (existingProviders.length === 0) {
      const defaultProviders = [
        { name: 'Sera', active: true },
        { name: 'Courtesan Couple', active: true },
        { name: 'Chloe', active: true },
        { name: 'Alexa', active: true },
        { name: 'Frenchie', active: true },
        { name: 'Lilly', active: true },
        { name: 'Natalie Nixon', active: true }
      ];
      
      for (const provider of defaultProviders) {
        await this.createProvider(provider.name, provider.active);
      }
    }
  }
}

export const storage = new DatabaseStorage();
