import { useState } from "react";
import { Car } from "lucide-react";
import { cn } from "@/lib/utils";

export function CarPhoto({ src, alt, className }: { src?: string | undefined; alt: string; className?: string | undefined }) {
  const [failed, setFailed] = useState(!src);
  if (failed)
    return (
      <div className={cn("grid place-items-center bg-primary/10 text-primary", className)}>
        <div className="flex flex-col items-center gap-1 text-xs font-semibold">
          <Car className="size-8" /> OwnerFi
        </div>
      </div>
    );
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}
