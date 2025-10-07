import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import {initAdmin} from '../firebase/admin';
import type {IMember} from '@/entities/Member';
import {adminNotificationService} from '@/services/AdminNotificationService';

export type InviteStatus = 'pending' | 'used' | 'expired' | 'revoked';

export class InviteError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'InviteError';
  }
}

export interface FamilyMember {
  id: string;
  displayName: string;
  firstName: string;
  lastName?: string;
  email: string;
  role: 'admin' | 'member' | 'pending';
  siteId: string;
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  approvedAt?: Timestamp;
  approvedBy?: string;
  rejectedAt?: Timestamp;
  rejectedBy?: string;
  rejectionReason?: string;
  avatarUrl?: string | null;
  avatarStoragePath?: string | null;
}

export interface FamilySite {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  settings?: {
    allowMemberInvites: boolean;
    requireApproval: boolean;
    maxMembers: number;
  };
}

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
  private readonly membersCollection = 'members';
  private readonly sitesCollection = 'sites';
  private readonly signupRequestsCollection = 'signupRequests';
  private readonly invitesCollection = 'invites';

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
      const db = this.getDb();
      const siteDoc = await db.collection(this.sitesCollection).doc(siteId).get();
      
      if (!siteDoc.exists) {
        return null;
      }

      return {
        id: siteDoc.id,
        ...siteDoc.data()
      } as FamilySite;
    } catch (error) {
      console.error('Error getting site:', error);
      throw new Error('Failed to get site');
    }
  }

  // Member Management
  async getMemberById(memberId: string): Promise<FamilyMember | null> {
    try {
      const db = this.getDb();
      const doc = await db.collection(this.membersCollection).doc(memberId).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...(doc.data() as any) } as FamilyMember;
    } catch (error) {
      console.error('Error getting member by id:', error);
      throw new Error('Failed to get member by id');
    }
  }
  async getMemberByUserId(userId: string, siteId: string): Promise<FamilyMember | null> {
    try {
      const db = this.getDb();
      
      const querySnapshot = await db.collection(this.membersCollection)
        .where('uid', '==', userId)
        .where('siteId', '==', siteId)
        .get();
      
      if (querySnapshot.empty) {
        return null;
      }

      const memberDoc = querySnapshot.docs[0];
      return {
        id: memberDoc.id,
        ...memberDoc.data()
      } as FamilyMember;
    } catch (error) {
      console.error('Error getting member by user ID:', error);
      throw new Error('Failed to get member');
    }
  }

  async getSiteMembers(siteId: string): Promise<FamilyMember[]> {
    try {
      const db = this.getDb();
      const querySnapshot = await db.collection(this.membersCollection)
        .where('siteId', '==', siteId)
        .where('role', 'in', ['admin', 'member'])
        .orderBy('createdAt', 'asc')
        .get();
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FamilyMember[];
    } catch (error) {
      console.error('Error getting site members:', error);
      throw new Error('Failed to get site members');
    }
  }

  async getPendingMembers(siteId: string): Promise<FamilyMember[]> {
    try {
      const db = this.getDb();
      const querySnapshot = await db.collection(this.membersCollection)
        .where('siteId', '==', siteId)
        .where('role', '==', 'pending')
        .orderBy('createdAt', 'asc')
        .get();
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FamilyMember[];
    } catch (error) {
      console.error('Error getting pending members:', error);
      throw new Error('Failed to get pending members');
    }
  }

  async createMember(memberData: Partial<IMember>): Promise<IMember> {
    try {
      const db = this.getDb();
      const now = Timestamp.now();
      const ref = await db.collection(this.membersCollection).add({
        ...memberData,
        createdAt: now,
        updatedAt: now,
      });
      const doc = await ref.get();
      return { id: doc.id, ...doc.data() } as IMember;
    } catch (error) {
      console.error('Error creating member:', error);
      throw new Error('Failed to create member');
    }
  }

  async updateMember(memberId: string, updates: Partial<FamilyMember>): Promise<void> {
    try {
      const db = this.getDb();
      const payload: Record<string, unknown> = {
        ...updates,
        updatedAt: Timestamp.now(),
      };
      for (const [key, value] of Object.entries(payload)) {
        if (value === null) {
          payload[key] = FieldValue.delete();
        }
      }
      await db.collection(this.membersCollection).doc(memberId).update(payload);
    } catch (error) {
      console.error('Error updating member:', error);
      throw new Error('Failed to update member');
    }
  }

  async deleteMember(memberId: string): Promise<void> {
    try {
      const db = this.getDb();
      await db.collection(this.membersCollection).doc(memberId).delete();
    } catch (error) {
      console.error('Error deleting member:', error);
      throw new Error('Failed to delete member');
    }
  }

  async approveMember(memberId: string, approvedBy: string): Promise<void> {
    try {
      const db = this.getDb();
      const now = Timestamp.now();
      
      await db.collection(this.membersCollection).doc(memberId).update({
        role: 'member',
        approvedAt: now,
        approvedBy,
        updatedAt: now
      });
    } catch (error) {
      console.error('Error approving member:', error);
      throw new Error('Failed to approve member');
    }
  }

  async rejectMember(memberId: string, rejectedBy: string, reason?: string): Promise<void> {
    try {
      const db = this.getDb();
      const now = Timestamp.now();
      
      await db.collection(this.membersCollection).doc(memberId).update({
        role: 'rejected',
        rejectedAt: now,
        rejectedBy,
        rejectionReason: reason,
        updatedAt: now
      });
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
    const membersRef = db.collection(this.membersCollection);
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
        if (invite.siteId !== user.siteId) {
          throw new InviteError('invite/wrong-site', 'Invite does not belong to this site');
        }
        if (invite.status === 'expired') {
          throw new InviteError('invite/expired', 'Invite has expired');
        }
        if (invite.status === 'revoked') {
          throw new InviteError('invite/revoked', 'Invite has been revoked');
        }

        const existingByUid = await tx.get(
          membersRef
            .where('siteId', '==', invite.siteId)
            .where('uid', '==', user.uid)
            .limit(1)
        );

        let existingMemberDoc = !existingByUid.empty ? existingByUid.docs[0] : undefined;

        if (existingMemberDoc) {
          console.info('[invite][repo] found member by uid', {
            token,
            memberId: existingMemberDoc.id,
          });
        }

        if (!existingMemberDoc && user.email) {
          const existingByEmail = await tx.get(
            membersRef
              .where('siteId', '==', invite.siteId)
              .where('email', '==', user.email)
              .limit(1)
          );
          if (!existingByEmail.empty) {
            existingMemberDoc = existingByEmail.docs[0];
            console.info('[invite][repo] found member by email', {
              token,
              memberId: existingMemberDoc.id,
            });
          }
        }

        if (existingMemberDoc) {
          const current = existingMemberDoc.data() as IMember;
          const memberRef = existingMemberDoc.ref;
          const updates: Partial<IMember> & { updatedAt: Timestamp } = {
            updatedAt: now,
          };
          if (!current.uid) updates.uid = user.uid;
          if (current.email !== user.email && user.email) updates.email = user.email;
          const displayCandidate = user.displayName || user.firstName || user.email;
          if (!current.displayName && displayCandidate) updates.displayName = displayCandidate;
          if (!current.firstName && displayCandidate) updates.firstName = displayCandidate;
          if (current.role === 'pending') updates.role = 'member';

          tx.update(memberRef, updates);
          tx.update(inviteRef, {
            lastUsedAt: now,
            lastUsedBy: user.uid,
            lastUsedByEmail: user.email,
            updatedAt: now,
          });

          console.info('[invite][repo] updated existing member', {
            token,
            memberId: memberRef.id,
            updates,
          });

          return { id: memberRef.id, ...current, ...updates } as IMember;
        }

        if (!user.email) {
          throw new InviteError('invite/missing-email', 'User email is required');
        }

        const memberDoc = {
          uid: user.uid,
          siteId: invite.siteId,
          role: 'member',
          displayName: user.displayName || user.firstName || user.email,
          firstName: user.firstName || user.displayName || user.email,
          email: user.email,
          createdAt: now,
          updatedAt: now,
        } satisfies Omit<IMember, 'id'>;

        const memberRef = membersRef.doc();
        tx.set(memberRef, memberDoc);

        // Record usage metadata but keep status pending so the link can be reused.
        tx.update(inviteRef, {
          lastUsedAt: now,
          lastUsedBy: user.uid,
          lastUsedByEmail: user.email,
          updatedAt: now,
        });

        console.info('[invite][repo] created new member from invite', {
          token,
          memberId: memberRef.id,
        });

        return { id: memberRef.id, ...memberDoc } as IMember;
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
      await adminNotificationService.notify('pending_member', requestData, siteUrl);

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
      const batch = db.batch();
      
      const requestRef = db.collection(this.signupRequestsCollection).doc(requestId);
      const requestDoc = await requestRef.get();
      
      if (!requestDoc.exists) {
        throw new Error('Signup request not found');
      }

      const request = requestDoc.data() as SignupRequest;

      if (approve) {
        // Approve the request
        batch.update(requestRef, {
          status: 'approved',
          approvedAt: Timestamp.now(),
          approvedBy,
          updatedAt: Timestamp.now()
        });

        // Create a new member
        const memberRef = db.collection(this.membersCollection).doc();
        batch.set(memberRef, {
          firstName: request.firstName,
          email: request.email,
          role: 'member',
          siteId: request.siteId,
          userId: request.userId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          approvedAt: Timestamp.now(),
          approvedBy
        });
      } else {
        // Reject the request
        batch.update(requestRef, {
          status: 'rejected',
          rejectedAt: Timestamp.now(),
          rejectedBy: rejectedBy,
          rejectionReason: reason,
          updatedAt: Timestamp.now()
        });
      }

      await batch.commit();
    } catch (error) {
      console.error('Error processing signup request:', error);
      throw new Error('Failed to process signup request');
    }
  }

  // Utility Methods
  async isUserMember(userId: string, siteId: string): Promise<boolean> {
    try {
      const member = await this.getMemberByUserId(userId, siteId);
      return member !== null && member.role === 'member';
    } catch (error) {
      console.error('Error checking if user is member:', error);
      return false;
    }
  }

  async isUserAdmin(userId: string, siteId: string): Promise<boolean> {
    try {
      const member = await this.getMemberByUserId(userId, siteId);
      return member !== null && member.role === 'admin';
    } catch (error) {
      console.error('Error checking if user is admin:', error);
      return false;
    }
  }

  // Member prefs
  async setMemberBlogEnabled(userId: string, siteId: string, enabled: boolean): Promise<void> {
    try {
      const db = this.getDb();
      const querySnapshot = await db.collection(this.membersCollection)
        .where('uid', '==', userId)
        .where('siteId', '==', siteId)
        .limit(1)
        .get();
      if (querySnapshot.empty) throw new Error('Member not found');
      const docSnap = querySnapshot.docs[0];
      const docRef = docSnap.ref;
      const data: any = { blogEnabled: !!enabled, updatedAt: Timestamp.now() };
      // If enabling and no handle exists, generate one from email prefix
      if (enabled && !docSnap.data().blogHandle) {
        const base = (docSnap.data().email || 'user').toString().split('@')[0]
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '') || 'user';
        data.blogHandle = await this.generateUniqueBlogHandle(base, siteId);
      }
      await docRef.update(data);
    } catch (error) {
      console.error('Error updating member blogEnabled:', error);
      throw new Error('Failed to update member');
    }
  }

  async getMembersWithBlog(siteId: string): Promise<FamilyMember[]> {
    try {
      const db = this.getDb();
      const snap = await db.collection(this.membersCollection)
        .where('siteId', '==', siteId)
        .where('blogEnabled', '==', true)
        .get();
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((m: any) => !!m.blogHandle) as FamilyMember[];
    } catch (e) {
      console.error('Error getMembersWithBlog', e);
      throw new Error('Failed to fetch members with blog');
    }
  }

  async getMemberByHandle(handle: string, siteId: string): Promise<FamilyMember | null> {
    try {
      const db = this.getDb();
      const qs = await db.collection(this.membersCollection)
        .where('siteId', '==', siteId)
        .where('blogHandle', '==', handle)
        .limit(1)
        .get();
      if (qs.empty) return null;
      const doc = qs.docs[0];
      return { id: doc.id, ...doc.data() } as FamilyMember;
    } catch (e) {
      console.error('Error getMemberByHandle', e);
      throw new Error('Failed to get member by handle');
    }
  }

  private async generateUniqueBlogHandle(base: string, siteId: string): Promise<string> {
    const db = this.getDb();
    let attempt = 0;
    while (attempt < 50) {
      const candidate = attempt === 0 ? base : `${base}-${attempt+1}`;
      const qs = await db.collection(this.membersCollection)
        .where('siteId', '==', siteId)
        .where('blogHandle', '==', candidate)
        .limit(1)
        .get();
      if (qs.empty) return candidate;
      attempt++;
    }
    return `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  async isUserPending(userId: string, siteId: string): Promise<boolean> {
    try {
      const member = await this.getMemberByUserId(userId, siteId);
      return member !== null && member.role === 'pending';
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
