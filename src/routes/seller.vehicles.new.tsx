import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Car,
  Check,
  CheckCircle2,
  DollarSign,
  Image as ImageIcon,
  Landmark,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useDemoStore } from "@/lib/demo-store";
import { dealTerms, fmtUsd } from "@/lib/finance";
import { toast } from "sonner";

export const Route = createFileRoute("/seller/vehicles/new")({
  head: () => ({
    meta: [
      { title: "Add a car for seller financing — OwnerFi" },
      { name: "description", content: "List your car, set down payment and rate, and become the bank." },
    ],
  }),
  component: AddVehicleWizard,
});

const DEMO_PRESET = {
  vin: "4T1B11HK5MU123456",
  year: 2021,
  make: "Toyota",
  model: "Camry",
  trim: "SE Nightshade",
  mileage: 45000,
  body: "Sedan",
  exterior_color: "Celestial Silver Metallic",
  interior_color: "Black SofTex",
  condition: "Excellent",
  description: "One owner, non-smoker, garage kept. All scheduled maintenance completed at Toyota dealership. Clean Arizona title in hand.",
  features: ["Apple CarPlay", "Lane Assist", "Backup Camera", "Adaptive Cruise Control", "Keyless Entry", "Sport Wheels"],
  priceCents: 2100000,
  minDownPct: 15,
  apr: 9,
  allowedTerms: [36, 48, 60],
  city: "Phoenix",
  state: "AZ",
  photos: [
    "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=1200",
    "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=1200",
  ],
};

const SAMPLE_PHOTO_PRESETS = [
  { label: "Toyota Camry (Silver)", url: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=1200" },
  { label: "Honda Accord (White)", url: "https://images.unsplash.com/photo-1606611013016-969c19ba27bb?w=1200" },
  { label: "Tesla Model 3 (Gray)", url: "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=1200" },
  { label: "Ford F-150 (Black)", url: "https://images.unsplash.com/photo-1605893477799-b99e3b8b93fe?w=1200" },
  { label: "Toyota RAV4 (Blue)", url: "https://images.unsplash.com/photo-1581540222194-0def2dda95b8?w=1200" },
];

const AVAILABLE_FEATURES = [
  "Apple CarPlay",
  "Android Auto",
  "Lane Assist",
  "Blind Spot Monitor",
  "Backup Camera",
  "Adaptive Cruise Control",
  "Keyless Entry",
  "Push Button Start",
  "Heated Seats",
  "Leather Interior",
  "Sunroof / Moonroof",
  "Sport Wheels",
];

function AddVehicleWizard() {
  const navigate = useNavigate();
  const { addVehicle } = useDemoStore();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Vehicle info
  const [vin, setVin] = useState(DEMO_PRESET.vin);
  const [year, setYear] = useState<number>(DEMO_PRESET.year);
  const [make, setMake] = useState(DEMO_PRESET.make);
  const [model, setModel] = useState(DEMO_PRESET.model);
  const [trim, setTrim] = useState(DEMO_PRESET.trim);
  const [mileage, setMileage] = useState<number>(DEMO_PRESET.mileage);
  const [body, setBody] = useState(DEMO_PRESET.body);
  const [city, setCity] = useState(DEMO_PRESET.city);
  const [state, setState] = useState(DEMO_PRESET.state);

  // Step 2: Condition & features
  const [exteriorColor, setExteriorColor] = useState(DEMO_PRESET.exterior_color);
  const [interiorColor, setInteriorColor] = useState(DEMO_PRESET.interior_color);
  const [condition, setCondition] = useState(DEMO_PRESET.condition);
  const [description, setDescription] = useState(DEMO_PRESET.description);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(DEMO_PRESET.features);

  // Step 3: Photos
  const [selectedPhoto, setSelectedPhoto] = useState(DEMO_PRESET.photos[0] ?? "");
  const [customPhotoInput, setCustomPhotoInput] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState<{ id: string; url: string; name: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newPhotos: { id: string; url: string; name: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file && file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        newPhotos.push({
          id: `local-${Date.now()}-${i}`,
          url,
          name: file.name,
        });
      }
    }
    if (newPhotos.length > 0) {
      setUploadedPhotos((prev) => [...prev, ...newPhotos]);
      const firstUrl = newPhotos[0]?.url;
      if (firstUrl) {
        setSelectedPhoto(firstUrl);
      }
      toast.success(`Loaded ${newPhotos.length} photo${newPhotos.length > 1 ? "s" : ""} from your device`);
    }
    e.target.value = "";
  };

  // Step 4: Financing terms
  const [askingPriceDollars, setAskingPriceDollars] = useState(21000);
  const [minDownPct, setMinDownPct] = useState(15);
  const [apr, setApr] = useState(9);
  const [selectedTerms, setSelectedTerms] = useState<number[]>([36, 48, 60]);

  // Live financing calculations
  const priceCents = askingPriceDollars * 100;
  const primaryTerm = selectedTerms.includes(48) ? 48 : (selectedTerms[0] ?? 36);

  const fin = useMemo(() => {
    return dealTerms({
      priceCents,
      downPct: minDownPct,
      apr,
      termMonths: primaryTerm,
    });
  }, [priceCents, minDownPct, apr, primaryTerm]);

  const toggleFeature = (feat: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(feat) ? prev.filter((f) => f !== feat) : [...prev, feat]
    );
  };

  const toggleTerm = (t: number) => {
    setSelectedTerms((prev) => {
      if (prev.includes(t)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((x) => x !== t);
      }
      return [...prev, t].sort((a, b) => a - b);
    });
  };

  const handleFillDemo = () => {
    setVin(DEMO_PRESET.vin);
    setYear(DEMO_PRESET.year);
    setMake(DEMO_PRESET.make);
    setModel(DEMO_PRESET.model);
    setTrim(DEMO_PRESET.trim);
    setMileage(DEMO_PRESET.mileage);
    setBody(DEMO_PRESET.body);
    setExteriorColor(DEMO_PRESET.exterior_color);
    setInteriorColor(DEMO_PRESET.interior_color);
    setCondition(DEMO_PRESET.condition);
    setDescription(DEMO_PRESET.description);
    setSelectedFeatures(DEMO_PRESET.features);
    setAskingPriceDollars(21000);
    setMinDownPct(15);
    setApr(9);
    setSelectedTerms([36, 48, 60]);
    setSelectedPhoto(DEMO_PRESET.photos[0] ?? "");
    setUploadedPhotos([]);
    setCity("Phoenix");
    setState("AZ");
    toast.success("Loaded demo vehicle: 2021 Toyota Camry SE");
  };

  const handlePublish = () => {
    const newVehicle = addVehicle({
      vin,
      year: Number(year) || 2021,
      make: make.trim() || "Toyota",
      model: model.trim() || "Camry",
      trim: trim.trim() || "SE",
      body: body || "Sedan",
      mileage: Number(mileage) || 45000,
      exterior_color: exteriorColor || "Silver",
      interior_color: interiorColor || "Black",
      condition: condition || "Excellent",
      description: description || "One owner, clean title.",
      city: city || "Phoenix",
      state: state || "AZ",
      price_cents: priceCents,
      min_down_pct: minDownPct,
      apr,
      allowed_terms: selectedTerms,
      market_low_cents: Math.round(priceCents * 0.94),
      market_high_cents: Math.round(priceCents * 1.08),
      photos: [
        selectedPhoto || (DEMO_PRESET.photos[0] ?? ""),
        ...uploadedPhotos.map((p) => p.url).filter((u) => u !== selectedPhoto),
      ],
      features: selectedFeatures,
      history_summary: { owners: 1, accidents: 0, title: "clean" },
    });

    toast.success("Vehicle published successfully! Now live in the marketplace.", {
      description: `${year} ${make} ${model} — ${fmtUsd(priceCents)} (${apr}% APR)`,
      duration: 5000,
    });

    navigate({ to: "/cars" });
  };

  const stepsList = [
    { n: 1, title: "Vehicle info" },
    { n: 2, title: "Condition" },
    { n: 3, title: "Photos" },
    { n: 4, title: "Financing" },
    { n: 5, title: "Publish" },
  ];

  return (
    <AppShell
      role="seller"
      nav={
        <>
          <Link to="/seller" className="hover:text-ink">
            ← Back to dashboard
          </Link>
          <span className="text-ink font-semibold">List a vehicle</span>
        </>
      }
    >
      <div className="mx-auto max-w-4xl">
        {/* Top Header & Fast Preset */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Landmark className="size-3.5" /> Seller Financing Setup
            </span>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Add your car to OwnerFi
            </h1>
            <p className="text-sm text-muted-foreground">
              Define your vehicle specs and set your financing terms. You earn the interest.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFillDemo}
            className="flex items-center gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/5"
          >
            <Sparkles className="size-3.5" /> Quick fill: 2021 Camry
          </Button>
        </div>

        {/* Stepper Bar */}
        <nav aria-label="Progress" className="mt-6">
          <ol className="grid grid-cols-5 gap-2 text-center">
            {stepsList.map((s) => {
              const active = step === s.n;
              const done = step > s.n;
              return (
                <li
                  key={s.n}
                  onClick={() => {
                    if (done) setStep(s.n as typeof step);
                  }}
                  className={`flex flex-col items-center rounded-xl p-2 transition-all ${
                    done ? "cursor-pointer text-success" : active ? "text-primary font-semibold" : "text-muted-foreground"
                  }`}
                >
                  <div
                    className={`flex size-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      done
                        ? "bg-success text-success-foreground"
                        : active
                          ? "bg-primary text-primary-foreground shadow-sm ring-4 ring-primary/20"
                          : "bg-surface text-muted-foreground border border-border"
                    }`}
                  >
                    {done ? <Check className="size-3.5" /> : s.n}
                  </div>
                  <span className="mt-1 hidden text-xs sm:inline">{s.title}</span>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Wizard Step Content */}
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {/* STEP 1: Vehicle Details */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-ink">Step 1: Vehicle identification</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your car details or verify via VIN. We automatically pull title and safety records.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-ink">VIN (17 characters)</label>
                  <div className="relative">
                    <Input
                      value={vin}
                      onChange={(e) => setVin(e.target.value.toUpperCase())}
                      placeholder="e.g. 4T1B11HK5MU123456"
                      className="font-mono text-sm uppercase"
                    />
                    <span className="absolute right-3 top-2.5 flex items-center gap-1 text-xs font-medium text-success">
                      <BadgeCheck className="size-4" /> VIN verified
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink">Year</label>
                  <Input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    min={2005}
                    max={2026}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink">Make</label>
                  <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Toyota" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink">Model</label>
                  <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Camry" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink">Trim level</label>
                  <Input value={trim} onChange={(e) => setTrim(e.target.value)} placeholder="SE / XLE / Sport" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink">Mileage</label>
                  <Input
                    type="number"
                    value={mileage}
                    onChange={(e) => setMileage(Number(e.target.value))}
                    step={1000}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink">Body type</label>
                  <select
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="Sedan">Sedan</option>
                    <option value="SUV">SUV</option>
                    <option value="Truck">Truck</option>
                    <option value="Coupe">Coupe</option>
                    <option value="Wagon">Wagon</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink">City</label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Phoenix" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink">State</label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="AZ">Arizona (AZ · Max APR 10%)</option>
                    <option value="TX">Texas (TX · Max APR 18%)</option>
                    <option value="FL">Florida (FL · Max APR 18%)</option>
                    <option value="CA">California (CA · Max APR 10%)</option>
                    <option value="NY">New York (NY · Max APR 16%)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Condition & Features */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-ink">Step 2: Condition & highlights</h2>
                <p className="text-sm text-muted-foreground">
                  Give buyers an honest picture of your vehicle to attract qualified applicants quickly.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink">Exterior color</label>
                  <Input value={exteriorColor} onChange={(e) => setExteriorColor(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink">Interior color</label>
                  <Input value={interiorColor} onChange={(e) => setInteriorColor(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink">Overall condition</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  >
                    <option value="Excellent">Excellent (Like new, clean records)</option>
                    <option value="Very Good">Very Good (Minor wear only)</option>
                    <option value="Good">Good (Normal wear, fully functional)</option>
                    <option value="Fair">Fair (Noticeable cosmetics)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink">Seller description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Describe vehicle history, maintenance records, and how it drives..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-ink">Features & equipment</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_FEATURES.map((feat) => {
                    const sel = selectedFeatures.includes(feat);
                    return (
                      <button
                        type="button"
                        key={feat}
                        onClick={() => toggleFeature(feat)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                          sel
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "border border-border bg-surface text-muted-foreground hover:bg-accent hover:text-ink"
                        }`}
                      >
                        {sel ? "✓ " : "+ "}
                        {feat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Photos */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-ink">Step 3: Vehicle photos</h2>
                <p className="text-sm text-muted-foreground">
                  Upload photos directly from your device or choose from presets. High quality photos attract more verified buyers.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-ink">Primary display photo</label>
                  <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-surface aspect-[16/10] relative shadow-inner">
                    {selectedPhoto ? (
                      <img
                        src={selectedPhoto}
                        alt="Vehicle preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground">
                        <ImageIcon className="size-10 opacity-40 mb-2" />
                        <p className="text-xs">No photo selected</p>
                      </div>
                    )}
                    <span className="absolute bottom-3 left-3 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-semibold text-primary-foreground backdrop-blur">
                      Primary photo
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Upload Photos Section */}
                  <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 text-center transition-colors hover:border-primary/50">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFilesSelected}
                    />
                    <UploadCloud className="mx-auto size-8 text-primary opacity-80" />
                    <p className="mt-2 text-sm font-semibold text-ink">Upload photos from device</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      PNG, JPG, WebP supported · Select one or multiple images
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-3 inline-flex items-center gap-1.5"
                    >
                      <UploadCloud className="size-4" /> Upload photos
                    </Button>
                  </div>

                  {/* Uploaded Thumbnails Preview Gallery */}
                  {uploadedPhotos.length > 0 && (
                    <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-ink">
                          Selected photos ({uploadedPhotos.length})
                        </label>
                        <span className="text-[11px] text-muted-foreground">Click thumbnail to set as Primary</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {uploadedPhotos.map((p) => {
                          const isPrimary = selectedPhoto === p.url;
                          return (
                            <button
                              type="button"
                              key={p.id}
                              onClick={() => {
                                setSelectedPhoto(p.url);
                                toast.success("Marked as primary photo");
                              }}
                              className={`group relative aspect-[4/3] overflow-hidden rounded-xl border-2 transition-all ${
                                isPrimary
                                  ? "border-primary ring-2 ring-primary/30 shadow-sm"
                                  : "border-border hover:border-muted-foreground/40"
                              }`}
                            >
                              <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                              {isPrimary && (
                                <span className="absolute top-1 right-1 rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow">
                                  Primary
                                </span>
                              )}
                              <span className="absolute bottom-0 inset-x-0 bg-ink/75 py-0.5 text-[9px] text-primary-foreground truncate px-1 text-center font-medium">
                                {p.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sample Presets */}
                  <div>
                    <label className="text-xs font-medium text-ink">Or choose from sample presets</label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {SAMPLE_PHOTO_PRESETS.map((p) => {
                        const active = selectedPhoto === p.url;
                        return (
                          <button
                            type="button"
                            key={p.url}
                            onClick={() => setSelectedPhoto(p.url)}
                            className={`flex items-center gap-2 rounded-xl border p-2 text-left text-xs transition-all ${
                              active
                                ? "border-primary bg-primary/10 font-semibold text-primary ring-2 ring-primary/20"
                                : "border-border bg-surface text-muted-foreground hover:bg-accent"
                            }`}
                          >
                            <img src={p.url} alt="" className="size-8 rounded-lg object-cover" />
                            <span className="truncate">{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom URL Input */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-medium text-ink">Or enter custom image URL</label>
                    <div className="flex gap-2">
                      <Input
                        value={customPhotoInput}
                        onChange={(e) => setCustomPhotoInput(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (customPhotoInput.trim()) {
                            setSelectedPhoto(customPhotoInput.trim());
                            toast.success("Updated vehicle photo");
                          }
                        }}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Financing Terms (The OwnerFi Core Differentiator) */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  OwnerFi Core Advantage
                </span>
                <h2 className="mt-1 text-xl font-bold text-ink">Step 4: Define your financing terms</h2>
                <p className="text-sm text-muted-foreground">
                  You are the bank. Set your vehicle asking price, required down payment, and APR rate.
                </p>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Inputs */}
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-ink">Asking price</span>
                      <span className="money text-lg font-bold text-primary">${askingPriceDollars.toLocaleString()}</span>
                    </div>
                    <Input
                      type="number"
                      value={askingPriceDollars}
                      onChange={(e) => setAskingPriceDollars(Number(e.target.value))}
                      step={500}
                      min={3000}
                      max={120000}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-ink">Minimum down payment</span>
                      <span className="money font-semibold text-ink">
                        {minDownPct}% · {fmtUsd(fin.down)}
                      </span>
                    </div>
                    <Slider
                      value={[minDownPct]}
                      min={10}
                      max={40}
                      step={1}
                      onValueChange={(v) => setMinDownPct(v[0] ?? 15)}
                    />
                    <p className="text-xs text-muted-foreground">Recommended: 15%–20% to reduce seller default risk.</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-ink">Annual Percentage Rate (APR)</span>
                      <span className="money font-bold text-ink">{apr}% APR</span>
                    </div>
                    <Slider
                      value={[apr]}
                      min={5}
                      max={10} // AZ cap is 10%
                      step={0.5}
                      onValueChange={(v) => setApr(v[0] ?? 9)}
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Min: 5.0%</span>
                      <span className="font-medium text-warning">Arizona legal max cap: 10.0% APR</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-sm font-semibold text-ink">Allowed financing terms</span>
                    <div className="flex flex-wrap gap-2">
                      {[24, 36, 48, 60].map((termMonth) => {
                        const sel = selectedTerms.includes(termMonth);
                        return (
                          <button
                            type="button"
                            key={termMonth}
                            onClick={() => toggleTerm(termMonth)}
                            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
                              sel
                                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                : "border-border bg-surface text-muted-foreground hover:bg-accent"
                            }`}
                          >
                            {termMonth} months
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Live Financial Preview Card */}
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 space-y-5">
                  <div>
                    <p className="text-xs uppercase tracking-wider font-semibold text-primary">Live Financial Breakdown</p>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-sm text-muted-foreground">Buyer pays:</span>
                      <span className="money text-3xl font-bold text-primary">
                        {fmtUsd(fin.monthly, { cents: true })}
                        <span className="text-xs font-normal text-muted-foreground">/mo</span>
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Based on {primaryTerm}-month financing term</p>
                  </div>

                  <div className="border-t border-primary/10 pt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vehicle sales price</span>
                      <span className="money font-semibold text-ink">{fmtUsd(priceCents)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Buyer down payment ({minDownPct}%)</span>
                      <span className="money font-semibold text-ink">{fmtUsd(fin.down)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount financed by you</span>
                      <span className="money font-semibold text-ink">{fmtUsd(fin.financed)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total interest earned</span>
                      <span className="money font-bold text-success">+{fmtUsd(fin.interest)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">OwnerFi software fee</span>
                      <span className="money text-muted-foreground">−{fmtUsd(fin.fee)}</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-background p-4 border border-border shadow-sm">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Your total projected proceeds</p>
                        <p className="money text-2xl font-bold text-ink">{fmtUsd(fin.sellerTotal)}</p>
                      </div>
                      <div className="text-right">
                        <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                          +{fmtUsd(fin.interest - fin.fee)} profit
                        </span>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">vs. cash sale</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Review & Publish */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-ink">Step 5: Review & Publish</h2>
                <p className="text-sm text-muted-foreground">
                  Confirm your listing details. All pre-listing verification checks have passed.
                </p>
              </div>

              {/* Verified Checks Box */}
              <div className="rounded-2xl border border-success/30 bg-success/5 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-success">Pre-listing safety verification</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-success" />
                    <span><strong>NHTSA VIN Verified:</strong> {vin}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-success" />
                    <span><strong>Lien Status:</strong> No active liens recorded</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-success" />
                    <span><strong>Theft Registry:</strong> Negative / No stolen record</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-success" />
                    <span><strong>Title Verification:</strong> Clean Arizona title verified</span>
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <ShieldCheck className="size-4 text-success" />
                    <span><strong>Seller Verified:</strong> Maria Alvarez (Identity & Payouts connected)</span>
                  </div>
                </div>
              </div>

              {/* Summary of Car */}
              <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-border p-4 bg-surface">
                <img
                  src={selectedPhoto || DEMO_PRESET.photos[0]}
                  alt="Vehicle"
                  className="size-24 rounded-xl object-cover"
                />
                <div className="flex-1 min-w-[200px]">
                  <h3 className="text-lg font-bold text-ink">
                    {year} {make} {model} <span className="font-normal text-muted-foreground">{trim}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {city}, {state} · {Number(mileage).toLocaleString()} miles · {condition} condition
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <span className="money font-semibold text-primary">
                      {fmtUsd(fin.monthly, { cents: true })}/mo
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="money text-xs text-muted-foreground">
                      {fmtUsd(priceCents)} total · {minDownPct}% down · {apr}% APR
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Wizard Navigation Footer */}
          <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((s) => (s - 1) as typeof step)}
                className="flex items-center gap-1.5"
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
            ) : (
              <Button variant="ghost" asChild>
                <Link to="/seller">Cancel</Link>
              </Button>
            )}

            {step < 5 ? (
              <Button
                type="button"
                onClick={() => setStep((s) => (s + 1) as typeof step)}
                className="flex items-center gap-1.5"
              >
                Next <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handlePublish}
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md flex items-center gap-2"
              >
                <Car className="size-4" /> Publish Listing Now
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
