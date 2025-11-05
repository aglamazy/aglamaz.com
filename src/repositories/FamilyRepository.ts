import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '../firebase/admin';
import type { IMember } from '@/entities/Member';
import { adminNotificationService } from '@/services/AdminNotificationService';
import {
  MemberRepository,
  type MemberQueryOptions,
  type MemberRecord,
  type LocalizedMemberRecord,
} from './MemberRepository';
import { SiteRepository } from './SiteRepository';
import type { ISite } from '@/entities/Site';

export type InviteStatus = 'pending' | 'used' | 'expired' | 'revoked';

export class InviteError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'InviteError';
  }
}

export type FamilyMember = LocalizedMemberRecord;
export type FamilySite = ISite;

export interface SignupRequest {
  id: string;
  firstName: string;
  email: string;
  siteId: string;
  site_id?: string; // Alternative field name for compatibility
  userId?: string; // Optional until verified
  status: 'pending_verification' | 'pending' | 'approved' | 'rejected';
  verificationToken?: string;
  expiresAt?: Date;
  email_verified?: boolean; // Track if email was successfully sent
  createdAt: Timestamp;
  updatedAt: Timestamp;
  verifiedAt?: Timestamp;
  approvedAt?: Timestamp;
  approvedBy?: string;
  rejectedAt?: Timestamp;
  rejectedBy?: string;
  rejectionReason?: string;
  source?: 'signup' | 'invite';
  inviteToken?: string;
  invitationId?: string;
  invitedBy?: string;
  invitedAt?: Timestamp;
  language?: string;
}

export interface SiteInvite {
  id: string;
  token: string;
  siteId: string;
  inviterId?: string;
  inviterEmail?: string;
  inviterName?: string;
  status: InviteStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt: Timestamp;
  usedAt?: Timestamp;
  usedBy?: string;
  usedByEmail?: string;
}

export class FamilyRepository {
  private readonly signupRequestsCollection = 'signupRequests';
  private readonly invitesCollection = 'invites';

  constructor(
    private readonly members = new MemberRepository(),
    private readonly sites = new SiteRepository(),
  ) {}

  private isTimestamp(value: unknown): value is Timestamp {
    return value instanceof Timestamp ||
      (typeof value === 'object' && value !== null && 'toMillis' in value && typeof (value as any).toMillis === 'function');
  }

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  getTimestamp() {
    return Timestamp.now();
  }

  // Site Management
  async getSite(siteId: string): Promise<FamilySite | null> {
    try {
      return await this.sites.get(siteId);
    } catch (error) {
      console.error('Error getting site:', error);
      throw new Error('Failed to get site');
    }
  }

  // Member Management
  async getMemberById(memberId: string, opts?: MemberQueryOptions): Promise<FamilyMember | null> {
    try {
      return await this.members.getById(memberId, opts);
    } catch (error) {
      console.error('Error getting member by id:', error);
      throw new Error('Failed to get member by id');
    }
  }

  async getMemberByUserId(userId: string, siteId: string, opts?: MemberQueryOptions): Promise<FamilyMember | null> {
    try {
      return await this.members.getByUid(siteId, userId, opts);
    } catch (error) {
      console.error('Error getting member by user ID:', error);
      throw new Error('Failed to get member');
    }
  }

  async getSiteMembers(siteId: string, opts?: MemberQueryOptions): Promise<FamilyMember[]> {
    try {
      return await this.members.listActiveMembers(siteId, opts);
    } catch (error) {
      console.error('Error getting site members:', error);
      throw new Error('Failed to get site members');
    }
  }

  async getPendingMembers(siteId: string, opts?: MemberQueryOptions): Promise<FamilyMember[]> {
    try {
      return await this.members.listPendingMembers(siteId, opts);
    } catch (error) {
      console.error('Error getting pending members:', error);
      throw new Error('Failed to get pending members');
    }
  }

  async createMember(memberData: Partial<IMember>): Promise<MemberRecord> {
    try {
      return await this.members.create(memberData as Partial<MemberRecord>);
    } catch (error) {
      console.error('Error creating member:', error);
      throw new Error('Failed to create member');
    }
  }

  async updateMember(memberId: string, updates: Partial<FamilyMember>): Promise<void> {
    try {
      await this.members.update(memberId, updates as Partial<MemberRecord>);
    } catch (error) {
      console.error('Error updating member:', error);
      throw new Error('Failed to update member');
    }
  }

  async deleteMember(memberId: string): Promise<void> {
    try {
      await this.members.delete(memberId);
    } catch (error) {
      console.error('Error deleting member:', error);
      throw new Error('Failed to delete member');
    }
  }

  async approveMember(memberId: string, approvedBy: string): Promise<void> {
    try {
      await this.members.approve(memberId, approvedBy);
    } catch (error) {
      console.error('Error approving member:', error);
      throw new Error('Failed to approve member');
    }
  }

  async rejectMember(memberId: string, rejectedBy: string, reason?: string): Promise<void> {
    try {
      await this.members.reject(memberId, rejectedBy, reason);
    } catch (error) {
      console.error('Error rejecting member:', error);
      throw new Error('Failed to reject member');
    }
  }

  // Invite Management
  async createInvite(siteId: string, inviter?: { id?: string; email?: string; name?: string }): Promise<SiteInvite> {
    try {
      const db = this.getDb();
      const { randomUUID } = require('crypto');
      const token = randomUUID();
      const now = Timestamp.now();
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

      const inviteData = {
        token,
        siteId,
        inviterId: inviter?.id || null,
        inviterEmail: inviter?.email || null,
        inviterName: inviter?.name || null,
        status: 'pending' as InviteStatus,
        createdAt: now,
        updatedAt: now,
        expiresAt,
      };

      const docRef = db.collection(this.invitesCollection).doc(token);
      await docRef.set(inviteData);
      const doc = await docRef.get();
      return { id: doc.id, ...(doc.data() as SiteInvite) };
    } catch (error) {
      console.error('Error creating invite:', error);
      throw new Error('Failed to create invite');
    }
  }

  async getInviteByToken(token: string): Promise<SiteInvite | null> {
    try {
      const db = this.getDb();
      const ref = db.collection(this.invitesCollection).doc(token);
      const doc = await ref.get();
      if (!doc.exists) return null;

      const invite = { id: doc.id, ...(doc.data() as SiteInvite) };
      const now = Timestamp.now();
      if (invite.status === 'pending' && this.isTimestamp(invite.expiresAt) && invite.expiresAt.toMillis() <= now.toMillis()) {
        await ref.update({ status: 'expired', updatedAt: now });
        invite.status = 'expired';
        invite.updatedAt = now;
      }
      return invite;
    } catch (error) {
      console.error('Error getting invite by token:', error);
      throw new Error('Failed to get invite');
    }
  }

  async acceptInvite(token: string, user: { uid: string; siteId: string; email: string; displayName?: string; firstName?: string }): Promise<IMember> {
    const db = this.getDb();
    const inviteRef = db.collection(this.invitesCollection).doc(token);
    const now = Timestamp.now();

    try {
      console.info('[invite][repo] acceptInvite start', {
        token,
        userId: user.uid,
        siteId: user.siteId,
        email: user.email,
      });
      return await db.runTransaction(async (tx) => {
        const inviteSnap = await tx.get(inviteRef);
        if (!inviteSnap.exists) {
          throw new InviteError('invite/not-found', 'Invite not found');
        }
        const invite = { id: inviteSnap.id, ...(inviteSnap.data() as SiteInvite) };
        if (invite.siteId !== user.siteId) {
          throw new InviteError('invite/wrong-site', 'Invite does not belong to this site');
        }
        if (invite.status === 'pending' && this.isTimestamp(invite.expiresAt) && invite.expiresAt.toMillis() <= now.toMillis()) {
          tx.update(inviteRef, { status: 'expired', updatedAt: now });
          throw new InviteError('invite/expired', 'Invite has expired');
        }
        if (invite.status === 'expired') {
          throw new InviteError('invite/expired', 'Invite has expired');
        }
        if (invite.status === 'revoked') {
          throw new InviteError('invite/revoked', 'Invite has been revoked');
        }

        let existingMember = await this.members.findByUidForUpdate(tx, invite.siteId, user.uid);

        if (existingMember) {
          console.info('[invite][repo] found member by uid', {
            token,
            memberId: existingMember.id,
          });
        }

        if (!existingMember && user.email) {
          const existingByEmail = await this.members.findByEmailForUpdate(tx, invite.siteId, user.email);
          if (existingByEmail) {
            existingMember = existingByEmail;
            console.info('[invite][repo] found member by email', {
              token,
              memberId: existingByEmail.id,
            });
          }
        }

        if (existingMember) {
          const current = existingMember.data;
          const updates: Partial<MemberRecord> = {};
          if (!current.uid) updates.uid = user.uid;
          if (current.email !== user.email && user.email) updates.email = user.email;
          const displayCandidate = user.displayName || user.firstName || user.email;
          if (!current.displayName && displayCandidate) updates.displayName = displayCandidate;
          if (!current.firstName && displayCandidate) updates.firstName = displayCandidate;
          if (current.role === 'pending') updates.role = 'member';

          this.members.txUpdate(tx, existingMember.id, updates, { updatedAt: now });
          tx.update(inviteRef, {
            lastUsedAt: now,
            lastUsedBy: user.uid,
            lastUsedByEmail: user.email,
            updatedAt: now,
          });

          console.info('[invite][repo] updated existing member', {
            token,
            memberId: existingMember.id,
            updates,
          });

          return { ...current, ...updates, id: existingMember.id, updatedAt: now } as IMember;
        }

        if (!user.email) {
          throw new InviteError('invite/missing-email', 'User email is required');
        }

        const memberDoc: Partial<MemberRecord> = {
          uid: user.uid,
          siteId: invite.siteId,
          role: 'member',
          displayName: user.displayName || user.firstName || user.email,
          firstName: user.firstName || user.displayName || user.email,
          email: user.email,
        };

        const created = this.members.txCreate(tx, memberDoc, { timestamp: now });

        tx.update(inviteRef, {
          lastUsedAt: now,
          lastUsedBy: user.uid,
          lastUsedByEmail: user.email,
          updatedAt: now,
        });

        console.info('[invite][repo] created new member from invite', {
          token,
          memberId: created.id,
        });

        return created.data as IMember;
      });
    } catch (error) {
      if (error instanceof InviteError) {
        console.warn('[invite][repo] invite error', {
          token,
          code: error.code,
          message: error.message,
        });
        throw error;
      }
      console.error('[invite][repo] unexpected error accepting invite', { token }, error);
      throw new Error('Failed to accept invite');
    }
  }

  // Signup Request Management
  async createSignupRequest(requestData: Omit<SignupRequest, 'id' | 'createdAt' | 'updatedAt'>, siteUrl?: string): Promise<SignupRequest> {
    try {
      const db = this.getDb();
      const now = Timestamp.now();
      
      // Create deterministic document ID based on email + siteId
      const emailKey = requestData.email.toLowerCase().trim();
      const documentKey = `${emailKey}_${requestData.siteId}`;
      
      // Hash the key to create a safe document ID
      const crypto = require('crypto');
      const documentId = crypto.createHash('sha256').update(documentKey).digest('hex');
      
      // Use setDoc with merge to ensure idempotency
      const requestRef = db.collection(this.signupRequestsCollection).doc(documentId);
      const payload: Record<string, unknown> = {
        ...requestData,
        email: emailKey, // Store normalized email
        email_verified: requestData.email_verified ?? false,
        createdAt: now,
        updatedAt: now,
      };

      if (requestData.source === 'invite' && !requestData.invitedAt) {
        payload.invitedAt = now;
      }

      await requestRef.set(payload, { merge: true });

      if (requestData.source !== 'invite') {
        await adminNotificationService.notify('pending_member', requestData, siteUrl);
      }

      return {
        id: documentId,
        ...(payload as Record<string, unknown>),
      } as SignupRequest;
    } catch (error) {
      console.error('Error creating signup request:', error);
      throw new Error('Failed to create signup request');
    }
  }

  async getPendingSignupRequests(siteId: string): Promise<SignupRequest[]> {
    try {
      const db = this.getDb();
      const querySnapshot = await db.collection(this.signupRequestsCollection)
        .where('siteId', '==', siteId)
        .where('status', 'in', ['pending', 'pending_verification'])
        .orderBy('createdAt', 'asc')
        .get();
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SignupRequest[];
    } catch (error) {
      console.error('Error getting pending signup requests:', error);
      throw new Error('Failed to get pending signup requests');
    }
  }

  async verifySignupRequest(verificationToken: string, userId?: string): Promise<SignupRequest> {
    try {
      const db = this.getDb();
      const querySnapshot = await db.collection(this.signupRequestsCollection)
        .where('verificationToken', '==', verificationToken)
        .where('status', '==', 'pending_verification')
        .get();
      
      if (querySnapshot.empty) {
        throw new Error('Invalid or expired verification token');
      }

      const requestDoc = querySnapshot.docs[0];
      const request = requestDoc.data() as SignupRequest;

      // Check if token is expired
      if (request.expiresAt && new Date(request.expiresAt) < new Date()) {
        throw new Error('Verification token has expired');
      }

      // If userId is provided, complete the verification
      if (userId) {
        await db.collection(this.signupRequestsCollection).doc(requestDoc.id).update({
          status: 'pending',
          userId,
          verifiedAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });

        return {
          id: requestDoc.id,
          ...request,
          status: 'pending',
          userId,
          verifiedAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
      }

      // Just return the request data for initial verification
      return {
        id: requestDoc.id,
        ...request
      };
    } catch (error) {
      console.error('Error verifying signup request:', error);
      throw new Error('Failed to verify signup request');
    }
  }

  async getSignupRequestById(id: string): Promise<SignupRequest | null> {
    const db = this.getDb();
    const doc = await db.collection(this.signupRequestsCollection).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as SignupRequest;
  }

  async markSignupRequestApproved(id: string): Promise<void> {
    const db = this.getDb();
    await db.collection(this.signupRequestsCollection).doc(id).update({
      status: 'approved',
      verificationToken: null,
      expiresAt: null,
      updatedAt: Timestamp.now(),
    });
  }

  async markSignupRequestRejected(id: string): Promise<void> {
    const db = this.getDb();
    await db.collection(this.signupRequestsCollection).doc(id).update({
      status: 'rejected',
      verificationToken: null,
      expiresAt: null,
      updatedAt: this.getTimestamp(),
    });
  }

  // Batch Operations
  async processSignupRequest(requestId: string, approvedBy: string, approve: boolean, reason?: string, rejectedBy?: string): Promise<void> {
    try {
      const db = this.getDb();
      await db.runTransaction(async (tx) => {
        const requestRef = db.collection(this.signupRequestsCollection).doc(requestId);
        const requestDoc = await tx.get(requestRef);

        if (!requestDoc.exists) {
          throw new Error('Signup request not found');
        }

        const request = requestDoc.data() as SignupRequest;
        const now = Timestamp.now();

        if (approve) {
          tx.update(requestRef, {
            status: 'approved',
            approvedAt: now,
            approvedBy,
            updatedAt: now,
          });

          const memberDoc: Partial<MemberRecord> = {
            uid: request.userId || '',
            userId: request.userId || '',
            siteId: request.siteId,
            role: 'member',
            firstName: request.firstName || '',
            displayName: request.firstName || request.email || '',
            email: request.email,
            approvedAt: now,
            approvedBy,
          };

          this.members.txCreate(tx, memberDoc, { timestamp: now });
        } else {
          tx.update(requestRef, {
            status: 'rejected',
            rejectedAt: now,
            rejectedBy: rejectedBy ?? approvedBy,
            rejectionReason: reason,
            updatedAt: now,
          });
        }
      });
    } catch (error) {
      console.error('Error processing signup request:', error);
      throw new Error('Failed to process signup request');
    }
  }

  // Utility Methods
  async isUserMember(userId: string, siteId: string): Promise<boolean> {
    try {
      return await this.members.isUserMember(userId, siteId);
    } catch (error) {
      console.error('Error checking if user is member:', error);
      return false;
    }
  }

  async isUserAdmin(userId: string, siteId: string): Promise<boolean> {
    try {
      return await this.members.isUserAdmin(userId, siteId);
    } catch (error) {
      console.error('Error checking if user is admin:', error);
      return false;
    }
  }

  // Member prefs
  async setMemberBlogEnabled(userId: string, siteId: string, enabled: boolean): Promise<void> {
    try {
      await this.members.setBlogEnabled(userId, siteId, enabled);
    } catch (error) {
      console.error('Error updating member blogEnabled:', error);
      throw new Error('Failed to update member');
    }
  }

  async getMembersWithBlog(siteId: string): Promise<FamilyMember[]> {
    try {
      return await this.members.listMembersWithBlog(siteId);
    } catch (e) {
      console.error('Error getMembersWithBlog', e);
      throw new Error('Failed to fetch members with blog');
    }
  }

  async getMemberByHandle(handle: string, siteId: string): Promise<FamilyMember | null> {
    try {
      return await this.members.getByHandle(handle, siteId);
    } catch (e) {
      console.error('Error getMemberByHandle', e);
      throw new Error('Failed to get member by handle');
    }
  }

  async isUserPending(userId: string, siteId: string): Promise<boolean> {
    try {
      return await this.members.isUserPending(userId, siteId);
    } catch (error) {
      console.error('Error checking if user is pending:', error);
      return false;
    }
  }

  async getSignupRequestByUserId(userId: string, siteId: string): Promise<SignupRequest | null> {
    try {
      const db = this.getDb();
      const querySnapshot = await db.collection(this.signupRequestsCollection)
        .where('userId', '==', userId)
        .where('siteId', '==', siteId)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as SignupRequest;
    } catch (error) {
      console.error('Error getting signup request by user ID:', error);
      throw new Error('Failed to get signup request by user ID');
    }
  }

  async getSignupRequestByEmail(email: string, siteId: string): Promise<SignupRequest | null> {
    try {
      const db = this.getDb();
      
      // Create the same deterministic document ID
      const emailKey = email.toLowerCase().trim();
      const documentKey = `${emailKey}_${siteId}`;
      const crypto = require('crypto');
      const documentId = crypto.createHash('sha256').update(documentKey).digest('hex');
      
      const requestDoc = await db.collection(this.signupRequestsCollection).doc(documentId).get();
      
      if (!requestDoc.exists) {
        return null;
      }

      return {
        id: requestDoc.id,
        ...requestDoc.data()
      } as SignupRequest;
    } catch (error) {
      console.error('Error getting signup request by email:', error);
      throw new Error('Failed to get signup request by email');
    }
  }

  async updateSignupRequestEmailVerified(documentId: string): Promise<void> {
    try {
      const db = this.getDb();
      await db.collection(this.signupRequestsCollection).doc(documentId).update({
        email_verified: true,
        updatedAt: this.getTimestamp()
      });
    } catch (error) {
      console.error('Error updating signup request email verified:', error);
      throw new Error('Failed to update signup request email verified');
    }
  }
}

// Export singleton instance
export const familyRepository = new FamilyRepository(); 
