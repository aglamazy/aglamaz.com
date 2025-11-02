import { blogRepository } from '@/repositories/BlogRepository';

export const dynamic = 'force-dynamic';

export const POST = async (_request: Request, { params }: { params: Promise<{ postId: string }> }) => {
  try {
    const { postId } = await params;
    const likeCount = await blogRepository.incrementLike(postId);
    return Response.json({ likeCount });
  } catch (error) {
    console.error('Failed to increment like:', error);
    return Response.json({ error: 'Failed to increment like' }, { status: 500 });
  }
};
