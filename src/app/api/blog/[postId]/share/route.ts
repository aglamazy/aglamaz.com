import { blogRepository } from '@/repositories/BlogRepository';

export const dynamic = 'force-dynamic';

export const POST = async (_request: Request, { params }: { params: Promise<{ postId: string }> }) => {
  try {
    const { postId } = await params;
    const shareCount = await blogRepository.incrementShare(postId);
    return Response.json({ shareCount });
  } catch (error) {
    console.error('Failed to increment share:', error);
    return Response.json({ error: 'Failed to increment share' }, { status: 500 });
  }
};
