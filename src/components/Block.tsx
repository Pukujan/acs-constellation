import RichText from "./RichText";
import { t, type CopyKey } from "@/lib/content";

interface Props {
  id: string;
  /** Rendered as h2 by default; sections that already own an h2 pass h3. */
  level?: "h2" | "h3";
  eyebrow?: string;
  image?: string;
  imageAltKey?: CopyKey;
  captionKey?: CopyKey;
  reverse?: boolean;
  wide?: boolean;
}

export default function Block({
  id,
  level = "h2",
  eyebrow,
  image,
  imageAltKey,
  captionKey,
  reverse = false,
  wide = false,
}: Props) {
  const Heading = level;
  const heading = t(`block.${id}.heading` as CopyKey);
  const body = t(`block.${id}.body` as CopyKey);

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20"
    >
      <div
        className={`grid gap-8 ${
          image ? "md:grid-cols-2 md:items-center" : wide ? "" : "max-w-3xl"
        } ${reverse && image ? "md:[&>*:first-child]:order-2" : ""}`}
      >
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <Heading
            id={`${id}-heading`}
            className="mt-3 font-display text-[1.65rem] leading-[1.15] text-[hsl(var(--foreground))] sm:text-4xl"
          >
            {heading}
          </Heading>
          <p className="mt-5 max-w-prose text-[1.0125rem] leading-relaxed text-[hsl(var(--muted-foreground))]">
            <RichText text={body} />
          </p>
        </div>

        {image && (
          <figure className="grid gap-2">
            <div className="duotone shadow-plate border border-[hsl(var(--border))]">
              <img
                src={image}
                alt={imageAltKey ? t(imageAltKey) : ""}
                loading="lazy"
                decoding="async"
                className="h-auto w-full object-cover"
              />
            </div>
            {captionKey && (
              <figcaption className="text-sm italic text-[hsl(var(--muted-foreground))]">
                {t(captionKey)}
              </figcaption>
            )}
          </figure>
        )}
      </div>
    </section>
  );
}
