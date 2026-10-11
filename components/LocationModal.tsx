"use client";

import React, { useState, useEffect } from "react";
import { MapPin, X, Clock, CheckCircle2, AlertCircle } from "lucide-react";

export interface DeliveryLocation {
  label: string;
  pincode: string;
  city: string;
  slot: string;
  isServiceable: boolean;
}

export const DEFAULT_LOCATION: DeliveryLocation = {
  label: "MG Road, Vijayawada",
  pincode: "520002",
  city: "Vijayawada",
  slot: "Next slot in 5 hrs (6:00 PM - 8:00 PM)",
  isServiceable: true,
};

const POPULAR_AREAS: DeliveryLocation[] = [
  {
    label: "MG Road, Vijayawada",
    pincode: "520002",
    city: "Vijayawada",
    slot: "Next slot in 5 hrs (6:00 PM - 8:00 PM)",
    isServiceable: true,
  },
  {
    label: "Benz Circle, Vijayawada",
    pincode: "520010",
    city: "Vijayawada",
    slot: "Next slot in 5 hrs (6:00 PM - 8:00 PM)",
    isServiceable: true,
  },
  {
    label: "Governorpet, Vijayawada",
    pincode: "520002",
    city: "Vijayawada",
    slot: "Next slot in 6 hrs (7:00 PM - 9:00 PM)",
    isServiceable: true,
  },
  {
    label: "Bhavanipuram, Vijayawada",
    pincode: "520012",
    city: "Vijayawada",
    slot: "Tomorrow Morning (7:00 AM - 9:00 AM)",
    isServiceable: true,
  },
  {
    label: "Koramangala, Bengaluru",
    pincode: "560034",
    city: "Bengaluru",
    slot: "Next day express (9:00 AM - 12:00 PM)",
    isServiceable: true,
  },
];

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: DeliveryLocation;
  onSelectLocation: (loc: DeliveryLocation) => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  onSelectLocation,
}) => {
  const [inputPincode, setInputPincode] = useState(currentLocation.pincode);
  const [customArea, setCustomArea] = useState("");
  const [validationState, setValidationState] = useState<"idle" | "valid" | "invalid">("idle");
  const [feedbackMsg, setFeedbackMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setInputPincode(currentLocation.pincode);
      setValidationState("idle");
      setFeedbackMsg("");
    }
  }, [isOpen, currentLocation]);

  if (!isOpen) return null;

  const handleValidatePincode = (code: string) => {
    const clean = code.trim();
    if (!/^\d{6}$/.test(clean)) {
      setValidationState("invalid");
      setFeedbackMsg("Please enter a valid 6-digit Indian postal code.");
      return;
    }

    // Vijayawada pincodes (520001 - 520015) or Bengaluru test (560001 - 560105)
    const num = parseInt(clean, 10);
    const isVijayawada = num >= 520001 && num <= 520015;
    const isBengaluru = num >= 560001 && num <= 560105;

    if (isVijayawada) {
      setValidationState("valid");
      setFeedbackMsg("⚡ Serviceable! Delivery in 3-5 hours or next morning slot.");
    } else if (isBengaluru) {
      setValidationState("valid");
      setFeedbackMsg("⚡ Serviceable! Standard delivery in 24 hours.");
    } else {
      setValidationState("invalid");
      setFeedbackMsg("Currently out of direct delivery zone. We are actively expanding to your pincode!");
    }
  };

  const handleApplyCustom = () => {
    if (validationState !== "valid") {
      handleValidatePincode(inputPincode);
      return;
    }
    const loc: DeliveryLocation = {
      label: customArea.trim() || `Pincode ${inputPincode}`,
      pincode: inputPincode.trim(),
      city: inputPincode.startsWith("520") ? "Vijayawada" : "Bengaluru",
      slot: "Next slot in 5 hrs (6:00 PM - 8:00 PM)",
      isServiceable: true,
    };
    onSelectLocation(loc);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#143e2b] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm">Choose Delivery Location</h3>
              <p className="text-[11px] text-emerald-200">Delivery slots and item availability depend on your area</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Slot Info */}
        <div className="px-6 py-3 bg-amber-50/70 border-b border-amber-200/60 flex items-center gap-2.5 text-xs text-amber-900">
          <Clock className="w-4 h-4 text-amber-700 shrink-0" />
          <span><strong>Fastest Slot:</strong> Next slot in 5 hrs (Evening Express 6:00 PM - 8:00 PM)</span>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Quick Pincode Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-800">
              Check Pincode Serviceability
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={inputPincode}
                onChange={(e) => {
                  setInputPincode(e.target.value);
                  if (e.target.value.length === 6) {
                    handleValidatePincode(e.target.value);
                  } else {
                    setValidationState("idle");
                    setFeedbackMsg("");
                  }
                }}
                placeholder="e.g. 520002"
                className="flex-1 px-3.5 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#236b48] focus:border-transparent outline-hidden font-mono"
              />
              <button
                type="button"
                onClick={() => handleValidatePincode(inputPincode)}
                className="px-4 py-2 bg-[#236b48] hover:bg-[#1a5338] text-white text-xs font-bold rounded-xl transition"
              >
                Check
              </button>
            </div>

            {validationState === "valid" && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{feedbackMsg}</span>
              </div>
            )}
            {validationState === "invalid" && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span>{feedbackMsg}</span>
              </div>
            )}
          </div>

          {/* Optional Area Name if Valid */}
          {validationState === "valid" && (
            <div className="space-y-1.5 animate-in fade-in">
              <label className="block text-xs font-bold text-gray-800">
                Apartment / Street / Area (Optional)
              </label>
              <input
                type="text"
                value={customArea}
                onChange={(e) => setCustomArea(e.target.value)}
                placeholder="e.g. Flat 302, Green Meadows, MG Road"
                className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#236b48] focus:border-transparent outline-hidden"
              />
              <button
                type="button"
                onClick={handleApplyCustom}
                className="w-full mt-2 py-2.5 bg-[#236b48] hover:bg-[#1a5338] text-white text-xs font-bold rounded-xl transition shadow-xs"
              >
                Set As Delivery Location
              </button>
            </div>
          )}

          {/* Popular / Saved Locations */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <span className="text-[11px] font-bold uppercase text-gray-600 tracking-wider">
              Popular Delivery Zones
            </span>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {POPULAR_AREAS.map((loc) => {
                const isSelected =
                  currentLocation.pincode === loc.pincode &&
                  currentLocation.label === loc.label;
                return (
                  <button
                    key={`${loc.label}-${loc.pincode}`}
                    type="button"
                    onClick={() => {
                      onSelectLocation(loc);
                      onClose();
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between ${
                      isSelected
                        ? "bg-emerald-50/70 border-[#236b48] text-emerald-950 font-bold"
                        : "bg-gray-50/60 hover:bg-gray-100/70 border-gray-200 text-gray-800"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{loc.label}</span>
                        <span className="text-[10px] font-mono text-gray-600">({loc.pincode})</span>
                      </div>
                      <div className="text-[11px] text-gray-600 pl-5">
                        {loc.slot}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-xs font-bold text-[#236b48]">Selected</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
