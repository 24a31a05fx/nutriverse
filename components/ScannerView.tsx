"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Camera,
  Search,
  Barcode,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Database,
  ExternalLink,
  HelpCircle,
  Package,
} from "lucide-react";
import { Food, BarcodeLookupResponse, api, formatPaise } from "@/lib/api";

interface ScannerViewProps {
  onSelectFood: (food: Food) => void;
  onAddToCart: (food: Food) => void;
}

function lookupResultToFood(result: BarcodeLookupResponse): Food | null {
  if (!result.is_in_catalog || !result.product.id) return null;
  const p = result.product;
  const findVal = (code: string) =>
    result.nutrients.find((n) => n.canonical_code === code && !n.is_unknown)?.value ?? 0;

  return {
    id: p.id || "",
    name: p.name,
    barcode: result.barcode,
    category: p.category || "General",
    nutrition_tags: JSON.stringify(p.nutrition_tags || []),
    description: p.description || "",
    price_paise: p.price_paise || 0,
    unit: p.quantity || "1 unit",
    serving_size: p.serving_size || "100g",
    stock_qty: p.stock_qty || 0,
    calories: findVal("ENERC_KCAL"),
    protein_g: findVal("PROTCNT"),
    carbs_g: findVal("CHOAVLDF"),
    fat_g: findVal("FATCE"),
    fibre_g: findVal("FIBTG"),
    vitamins_json: "{}",
    ingredients: p.ingredients || "",
    storage_info: "Store in a cool, dry place.",
    prep_methods: JSON.stringify([]),
    dietary_tags: JSON.stringify(p.dietary_tags || []),
    emoji: p.emoji || "🥗",
    active: true,
  };
}

export const ScannerView: React.FC<ScannerViewProps> = ({ onSelectFood, onAddToCart }) => {
  const [barcodeInput, setBarcodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<BarcodeLookupResponse | null>(null);
  const [scannedFood, setScannedFood] = useState<Food | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPermissionState, setCameraPermissionState] = useState<
    "idle" | "requesting" | "denied" | "granted"
  >("idle");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Sample retail barcode shortcuts for verification demonstration (all satisfy GS1 Modulo-10)
  const sampleBarcodes = [
    { code: "8901234567890", name: "Sprouted Chickpeas", tag: "Local Catalog (IFCT Ground Truth)" },
    { code: "8901234567814", name: "Fresh Organic Ginger", tag: "Local Catalog (Store Inventory)" },
    { code: "8901234567821", name: "Whole Finger Millet", tag: "Local Catalog (IFCT Verified)" },
    { code: "8901030382345", name: "Tata Tea Gold", tag: "Open Food Facts (ODbL Reference)" },
    { code: "012345678905", name: "Sample UPC-A Format", tag: "GS1 Retail GTIN-12 Spec" },
  ];

  const handleLookup = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setLookupResult(null);
    setScannedFood(null);

    try {
      const result = await api<BarcodeLookupResponse>(
        `/barcode/lookup/${encodeURIComponent(trimmed)}`
      );
      setLookupResult(result);
      if (result.is_in_catalog) {
        const food = lookupResultToFood(result);
        setScannedFood(food);
      }
    } catch (err: any) {
      setError(err?.message || `No exact product match established for barcode '${trimmed}'.`);
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    setCameraPermissionState("requesting");
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraPermissionState("denied");
        setError("Camera access is not supported by this browser environment. Please use manual barcode entry below.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
      setCameraPermissionState("granted");
    } catch {
      setCameraPermissionState("denied");
      setError("Camera permission denied or camera device is unavailable in this environment. Manual entry is fully operational below.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-full mb-3 uppercase tracking-wider">
          <Barcode className="w-3.5 h-3.5" /> Instant Nutrition Scanner & Provenance
        </span>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Scan Any Food Barcode or EAN Code</h1>
        <p className="text-gray-600 max-w-2xl mx-auto text-sm">
          Resolve physical package barcodes with exact matching. Local items are verified against ICMR-NIN IFCT laboratory ground truth; external packaged goods are cross-referenced with Open Food Facts under ODbL licensing.
        </p>
      </div>

      <div className="grid md:grid-cols-12 gap-8 items-start">
        {/* Scanner & Manual Input Column */}
        <div className="md:col-span-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          {/* Camera Frame */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-700" /> Optical Camera Stream
              </label>
              {cameraActive ? (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="text-xs font-medium text-red-600 hover:text-red-700 underline"
                >
                  Turn off camera
                </button>
              ) : null}
            </div>

            <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden flex flex-col items-center justify-center text-white border border-gray-800 shadow-inner">
              {cameraActive ? (
                <div className="relative w-full h-full">
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                  <div className="absolute inset-0 border-2 border-emerald-400/50 m-8 rounded-lg pointer-events-none animate-pulse flex items-center justify-center">
                    <span className="bg-emerald-950/80 text-emerald-300 text-[11px] px-3 py-1 rounded-full font-mono">
                      Align barcode inside frame
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mx-auto text-gray-400">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-200">Device Camera is Idle</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-xs">
                      Activate camera to scan grocery packages directly in aisle.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={cameraPermissionState === "requesting"}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition inline-flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {cameraPermissionState === "requesting" ? "Connecting to Camera..." : "Launch Optical Scanner"}
                  </button>
                </div>
              )}
            </div>
            {cameraPermissionState === "denied" && (
              <p className="text-xs text-amber-600 mt-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200/60">
                Notice: Camera preview is inactive in this browser sandbox. Full manual lookup is enabled with zero latency below.
              </p>
            )}
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink mx-4 text-xs font-medium text-gray-600 uppercase">Or Enter Manually</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          {/* Manual Input Field */}
          <div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLookup(barcodeInput);
              }}
              className="space-y-3"
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="text"
                    placeholder="Enter EAN/UPC code (e.g. 8901234567890)"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !barcodeInput.trim()}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Verify
                </button>
              </div>
            </form>
          </div>

          {/* Quick Demo Barcode Shortcuts */}
          <div>
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">
              Seeded Test Barcodes (Click to Query):
            </span>
            <div className="space-y-1.5">
              {sampleBarcodes.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    setBarcodeInput(item.code);
                    handleLookup(item.code);
                  }}
                  className="w-full text-left p-2.5 rounded-lg border border-gray-100 hover:border-emerald-300 hover:bg-emerald-50/50 transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                      {item.code}
                    </span>
                    <span className="text-xs font-medium text-gray-900 group-hover:text-emerald-900">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-600">{item.tag}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scan Result Column */}
        <div className="md:col-span-6 space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm min-h-[460px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Nutritional Verification Output
                </h3>
                {lookupResult && (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                      lookupResult.is_in_catalog
                        ? "text-emerald-800 bg-emerald-50 border border-emerald-200"
                        : "text-blue-800 bg-blue-50 border border-blue-200"
                    }`}
                  >
                    {lookupResult.is_in_catalog ? (
                      <>
                        <CheckCircle className="w-3 h-3 text-emerald-600" /> Catalog Verified Match
                      </>
                    ) : (
                      <>
                        <Database className="w-3 h-3 text-blue-600" /> Open Food Facts Reference
                      </>
                    )}
                  </span>
                )}
              </div>

              {loading && (
                <div className="py-20 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
                  <p className="text-sm font-medium text-gray-600">Resolving barcode against authoritative ledgers...</p>
                </div>
              )}

              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-red-800">
                    <AlertCircle className="w-4 h-4 shrink-0" /> Exact Match Not Established
                  </div>
                  <p>{error}</p>
                  <p className="text-[11px] text-red-600">
                    Nutriverse enforces deterministic resolution. We never select a product based on similar names, brands, or fuzzy barcodes.
                  </p>
                </div>
              )}

              {!loading && !error && !lookupResult && (
                <div className="py-20 text-center text-gray-600 space-y-2">
                  <Barcode className="w-12 h-12 mx-auto stroke-1 text-gray-400" />
                  <p className="text-sm font-medium">Ready to inspect whole foods & packaged items</p>
                  <p className="text-xs max-w-xs mx-auto">
                    Click any sample barcode or enter a numeric package code to unveil authenticated nutrient density.
                  </p>
                </div>
              )}

              {lookupResult && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  {/* Product Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {lookupResult.product.image_url ? (
                        <img
                          src={lookupResult.product.image_url}
                          alt={lookupResult.product.name}
                          className="w-12 h-12 rounded-xl object-contain bg-white border border-gray-100 p-0.5 shadow-sm"
                        />
                      ) : (
                        <span className="text-3xl p-2 bg-emerald-50 rounded-xl border border-emerald-100/80">
                          {lookupResult.product.emoji || "📦"}
                        </span>
                      )}
                      <div>
                        <h4 className="text-base font-bold text-gray-900">{lookupResult.product.name}</h4>
                        <p className="text-xs text-gray-600">
                          {lookupResult.product.brand && <span className="font-semibold text-gray-800">{lookupResult.product.brand} • </span>}
                          {lookupResult.product.category || "General"} • Basis: {lookupResult.basis}
                        </p>
                        <p className="text-[11px] font-mono text-gray-600 mt-0.5">
                          GTIN/EAN: {lookupResult.barcode}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        lookupResult.verification_status === "verified_reference"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {lookupResult.verification_status.replace(/_/g, " ")}
                    </span>
                  </div>

                  {/* Provenance & Licensing Callout */}
                  <div
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      lookupResult.is_in_catalog
                        ? "bg-emerald-50/50 border-emerald-100 text-emerald-950"
                        : "bg-blue-50/60 border-blue-100 text-blue-950"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" /> Source: {lookupResult.source.name}
                      </span>
                      {lookupResult.source.retrieval_date && (
                        <span className="text-[10px] text-gray-600">
                          Fetched: {new Date(lookupResult.source.retrieval_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] opacity-90">{lookupResult.license_attribution}</p>

                    {/* Image-Specific Provenance & Attribution (Audit B) */}
                    {lookupResult.source.image_provenance && lookupResult.source.image_provenance.license_status !== "no_image" && (
                      <div className="pt-1.5 mt-1 border-t border-current/15 text-[11px] space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[10px] uppercase tracking-wider">
                            Photography Rights:
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              lookupResult.source.image_provenance.license_status === "known"
                                ? "bg-emerald-100/90 text-emerald-950"
                                : "bg-amber-100/90 text-amber-950"
                            }`}
                          >
                            {lookupResult.source.image_provenance.license_status === "known"
                              ? (lookupResult.source.image_provenance.license || "Verified Image License")
                              : "Unverified Image License"}
                          </span>
                        </div>
                        <p className="text-[10px] opacity-80 italic">
                          {lookupResult.source.image_provenance.attribution}
                        </p>
                      </div>
                    )}

                    {!lookupResult.is_in_catalog && (
                      <p className="text-[10px] font-medium text-amber-800 bg-amber-50/80 p-1.5 rounded border border-amber-200/50 mt-1">
                        Notice: This product is an external reference from Open Food Facts. It is not currently available in Nutriverse store inventory for ordering.
                      </p>
                    )}
                  </div>

                  {/* Serving and Quantity Specs */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    <div>
                      <span className="text-[10px] text-gray-600 block">Declared Serving Size</span>
                      <span className="font-semibold text-gray-800">{lookupResult.product.serving_size}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-600 block">Package Net Content</span>
                      <span className="font-semibold text-gray-800">{lookupResult.product.quantity || "N/A"}</span>
                    </div>
                  </div>

                  {/* Nutrients Grid */}
                  <div>
                    <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block mb-2">
                      Nutrient Profile ({lookupResult.basis}):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {lookupResult.nutrients.slice(0, 6).map((n) => (
                        <div key={n.canonical_code} className="p-2 rounded-lg bg-gray-50 border border-gray-100 text-xs">
                          <span className="text-[10px] text-gray-600 block truncate">{n.nutrient_name}</span>
                          {n.is_unknown ? (
                            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-1 py-0.5 rounded">
                              Not Reported
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-gray-900">
                              {n.value} {n.unit}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ingredients */}
                  {lookupResult.product.ingredients && (
                    <div className="pt-1">
                      <span className="text-[11px] font-semibold text-gray-600 block mb-1">
                        Ingredients & Formulation:
                      </span>
                      <p className="text-xs text-gray-700 italic bg-gray-50 p-2 rounded-lg border border-gray-100">
                        {lookupResult.product.ingredients}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons (only for active catalog items) */}
            {scannedFood && lookupResult?.is_in_catalog && (
              <div className="pt-4 border-t border-gray-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => onSelectFood(scannedFood)}
                  className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs font-semibold rounded-xl transition text-center"
                >
                  Full Bio Profile
                </button>
                <button
                  type="button"
                  onClick={() => onAddToCart(scannedFood)}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition text-center flex items-center justify-center gap-1"
                >
                  Add {formatPaise(scannedFood.price_paise)} to Bag
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
