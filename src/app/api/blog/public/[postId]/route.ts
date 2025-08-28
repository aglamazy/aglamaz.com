import { BlogRepository } from '@/repositories/BlogRepository';

export const dynamic = 'force-dynamic';

export const GET = async (_request: Request, { params }: { params: { postId: string } }) => {
  try {
    const repo = new BlogRepository();
    const post = await repo.getById(params.postId);
    if (!post || !post.isPublic) {
      return Response.json({ error: 'Post not found' }, { status: 404 });
    }
    return Response.json({ post });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch post' }, { status: 500 });
  }
};
