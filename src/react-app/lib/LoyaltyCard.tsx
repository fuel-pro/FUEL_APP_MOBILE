/**
 * FuelPro Loyalty Card Component
 * Digital loyalty card with QR code for customer identification
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  CreditCard,
  QrCode,
  Download,
  Smartphone,
  Star,
  Copy,
  Check,
  Share2,
  Award,
  TrendingUp,
} from "lucide-react";
import { LoyaltyCustomer, TIER_COLORS, CustomerTier } from "./loyaltyProgram";

interface LoyaltyCardProps {
  customer: LoyaltyCustomer;
  stationName?: string;
  showPoints?: boolean;
  compact?: boolean;
  onDownload?: () => void;
}

export default function LoyaltyCard({
  customer,
  stationName = "FuelPro Station",
  showPoints = true,
  compact = false,
  onDownload,
}: LoyaltyCardProps) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const tierColors = TIER_COLORS[customer.tier];

  // Generate QR code
  useEffect(() => {
    generateQRCode();
  }, [customer.cardNumber, customer.phone]);

  const generateQRCode = async () => {
    try {
      // Create QR code data - simple implementation without external library
      const qrData = JSON.stringify({
        card: customer.cardNumber,
        phone: customer.phone,
        station: customer.stationId,
      });

      // For now, use a placeholder - in production use a proper QR library
      // We'll generate a simple visual representation
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Create a simple pattern as placeholder
      // In production, use: import QRCode from 'qrcode'
      drawSimpleQR(ctx, qrData, 120);

      setQrDataUrl(canvas.toDataURL());
    } catch (e) {
      console.error("[LoyaltyCard] QR generation error:", e);
    }
  };

  const drawSimpleQR = (
    ctx: CanvasRenderingContext2D,
    data: string,
    size: number
  ) => {
    // Clear canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    // Generate pseudo-random pattern based on data
    const hash = data
      .split("")
      .reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0);
    const cellSize = 4;
    const gridSize = Math.floor(size / cellSize);

    // Draw position markers (corners)
    const drawFinder = (x: number, y: number) => {
      ctx.fillStyle = "#000000";
      ctx.fillRect(x, y, 7 * cellSize, 7 * cellSize);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + cellSize, y + cellSize, 5 * cellSize, 5 * cellSize);
      ctx.fillStyle = "#000000";
      ctx.fillRect(
        x + 2 * cellSize,
        y + 2 * cellSize,
        3 * cellSize,
        3 * cellSize
      );
    };

    drawFinder(0, 0);
    drawFinder((gridSize - 7) * cellSize, 0);
    drawFinder(0, (gridSize - 7) * cellSize);

    // Draw data pattern
    ctx.fillStyle = "#000000";
    for (let y = 0; y < gridSize - 7; y++) {
      for (let x = 0; x < gridSize - 7; x++) {
        if (x < 7 || y < 7) continue;
        if ((hash * (x + 1) * (y + 1)) % 3 === 0) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
        }
      }
    }
  };

  const copyCardNumber = async () => {
    await navigator.clipboard.writeText(customer.cardNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCard = async () => {
    const text = `My FuelPro Loyalty Card\nCard: ${customer.cardNumber}\nPoints: ${customer.points}\nTier: ${customer.tier}\n\nShow this at ${stationName} to earn rewards!`;

    if (navigator.share) {
      await navigator.share({ title: "My FuelPro Card", text });
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (compact) {
    return (
      <div
        className="relative rounded-xl p-4 text-white overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${tierColors.gradient.replace("from-", "#").replace(" to-", " 0%, #")})`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Star size={18} className="text-white" />
            </div>
            <div>
              <p className="font-semibold">{customer.name}</p>
              <p className="text-xs opacity-80">{customer.cardNumber}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{customer.points}</p>
            <p className="text-xs opacity-80">points</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-xl"
      style={{
        background: `linear-gradient(135deg, ${tierColors.gradient.replace("from-", "#1a1a2e ").replace(" to-", " 0%, #1a1a2e ")})`,
      }}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px)`,
            backgroundSize: "20px 20px",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <Award size={16} className="text-white" />
            </div>
            <span className="text-white font-bold text-lg">FuelPro</span>
          </div>
          <div
            className={`px-3 py-1 rounded-full text-xs font-semibold ${tierColors.bg} ${tierColors.text}`}
          >
            {customer.tier} Member
          </div>
        </div>

        {/* Card Number */}
        <div className="mb-4">
          <p className="text-white/60 text-xs mb-1">Card Number</p>
          <div className="flex items-center gap-2">
            <p className="text-white font-mono text-xl tracking-wider">
              {customer.cardNumber}
            </p>
            <button
              onClick={copyCardNumber}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              {copied ? (
                <Check size={14} className="text-green-400" />
              ) : (
                <Copy size={14} className="text-white/60" />
              )}
            </button>
          </div>
        </div>

        {/* Customer Info */}
        <div className="mb-4">
          <p className="text-white font-semibold text-lg">{customer.name}</p>
          <p className="text-white/60 text-sm">{stationName}</p>
        </div>

        {/* Points Display */}
        {showPoints && (
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-white/60 text-xs mb-1">Available Points</p>
              <p className="text-white text-3xl font-bold flex items-center gap-1">
                {customer.points.toLocaleString()}
                <Star size={20} className="text-amber-400" />
              </p>
            </div>
            <div className="text-right">
              <p className="text-white/60 text-xs mb-1">Lifetime</p>
              <p className="text-white font-semibold">
                {customer.lifetimePoints.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* QR Code */}
        <div className="flex items-center gap-4 p-4 bg-white rounded-xl">
          <div className="flex-shrink-0">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code"
                className="w-20 h-20 rounded-lg"
              />
            ) : (
              <div className="w-20 h-20 bg-gray-200 rounded-lg animate-pulse" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-800 font-medium text-sm">
              Scan to earn points
            </p>
            <p className="text-gray-500 text-xs mt-1">
              Show at pump or counter
            </p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Smartphone size={12} />
                <span>Add to wallet</span>
              </div>
            </div>
          </div>
          <canvas
            ref={canvasRef}
            style={{ display: "none" }}
            width={120}
            height={120}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={shareCard}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
          >
            <Share2 size={14} />
            Share
          </button>
          {onDownload && (
            <button
              onClick={onDownload}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
            >
              <Download size={14} />
              Save
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="relative px-6 py-3 bg-black/20">
        <p className="text-white/60 text-xs text-center">
          Valid at {stationName} • Points expire after 12 months of inactivity
        </p>
      </div>
    </div>
  );
}

// ─── QR Code Scanner Component ───
interface QRScannerProps {
  onScan: (data: { cardNumber: string; phone?: string }) => void;
  onClose?: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setHasPermission(true);
      }
    } catch (e) {
      console.error("[QRScanner] Camera error:", e);
      setHasPermission(false);
      setError(
        "Camera access denied. Please allow camera access to scan QR codes."
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  // Simple QR detection simulation (in production, use a library like jsQR)
  const handleScan = useCallback(() => {
    // This is a placeholder - in production, use actual QR detection
    // For demo purposes, we'll simulate finding a card
    const mockData = {
      cardNumber: "FP00100011",
      phone: "",
    };
    onScan(mockData);
  }, [onScan]);

  if (hasPermission === false) {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center">
          <QrCode size={32} className="text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Camera Access Required
        </h3>
        <p className="text-gray-600 text-sm mb-4">{error}</p>
        <button
          onClick={startCamera}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full rounded-xl"
        onClick={handleScan}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-48 h-48 border-2 border-amber-500 rounded-xl" />
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white"
        >
          ✕
        </button>
      )}
      <p className="text-center text-sm text-gray-600 mt-3">
        Position QR code within the frame
      </p>
    </div>
  );
}
