import { useEffect, useRef, useState } from "react";
import { Button, TextInput } from "@/components/kit";
import { cn } from "@/lib/utils";

export type SignatureValue = { mode: "draw" | "type"; name: string; image?: string };

/** Sign by typing your name or drawing it. `onChange` gets null until there is something to sign with. */
export function SignaturePad({ defaultName, onChange }: { defaultName: string; onChange: (v: SignatureValue | null) => void }) {
  const [mode, setMode] = useState<"type" | "draw">("type");
  const [name, setName] = useState(defaultName);
  const [image, setImage] = useState<string | undefined>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    if (mode === "type") onChange(name.trim() ? { mode: "type", name: name.trim() } : null);
    else onChange(image ? { mode: "draw", name: defaultName, image } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, name, image]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * e.currentTarget.width, y: ((e.clientY - r.top) / r.height) * e.currentTarget.height };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    setImage(e.currentTarget.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvas.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setImage(undefined);
  };

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="How to sign" className="flex gap-1 rounded-xl bg-surface p-1">
        {(["type", "draw"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn("flex-1 rounded-lg px-3 py-2 text-sm font-semibold", mode === m ? "bg-white shadow-card" : "text-muted")}
          >
            {m === "type" ? "Type" : "Draw"}
          </button>
        ))}
      </div>
      {mode === "type" ? (
        <>
          <TextInput label="Type your full legal name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          {name.trim() && (
            <p aria-label="Signature preview" className="rounded-xl border border-dashed border-ink/20 px-4 py-5 text-center font-serif text-3xl italic">
              {name}
            </p>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <canvas
            ref={canvas}
            width={600}
            height={180}
            aria-label="Draw your signature"
            className="h-36 w-full touch-none rounded-xl border border-dashed border-ink/25 bg-white"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
