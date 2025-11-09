import { FieldValue, Firestore, Timestamp, Transaction, getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';
import type { IMember } from '@/entities/Member';
import { normalizeSlug } from '@/utils/slug';

export type MemberRole = IMember['role'] | 'rejected';

export interface MemberLocaleProfile {
  displayName?: string | null;
  firstName?: string | null;
}

export interface MemberRecord extends Omit<IMember, 'role'> {
  role: MemberRole;
  lastName?: string | null;
  approvedAt?: Timestamp | null;
  approvedBy?: string | null;
  rejectedAt?: Timestamp | null;
  rejectedBy?: string | null;
  rejectionReason?: string | null;
  userId?: string | null;
  blogHandle?: string | null;
  blogEnabled?: boolean;
  avatarUrl?: string | null;
  avatarStoragePath?: string | null;
  translations?: Record<string, MemberLocaleProfile> | null;
  [key: string]: unknown;
}

export interface LocalizedMemberRecord extends MemberRecord {
  displayNameLocalized?: string;
  firstNameLocalized?: string;
}

export interface MemberQueryOptions {
  locale?: string | null;
}

export interface MemberListOptions extends MemberQueryOptions {
  roles?: MemberRole[];
  orderBy?: { field: string; direction?: FirebaseFirestore.OrderByDirection };
  limit?: number;
  blogEnabled?: boolean;
  blogHandle?: string;
}

export interface MemberTransactionSnapshot {
  id: string;
  data: MemberRecord;
}

export class BlogRegistrationError extends Error {
  constructor(public code: 'not_found' | 'handle_taken' | 'immutable' | 'invalid', message: string) {
    super(message);
    this.name = 'BlogRegistrationError';
  }
}

export class MemberRepository {
  constructor(private readonly db?: Firestore) {}

  private getDb(): Firestore {
    if (this.db) {
      return this.db;
    }
    initAdmin();
    return getFirestore();
  }

  private membersCollection() {
    return this.getDb().collection('members');
  }

  getTimestamp(): Timestamp {
    return Timestamp.now();
  }

  async getById(id: string, opts?: MemberQueryOptions): Promise<LocalizedMemberRecord | null> {
    try {
      const snap = await this.membersCollection().doc(id).get();
      if (!snap.exists) {
        return null;
      }
      return this.hydrateMember(snap, opts?.locale);
    } catch (error) {
      console.error('[member][repo] failed to load member by id', { id }, error);
      throw new Error('Failed to load member');
    }
  }

  async getByUid(siteId: string, uid: string, opts?: MemberQueryOptions): Promise<LocalizedMemberRecord | null> {
    try {
      const snap = await this.membersCollection()
        .where('siteId', '==', siteId)
        .where('uid', '==', uid)
        .limit(1)
        .get();
      if (snap.empty) {
        return null;
      }
      return this.hydrateMember(snap.docs[0], opts?.locale);
    } catch (error) {
      console.error('[member][repo] failed to load member by uid', { siteId, uid }, error);
      throw new Error('Failed to load member');
    }
  }

  async getByEmail(siteId: string, email: string, opts?: MemberQueryOptions): Promise<LocalizedMemberRecord | null> {
    try {
      const snap = await this.membersCollection()
        .where('siteId', '==', siteId)
        .where('email', '==', email)
        .limit(1)
        .get();
      if (snap.empty) {
        return null;
      }
      return this.hydrateMember(snap.docs[0], opts?.locale);
    } catch (error) {
      console.error('[member][repo] failed to load member by email', { siteId, email }, error);
      throw new Error('Failed to load member');
    }
  }

  async listBySite(siteId: string, opts?: MemberListOptions): Promise<LocalizedMemberRecord[]> {
    try {
      let query: FirebaseFirestore.Query = this.membersCollection().where('siteId', '==', siteId);

      if (opts?.roles && opts.roles.length) {
        const uniqueRoles = Array.from(new Set(opts.roles));
        if (uniqueRoles.length === 1) {
          query = query.where('role', '==', uniqueRoles[0]);
        } else {
          query = query.where('role', 'in', uniqueRoles.slice(0, 10));
        }
      }

      if (opts?.blogEnabled !== undefined) {
        query = query.where('blogEnabled', '==', opts.blogEnabled);
      }

      if (opts?.blogHandle) {
        query = query.where('blogHandle', '==', opts.blogHandle);
      }

      if (opts?.orderBy) {
        query = query.orderBy(opts.orderBy.field, opts.orderBy.direction ?? 'asc');
      }

      if (opts?.limit) {
        query = query.limit(opts.limit);
      }

      const snap = await query.get();
      return snap.docs.map(doc => this.hydrateMember(doc, opts?.locale));
    } catch (error) {
      console.error('[member][repo] failed to list site members', { siteId }, error);
      throw new Error('Failed to list members');
    }
  }

  async listActiveMembers(siteId: string, opts?: MemberQueryOptions): Promise<LocalizedMemberRecord[]> {
    return this.listBySite(siteId, {
      ...opts,
      roles: ['admin', 'member'],
      orderBy: { field: 'createdAt', direction: 'asc' },
    });
  }

  async listPendingMembers(siteId: string, opts?: MemberQueryOptions): Promise<LocalizedMemberRecord[]> {
    return this.listBySite(siteId, {
      ...opts,
      roles: ['pending'],
      orderBy: { field: 'createdAt', direction: 'asc' },
    });
  }

  async listMembersWithBlog(siteId: string, opts?: MemberQueryOptions): Promise<LocalizedMemberRecord[]> {
    const members = await this.listBySite(siteId, {
      ...opts,
      blogEnabled: true,
    });
    return members.filter(member => !!member.blogHandle);
  }

  async getByBlogHandle(
    siteId: string,
    handle: string,
    opts?: MemberQueryOptions,
  ): Promise<LocalizedMemberRecord | null> {
    try {
      const snap = await this.membersCollection()
        .where('siteId', '==', siteId)
        .where('blogHandle', '==', handle)
        .limit(1)
        .get();
      if (snap.empty) {
        return null;
      }
      return this.hydrateMember(snap.docs[0], opts?.locale);
    } catch (error) {
      console.error('[member][repo] failed to load member by handle', { siteId, handle }, error);
      throw new Error('Failed to load member');
    }
  }

  async getByHandle(handle: string, siteId: string, opts?: MemberQueryOptions): Promise<LocalizedMemberRecord | null> {
    return this.getByBlogHandle(siteId, handle, opts);
  }

  async create(data: Partial<MemberRecord>): Promise<MemberRecord> {
    try {
      const now = this.getTimestamp();
      const payload: Record<string, unknown> = {
        ...data,
        createdAt: (data as any)?.createdAt ?? now,
        updatedAt: (data as any)?.updatedAt ?? now,
      };
      const ref = await this.membersCollection().add(payload);
      const snap = await ref.get();
      return this.hydrateMember(snap);
    } catch (error) {
      console.error('[member][repo] failed to create member', error);
      throw new Error('Failed to create member');
    }
  }

  async update(memberId: string, updates: Partial<MemberRecord>, updatedAt?: Timestamp): Promise<void> {
    try {
      const payload = this.prepareUpdatePayload(updates, updatedAt);
      await this.membersCollection().doc(memberId).update(payload);
    } catch (error) {
      console.error('[member][repo] failed to update member', { memberId }, error);
      throw new Error('Failed to update member');
    }
  }

  async delete(memberId: string): Promise<void> {
    try {
      await this.membersCollection().doc(memberId).delete();
    } catch (error) {
      console.error('[member][repo] failed to delete member', { memberId }, error);
      throw new Error('Failed to delete member');
    }
  }

  async approve(memberId: string, approvedBy: string, timestamp = this.getTimestamp()): Promise<void> {
    await this.update(memberId, {
      role: 'member',
      approvedAt: timestamp,
      approvedBy,
    }, timestamp);
  }

  async reject(memberId: string, rejectedBy: string, reason?: string, timestamp = this.getTimestamp()): Promise<void> {
    await this.update(memberId, {
      role: 'rejected',
      rejectedAt: timestamp,
      rejectedBy,
      rejectionReason: reason ?? null,
    }, timestamp);
  }

  async isUserMember(uid: string, siteId: string): Promise<boolean> {
    const member = await this.getByUid(siteId, uid);
    return member !== null && member.role === 'member';
  }

  async isUserAdmin(uid: string, siteId: string): Promise<boolean> {
    const member = await this.getByUid(siteId, uid);
    return member !== null && member.role === 'admin';
  }

  async isUserPending(uid: string, siteId: string): Promise<boolean> {
    const member = await this.getByUid(siteId, uid);
    return member !== null && member.role === 'pending';
  }

  async setBlogEnabled(uid: string, siteId: string, enabled: boolean): Promise<void> {
    const member = await this.getByUid(siteId, uid);
    if (!member) {
      throw new Error('Member not found');
    }

    const updates: Partial<MemberRecord> = {
      blogEnabled: !!enabled,
    };

    if (enabled && !member.blogHandle) {
      const base = this.normalizeBlogHandle((member.email || 'user').split('@')[0]);
      updates.blogHandle = await this.generateUniqueBlogHandle(base, siteId);
    }

    await this.update(member.id, updates);
  }

  async registerBlog(
    uid: string,
    siteId: string,
    requestedHandle: string,
  ): Promise<string> {
    const db = this.getDb();
    const normalizedInput = this.normalizeBlogHandle(requestedHandle);

    return db.runTransaction(async (tx) => {
      const member = await this.findByUidForUpdate(tx, siteId, uid);
      if (!member) {
        throw new BlogRegistrationError('not_found', 'Member not found');
      }

      const fallbackHandle = this.normalizeBlogHandle((member.data.email || 'user').split('@')[0]);
      const desiredHandle = normalizedInput || fallbackHandle;

      if (!desiredHandle) {
        throw new BlogRegistrationError('invalid', 'Invalid blog handle');
      }

      const existingHandle = member.data.blogHandle;
      if (existingHandle && existingHandle !== desiredHandle) {
        throw new BlogRegistrationError('immutable', 'Blog handle cannot be changed once set');
      }

      const existing = await tx.get(
        this.membersCollection()
          .where('siteId', '==', siteId)
          .where('blogHandle', '==', desiredHandle)
          .limit(1),
      );

      if (!existing.empty && existing.docs[0].id !== member.id) {
        throw new BlogRegistrationError('handle_taken', 'Blog handle already in use');
      }

      this.txUpdate(tx, member.id, {
        blogEnabled: true,
        blogHandle: desiredHandle,
      });

      return desiredHandle;
    });
  }

  async findByUidForUpdate(
    tx: Transaction,
    siteId: string,
    uid: string,
  ): Promise<MemberTransactionSnapshot | null> {
    const snap = await tx.get(
      this.membersCollection()
        .where('siteId', '==', siteId)
        .where('uid', '==', uid)
        .limit(1),
    );
    if (snap.empty) {
      return null;
    }
    const doc = snap.docs[0];
    return { id: doc.id, data: this.hydrateMember(doc) };
  }

  async findByEmailForUpdate(
    tx: Transaction,
    siteId: string,
    email: string,
  ): Promise<MemberTransactionSnapshot | null> {
    const snap = await tx.get(
      this.membersCollection()
        .where('siteId', '==', siteId)
        .where('email', '==', email)
        .limit(1),
    );
    if (snap.empty) {
      return null;
    }
    const doc = snap.docs[0];
    return { id: doc.id, data: this.hydrateMember(doc) };
  }

  txUpdate(
    tx: Transaction,
    memberId: string,
    updates: Partial<MemberRecord>,
    options?: { updatedAt?: Timestamp },
  ): void {
    const payload = this.prepareUpdatePayload(updates, options?.updatedAt);
    tx.update(this.membersCollection().doc(memberId), payload);
  }

  txCreate(
    tx: Transaction,
    data: Partial<MemberRecord>,
    options?: { id?: string; timestamp?: Timestamp },
  ): MemberTransactionSnapshot {
    const timestamp = options?.timestamp ?? this.getTimestamp();
    const docRef = options?.id
      ? this.membersCollection().doc(options.id)
      : this.membersCollection().doc();
    const payload: Record<string, unknown> = {
      ...data,
      createdAt: (data as any)?.createdAt ?? timestamp,
      updatedAt: (data as any)?.updatedAt ?? timestamp,
    };
    tx.set(docRef, payload);
    return {
      id: docRef.id,
      data: { id: docRef.id, ...(payload as Record<string, unknown>) } as MemberRecord,
    };
  }

  private hydrateMember(
    doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
    locale?: string | null,
  ): LocalizedMemberRecord {
    const data = doc.data() as FirebaseFirestore.DocumentData;
    const record = { id: doc.id, ...(data as Record<string, unknown>) } as MemberRecord;
    return this.applyLocale(record, locale);
  }

  private applyLocale(record: MemberRecord, locale?: string | null): LocalizedMemberRecord {
    if (!locale) {
      return record;
    }
    const profile = this.resolveLocaleProfile(record.translations, locale);
    if (!profile) {
      return record;
    }
    return {
      ...record,
      displayNameLocalized: profile.displayName ?? record.displayName,
      firstNameLocalized: profile.firstName ?? record.firstName,
    };
  }

  private resolveLocaleProfile(
    translations: MemberRecord['translations'],
    locale: string,
  ): MemberLocaleProfile | null {
    if (!translations || typeof locale !== 'string') {
      return null;
    }
    const normalized = locale.toLowerCase();
    const candidates = normalized.includes('-')
      ? [normalized, normalized.split('-')[0]]
      : [normalized];

    for (const key of candidates) {
      const profile = translations?.[key];
      if (profile) {
        return profile;
      }
    }
    return null;
  }

  private prepareUpdatePayload(
    updates: Partial<MemberRecord>,
    explicitTimestamp?: Timestamp,
  ): FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> {
    const now = explicitTimestamp ?? this.getTimestamp();
    const payload: Record<string, unknown> = {
      ...updates,
      updatedAt: now,
    };
    for (const [key, value] of Object.entries(payload)) {
      if (value === null) {
        payload[key] = FieldValue.delete();
      }
    }
    return payload as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>;
  }

  private async generateUniqueBlogHandle(base: string, siteId: string): Promise<string> {
    let attempt = 0;
    const sanitizedBase = this.normalizeBlogHandle(base);
    while (attempt < 50) {
      const candidate = attempt === 0 ? sanitizedBase : `${sanitizedBase}-${attempt + 1}`;
      const snap = await this.membersCollection()
        .where('siteId', '==', siteId)
        .where('blogHandle', '==', candidate)
        .limit(1)
        .get();
      if (snap.empty) {
        return candidate;
      }
      attempt += 1;
    }
    return `${sanitizedBase}-${Math.random().toString(36).slice(2, 6)}`;
  }

  normalizeBlogHandle(input: string): string {
    return normalizeSlug(input);
  }
}
