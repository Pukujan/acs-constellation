import { Link } from "react-router-dom";

import Layout from "@/components/Layout";
import { t } from "@/lib/content";

export default function NotFound() {
  return (
    <Layout>
      <section className="mx-auto flex w-full max-w-3xl flex-col justify-center px-4 py-32 sm:px-6">
        <p className="eyebrow">{t("nav.brand")}</p>
        <h1 className="mt-4 font-display text-[2rem] leading-[1.1] text-[hsl(var(--foreground))] sm:text-5xl">
          {t("notfound.heading")}
        </h1>
        <p className="mt-5 max-w-prose text-[1.0125rem] leading-relaxed text-[hsl(var(--muted-foreground))]">
          {t("notfound.body")}
        </p>
        <Link to="/" className="link-quiet mt-8 inline-block text-sm">
          {t("notfound.link")}
        </Link>
      </section>
    </Layout>
  );
}
