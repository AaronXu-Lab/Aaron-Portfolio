import { getCollection } from 'astro:content';
import { postSummary } from '../../utils';

export async function GET() {
  const posts = await getCollection('blog');
  return Response.json(posts.map(({ id, data, body }) => ({
    slug: id,
    title: data.title,
    published_at: data.date.toISOString(),
    categories: data.categories,
    excerpt: data.excerpt ?? '',
    summary: postSummary(body),
    minutes: data.minutes,
  })));
}
