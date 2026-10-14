import { useEffect, type ReactNode } from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { t } from "@/lib/content";
import { useNarrow } from "@/hooks/use-narrow";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Rendered inline on wide screens, as a bottom sheet under 640px. */
  inline: ReactNode;
  /**
   * Hero variant: the sheet covers only the lower half of the screen and stays
   * translucent, so the sky and the hotloader keep turning behind it.
   */
  overSky?: boolean;
  /** Wraps the wide-screen inline panel, so it can float over the hero sky. */
  inlineClassName?: string;
}

const HOT = "border-t border-[hsl(var(--studio)/0.5)]";

/**
 * Built on the vaul primitives rather than the vendored `DrawerContent`, which
 * hard-codes an opaque black overlay. An opaque overlay would blot out the sky,
 * and the swipe-down gesture is the point of using a drawer here.
 */
function SkySheet({
  open,
  onClose,
  title,
  children,
}: Pick<Props, "open" | "onClose" | "title" | "children">) {
  return (
    <DrawerPrimitive.Root
      open={open}
      onOpenChange={(next) => !next && onClose()}
      shouldScaleBackground={false}
      direction="bottom"
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-[hsl(var(--biscay-deep)/0.2)] backdrop-blur-[2px]" />
        <DrawerPrimitive.Content
          data-record-surface=""
          className={`fixed inset-x-0 bottom-0 z-50 flex h-[50dvh] flex-col ${HOT} rounded-t-2xl bg-[hsl(var(--background)/0.7)] px-5 pb-8 pt-3 backdrop-blur-md focus:outline-none`}
          style={{ transition: "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)" }}
        >
          <DrawerPrimitive.Title className="sr-only">{title}</DrawerPrimitive.Title>
          <div
            aria-hidden="true"
            className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-[hsl(var(--whisper)/0.3)]"
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {children}
            <button
              type="button"
              onClick={onClose}
              className="mt-5 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--whisper))]"
            >
              {t("constellation.dismiss")}
            </button>
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

export default function RecordSurface({
  open,
  onClose,
  title,
  children,
  inline,
  overSky = false,
  inlineClassName = "",
}: Props) {
  const narrow = useNarrow(640);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      // The panel itself, the sky (it closes on an empty tap), and the list
      // that opens another record all keep the pointer.
      if (target.closest("[data-record-surface], [data-sky], [data-sky-select]")) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, onClose]);

  if (!narrow) {
    return (
      <div data-record-surface="" className={`plate self-start p-5 ${inlineClassName}`}>
        {inline}
        {open && (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--whisper))]"
          >
            {t("constellation.dismiss")}
          </button>
        )}
      </div>
    );
  }

  if (overSky) {
    return (
      <SkySheet open={open} onClose={onClose} title={title}>
        {children}
      </SkySheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        data-record-surface=""
        side="bottom"
        className={`${HOT} max-h-[78dvh] overflow-y-auto rounded-t-2xl bg-[hsl(var(--background)/0.94)] px-5 pb-10 pt-4 data-[state=closed]:slide-out-to-bottom`}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[hsl(var(--border))]" />
        {children}
      </SheetContent>
    </Sheet>
  );
}

export function EmptyRecord() {
  return (
    <p className="text-sm text-[hsl(var(--muted-foreground))]">
      {t("map.panel.none")}
    </p>
  );
}
