import { useState } from "react";
import { Check, Circle, Eye, EyeOff } from "lucide-react";
import { Field, fieldClasses } from "@/components/kit";
import { passwordRules } from "@/lib/session";
import { cn } from "@/lib/utils";

const METER = ["bg-ink/10", "bg-danger", "bg-warning", "bg-warning", "bg-success"];
const WORDS = ["", "Weak", "Okay", "Good", "Strong"];

export function PasswordField({
  label,
  value,
  onChange,
  onBlur,
  error,
  autoComplete,
  showRules,
  name,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string | undefined;
  autoComplete?: string;
  showRules?: boolean;
  name?: string;
}) {
  const [shown, setShown] = useState(false);
  const { score, rules } = passwordRules(value);
  return (
    <div className="space-y-2">
      <Field label={label} error={error} required>
        {({ id, describedBy, invalid }) => (
          <div className="relative">
            <input
              id={id}
              name={name}
              type={shown ? "text" : "password"}
              value={value}
              autoComplete={autoComplete}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              className={cn(fieldClasses(invalid), "h-12 pr-12")}
            />
            <button
              type="button"
              onClick={() => setShown((s) => !s)}
              aria-label={shown ? "Hide password" : "Show password"}
              aria-pressed={shown}
              className="absolute inset-y-0 right-1 my-auto flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-ink/5"
            >
              {shown ? <EyeOff aria-hidden className="h-5 w-5" /> : <Eye aria-hidden className="h-5 w-5" />}
            </button>
          </div>
        )}
      </Field>
      {showRules && (
        <>
          <div className="flex items-center gap-2" aria-live="polite">
            <div className="flex flex-1 gap-1" aria-hidden>
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={cn("h-1.5 flex-1 rounded-full", n <= score ? METER[score] : "bg-ink/10")} />
              ))}
            </div>
            <span className="w-14 text-right text-sm text-muted">{WORDS[score]}</span>
          </div>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {rules.map((r) => (
              <li key={r.id} className={cn("flex items-center gap-1.5", r.ok ? "text-success" : "text-muted")}>
                {r.ok ? <Check aria-hidden className="h-4 w-4" /> : <Circle aria-hidden className="h-3 w-3" />}
                {r.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
