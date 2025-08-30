import { withMemberGuard } from '@/lib/withMemberGuard';
import { BlogRepository } from '@/repositories/BlogRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const getHandler = async (request: Request, _context: GuardContext) => {
  try {
    const repo = new BlogRepository();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (id) {
      const post = await repo.getById(id);
      if (!post) {
        return Response.json({ error: 'Post not found' }, { status: 404 });
      }
      return Response.json({ post });
    }
    const authorId = url.searchParams.get('authorId');
    const posts = authorId ? await repo.getByAuthor(authorId) : await repo.getAll();
    return Response.json({ posts });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
};

const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const repo = new BlogRepository();
    const user = context.user!;
    const body = await request.json();
    const { title, content, isPublic } = body;
    if (!title || !content) {
      return Response.json({ error: 'Missing fields' }, { status: 400 });
    }
    const post = await repo.create({
      authorId: user.userId,
      title,
      content,
      isPublic: Boolean(isPublic),
    });
    return Response.json({ post }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to create post' }, { status: 500 });
  }
};

const putHandler = async (request: Request, context: GuardContext) => {
  try {
    const repo = new BlogRepository();
    const user = context.user!;
    const member = context.member!;
    const body = await request.json();
    const { id, title, content, isPublic } = body;
    if (!id) {
      return Response.json({ error: 'Missing id' }, { status: 400 });
    }
    const existing = await repo.getById(id);
    if (!existing) {
      return Response.json({ error: 'Post not found' }, { status: 404 });
    }
    if (existing.authorId !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    await repo.update(id, { title, content, isPublic });
    const updated = await repo.getById(id);
    return Response.json({ post: updated });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update post' }, { status: 500 });
  }
};

const deleteHandler = async (request: Request, context: GuardContext) => {
  try {
    const repo = new BlogRepository();
    const user = context.user!;
    const member = context.member!;
    let id: string | null = null;
    try {
      const body = await request.json();
      id = body.id;
    } catch {
      // ignore
    }
    if (!id) {
      const url = new URL(request.url);
      id = url.searchParams.get('id');
    }
    if (!id) {
      return Response.json({ error: 'Missing id' }, { status: 400 });
    }
    const existing = await repo.getById(id);
    if (!existing) {
      return Response.json({ error: 'Post not found' }, { status: 404 });
    }
    if (existing.authorId !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    await repo.delete(id);
    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete post' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
export const POST = withMemberGuard(postHandler);
export const PUT = withMemberGuard(putHandler);
export const DELETE = withMemberGuard(deleteHandler);
