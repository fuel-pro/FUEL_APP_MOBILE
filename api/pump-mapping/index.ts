/**
 * Pump Mapping API Index
 *
 * Central entry point for all Pump Mapping v1 API endpoints
 */

export async function GET(): Promise<Response> {
  return new Response(
    JSON.stringify({
      name: "FuelPro Pump Mapping v1 API",
      version: "1.0.0",
      description: "Universal Fuel Pump Mapping & Intelligence Suite",

      endpoints: {
        "/api/pump-mapping": "This index",
        "/api/pump-mapping/extract": "Extract pump data from uploaded files",
        "/api/pump-mapping/chat": "AI chat for customizing extraction rules",
        "/api/pump-mapping/export": "Export extracted data in various formats",
      },

      features: {
        fileUpload: {
          supported: [
            "PDF",
            "Images (JPEG, PNG, GIF, WebP)",
            "Spreadsheets (XLSX, CSV)",
            "Text files",
          ],
          maxFileSize: "10MB",
          maxFiles: 10,
        },
        currencies: [
          "KES",
          "USD",
          "EUR",
          "GBP",
          "TZS",
          "UGX",
          "NGN",
          "ZAR",
          "INR",
          "CNY",
          "BRL",
        ],
        languages: [
          "English",
          "Swahili",
          "French",
          "Arabic",
          "Spanish",
          "Portuguese",
          "German",
          "Chinese",
          "Hindi",
          "Russian",
        ],
        fuelTypes: [
          "PMS (Petrol)",
          "AGO (Diesel)",
          "LPG (Cooking Gas)",
          "Kerosene",
          "Super (Premium)",
          "ULP (Unleaded)",
        ],
        shifts: ["DAY", "NIGHT", "MORNING", "AFTERNOON", "FULL"],
      },

      exportFormats: {
        csv: {
          name: "CSV",
          description: "Comma-separated values",
          mimeType: "text/csv",
        },
        txt: {
          name: "Plain Text",
          description: "No formatting, universal compatibility",
          mimeType: "text/plain",
        },
        json: {
          name: "JSON",
          description: "Machine-readable format",
          mimeType: "application/json",
        },
        html: {
          name: "HTML",
          description: "Printable document",
          mimeType: "text/html",
        },
        pdf: {
          name: "PDF",
          description: "Print via HTML",
          mimeType: "text/html",
        },
        xlsx: {
          name: "Excel",
          description: "Spreadsheet format",
          mimeType: "application/vnd.ms-excel",
        },
      },

      shareMethods: {
        email: { name: "Email", description: "Send via email" },
        whatsapp: { name: "WhatsApp", description: "Send via WhatsApp" },
        telegram: { name: "Telegram", description: "Send via Telegram bot" },
        sms: { name: "SMS", description: "Send via SMS" },
        copy: { name: "Copy", description: "Copy to clipboard" },
        print: { name: "Print", description: "Open print dialog" },
      },

      aiFeatures: {
        ocr: "Optical Character Recognition for image files",
        languageDetection: "Automatic language detection",
        currencyDetection: "Automatic currency detection",
        anomalyDetection: "Detect meter rollovers and irregularities",
        ruleTuning: "AI-powered custom rule configuration via chat",
      },

      accessibility: {
        textToSpeech: "Read summary aloud for service floor workers",
        keyboardNav: "Full keyboard navigation support",
        screenReader: "Screen reader compatible",
        highContrast: "High contrast mode support",
      },

      gettingStarted: {
        step1: "Upload your pump ledger files (PDF, images, or spreadsheets)",
        step2: "Set calibration anchors (date, time, shift)",
        step3: 'Click "Process Files" to extract data',
        step4: "Review extracted data and anomalies",
        step5: "Use AI Chat Tuner to customize rules if needed",
        step6: "Export in your preferred format or share directly",
      },

      documentation: "https://fuel-app-mobile.vercel.app/docs/pump-mapping",
      support: "https://fuel-app-mobile.vercel.app/support",
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
