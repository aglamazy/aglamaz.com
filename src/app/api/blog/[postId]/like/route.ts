import { blogRepository } from '@/repositories/BlogRepository';

export const dynamic = 'force-dynamic';

export const POST = async (_request: Request, { params }: { params: { postId: string } }) => {
  try {
    const likeCount = await blogRepository.incrementLike(params.postId);
    return Response.json({ likeCount });
  } catch (error) {
    console.error('Failed to increment like:', error);
    return Response.json({ error: 'Failed to increment like' }, { status: 500 });
  }
};
