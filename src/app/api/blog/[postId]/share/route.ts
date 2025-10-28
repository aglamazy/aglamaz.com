import { blogRepository } from '@/repositories/BlogRepository';

export const dynamic = 'force-dynamic';

export const POST = async (_request: Request, { params }: { params: { postId: string } }) => {
  try {
    const shareCount = await blogRepository.incrementShare(params.postId);
    return Response.json({ shareCount });
  } catch (error) {
    console.error('Failed to increment share:', error);
    return Response.json({ error: 'Failed to increment share' }, { status: 500 });
  }
};
