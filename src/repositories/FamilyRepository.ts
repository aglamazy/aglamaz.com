import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '../firebase/admin';
import type { IMember } from '@/entities/Member';

export interface FamilyMember {
  id: string;
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
}

export class FamilyRepository {
  private readonly membersCollection = 'members';
  private readonly sitesCollection = 'sites';
  private readonly signupRequestsCollection = 'signupRequests';

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
      await db.collection(this.membersCollection).doc(memberId).update({
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating member:', error);
      throw new Error('Failed to update member');
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

  // Signup Request Management
  async createSignupRequest(requestData: Omit<SignupRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<SignupRequest> {
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
      await requestRef.set({
        ...requestData,
        email: emailKey, // Store normalized email
        email_verified: false, // Default to false, will be updated if email succeeds
        createdAt: now,
        updatedAt: now
      }, { merge: true });

      return {
        id: documentId,
        ...requestData,
        email: emailKey,
        createdAt: now,
        updatedAt: now
      };
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

  async isUserPending(userId: string, siteId: string): Promise<boolean> {
    try {
      const member = await this.getMemberByUserId(userId, siteId);
      return member !== null && member.role === 'pending';
    } catch (error) {
      console.error('Error checking if user is pending:', error);
      return false;
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