import { Metadata } from "next";
import Link from "next/link";
import ExitIntentModal from "@/components/ExitIntentModal";

const DEFAULT_BRANDING = { appName: "Thanjai Property", tagline: "Real Estate · Since 2009", logoUrl: null as string | null };

// Server-side fetch (this is a server component) so both the metadata below and the
// header render the current brand name instead of a value hardcoded at build time —
// this page previously said "RealRest" even after the rest of the app was rebranded.
async function getBranding() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
    const res = await fetch(`${apiUrl}/settings/branding/public`, { next: { revalidate: 300 } });
    if (!res.ok) return DEFAULT_BRANDING;
    const json = (await res.json()) as { data?: Partial<typeof DEFAULT_BRANDING> };
    return { ...DEFAULT_BRANDING, ...json.data };
  } catch {
    return DEFAULT_BRANDING;
  }
}

// Section-wide default — individual posts override this via their own generateMetadata
// in blog/[slug]/page.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  const title = `Insights & Guides — ${branding.appName}`;
  const description = `Real estate market trends, buying guides, and neighborhood spotlights from ${branding.appName}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  const branding = await getBranding();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-4 py-4">
          <Link href="/blog" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white shadow-sm">
              {branding.appName.charAt(0).toUpperCase()}
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight text-slate-800">{branding.appName}</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-gold-600">Insights &amp; Guides</div>
            </div>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {branding.appName}. All rights reserved.
      </footer>
      <ExitIntentModal />
    </div>
  );
}
