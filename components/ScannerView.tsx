"use client";

import React, { useState, useRef, useEffect } from "react";
import { Camera, Search, Barcode, CheckCircle, AlertCircle, ArrowRight, Sparkles, RefreshCw } from "lucide-react";
import { Food, api } from "@/lib/api";

interface ScannerViewProps {
  onSelectFood: (food: Food) => void;
  onAddToCart: (food: Food) => void;
}

export const ScannerView: React.FC<ScannerViewProps> = ({ onSelectFood, onAddToCart }) => {
  const [barcodeInput, setBarcodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedFood, setScannedFood] = useState<Food | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPermissionState, setCameraPermissionState] = useState<"idle" | "requesting" | "denied" | "granted">("idle");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Sample barcode shortcuts for quick demonstration
  const sampleBarcodes = [
    { code: "8901234567890", name: "Sprouted Chickpeas", tag: "Protein & Iron" },
    { code: "8901234567891", name: "Organic Baby Spinach", tag: "Folate & Lutein" },
    { code: "8901234567893", name: "Probiotic Greek Yoghurt", tag: "High Protein & Calcium" },
    { code: "8901234567892", name: "White Quinoa", tag: "Complete Amino Acids" },
    { code: "8901234567800", name: "Organic Rolled Oats", tag: "Beta-Glucan Fiber" },
  ];

  const handleLookup = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setScannedFood(null);

    try {
      const food = await api<Food>(`/foods/barcode/${encodeURIComponent(trimmed)}`);
      setScannedFood(food);
    } catch (err: any) {
      setError(err?.message || `No product found for barcode ${trimmed}.`);
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
    } catch (err: any) {
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-full mb-3 uppercase tracking-wider">
          <Barcode className="w-3.5 h-3.5" /> Instant Nutrition Scanner
        </span>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Scan Any Food Barcode or QR Code</h1>
        <p className="text-gray-600 max-w-xl mx-auto text-sm">
          Point your device camera at a package barcode or enter the numeric EAN/UPC code to retrieve verified nutritional density, preparation guidelines, and companion recipe matches.
        </p>
      </div>

      <div className="grid md:grid-cols-12 gap-8 items-start">
        {/* Scanner & Manual Input Column */}
        <div className="md:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
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
                Notice: Camera preview is inactive in this sandbox. Full manual lookup is enabled with zero latency below.
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
                    placeholder="Enter EAN-13 code (e.g. 8901234567890)"
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
        <div className="md:col-span-5 space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm min-h-[420px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Nutritional Verification Output
                </h3>
                {scannedFood && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <CheckCircle className="w-3 h-3" /> Database Match
                  </span>
                )}
              </div>

              {loading && (
                <div className="py-20 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
                  <p className="text-sm font-medium text-gray-600">Querying authoritative Nutriverse ledger...</p>
                </div>
              )}

              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-red-800">
                    <AlertCircle className="w-4 h-4 shrink-0" /> No Database Match Found
                  </div>
                  <p>{error}</p>
                  <p className="text-[11px] text-red-600">
                    Nutriverse only returns verified laboratory compositions. We never invent nutritional values for unregistered barcodes.
                  </p>
                </div>
              )}

              {!loading && !error && !scannedFood && (
                <div className="py-20 text-center text-gray-600 space-y-2">
                  <Barcode className="w-12 h-12 mx-auto stroke-1" />
                  <p className="text-sm font-medium">Ready to inspect whole foods</p>
                  <p className="text-xs max-w-xs mx-auto">
                    Click any test barcode above or scan a package code to unveil instant nutrient density.
                  </p>
                </div>
              )}

              {scannedFood && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl p-2 bg-emerald-50 rounded-xl border border-emerald-100/80">
                      {scannedFood.emoji}
                    </span>
                    <div>
                      <h4 className="text-base font-bold text-gray-900">{scannedFood.name}</h4>
                      <p className="text-xs text-gray-600">
                        {scannedFood.category} • {scannedFood.serving_size}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">
                    {scannedFood.description}
                  </p>

                  {/* Macro Highlights */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 bg-emerald-50/70 rounded-lg">
                      <span className="text-[10px] text-gray-600 block">Calories</span>
                      <span className="text-xs font-bold text-emerald-900">{scannedFood.calories}</span>
                    </div>
                    <div className="p-2 bg-blue-50/70 rounded-lg">
                      <span className="text-[10px] text-gray-600 block">Protein</span>
                      <span className="text-xs font-bold text-blue-900">{scannedFood.protein_g}g</span>
                    </div>
                    <div className="p-2 bg-amber-50/70 rounded-lg">
                      <span className="text-[10px] text-gray-600 block">Carbs</span>
                      <span className="text-xs font-bold text-amber-900">{scannedFood.carbs_g}g</span>
                    </div>
                    <div className="p-2 bg-purple-50/70 rounded-lg">
                      <span className="text-[10px] text-gray-600 block">Fiber</span>
                      <span className="text-xs font-bold text-purple-900">{scannedFood.fibre_g}g</span>
                    </div>
                  </div>

                  {/* Biological Tags */}
                  <div className="pt-2">
                    <span className="text-[11px] font-semibold text-gray-600 block mb-1.5">
                      Identified Biological Contributions:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {JSON.parse(scannedFood.nutrition_tags || "[]").map((t: string) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 bg-emerald-100/70 text-emerald-800 text-[10px] font-medium rounded-full"
                        >
                          {t.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="text-[11px] font-semibold text-gray-600 block mb-1">
                      Ingredients & Composition:
                    </span>
                    <p className="text-xs text-gray-700 italic">{scannedFood.ingredients}</p>
                  </div>
                </div>
              )}
            </div>

            {scannedFood && (
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
                  Add ₹{scannedFood.price_inr} to Bag
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
