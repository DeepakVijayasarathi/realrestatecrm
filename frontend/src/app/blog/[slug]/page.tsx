import { Metadata } from "next";
import { BlogPost, fmtDate } from "@/lib/types";
import BlogLeadForm from "@/components/BlogLeadForm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

async function getPost(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`${API_URL}/blog/${slug}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: BlogPost };
    return json.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return { title: "Post not found — RealRest" };
  const description = post.excerpt || post.body.replace(/\s+/g, " ").slice(0, 160);
  return {
    title: `${post.title} — RealRest`,
    description,
    openGraph: {
      title: post.title,
      description,
      type: "article",
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
    twitter: {
      card: post.coverImageUrl ? "summary_large_image" : "summary",
      title: post.title,
      description,
    },
  };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) return <p className="text-sm text-red-600">Post not found</p>;

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <article className="lg:col-span-2">
        {post.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverImageUrl} alt="" className="mb-6 h-64 w-full rounded-2xl object-cover" />
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-800">{post.title}</h1>
        <p className="mt-1 text-xs text-slate-400">
          {post.author?.name ? `${post.author.name} · ` : ""}{fmtDate(post.publishedAt)}
        </p>
        <div className="mt-6 max-w-none whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {post.body}
        </div>
      </article>
      <aside className="lg:sticky lg:top-8 lg:h-fit">
        <BlogLeadForm sourceTag={post.slug} />
      </aside>
    </div>
  );
}
