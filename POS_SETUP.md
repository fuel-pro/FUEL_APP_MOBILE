# POS Hardware Setup Guide

## Quick Start

### 1. Connect Hardware
- Plug in USB printer
- Connect card reader
- Attach cash drawer to printer
- Connect barcode scanner

### 2. Grant Permissions
- Open browser (Chrome recommended)
- Navigate to POS Hardware page
- Click "Scan USB" or "Scan Bluetooth"
- Grant USB/Bluetooth permissions when prompted

### 3. Test Devices
- Click "Test Print"
- Click "Open Cash Drawer"
- Click "Test Card Reader"

### 4. Start Selling
- Go to Sales page
- Add items to cart
- Click Checkout
- Select payment method
- Complete sale

## Features

### ✅ Hardware Support
- **Thermal Printers**: ESC/POS protocol, USB, Bluetooth, Network
- **Card Readers**: Swipe, Chip, Contactless (NFC)
- **Cash Drawers**: Printer-connected or USB
- **Barcode Scanners**: USB, Bluetooth, Keyboard wedge
- **Customer Displays**: VFD, USB, Network

### ✅ Automatic Detection
- WebUSB for USB devices
- WebBluetooth for wireless devices
- Keyboard wedge for barcode scanners
- Network discovery for IP printers

### ✅ Receipt Printing
- Professional ESC/POS formatting
- Company branding and logo support
- Transaction details and itemized list
- Barcode printing for reference

### ✅ Card Payment Processing
- Swipe, insert, or tap card
- Real-time transaction status
- Secure card data handling
- Fallback simulation for testing

### ✅ Cash Management
- Automatic cash drawer control
- Change calculation
- Cash-up reconciliation

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FuelPro App                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐│
│  │   Sales     │  │  Checkout   │  │   POS Interface     ││
│  │   Module    │──│   Module    │──│   (Hardware Setup)  ││
│  └─────────────┘  └──────┬──────┘  └─────────────────────┘│
│                           │                                  │
│                           ▼                                  │
│                   ┌───────────────┐                         │
│                   │  POS Services │                         │
│  ┌────────────────│               │────────────────┐      │
│  │                └───────┬───────┘                │      │
│  │                        │                        │      │
│  ▼                        ▼                        ▼      │
│ ┌────────────┐    ┌──────────────┐    ┌──────────────────┐│
│ │  Printer   │    │    Card      │    │   Cash Drawer    ││
│ │  Service   │    │   Payment    │    │   Controller     ││
│ └─────┬──────┘    │   Service    │    └──────────────────┘│
│       │           └──────┬───────┘                         │
│       ▼                 ▼                                  │
│ ┌──────────────────────────────────────────────────────┐  │
│ │              Hardware Manager                          │  │
│ │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │  │
│ │  │   USB   │  │Bluetooth│  │ Network │  │Keyboard │ │  │
│ │  │ Manager │  │ Manager │  │ Manager │  │ Scanner │ │  │
│ │  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │  │
│ └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## API Reference

### Hardware Manager

```typescript
import { hardwareManager } from '@/react-app/lib/pos';

// Get all connected devices
const devices = hardwareManager.getDeviceStatus();
console.log(`Printers: ${devices.printers}, Card Readers: ${devices.cardReaders}`);

// Get specific device
const printer = hardwareManager.getPrinter();
const cardReader = hardwareManager.getCardReader();

// Listen for device events
hardwareManager.on('printerConnected', (printer) => {
  console.log('Printer connected:', printer.name);
});

hardwareManager.on('cardReaderConnected', (reader) => {
  console.log('Card reader connected:', reader.name);
});

// Scan for USB devices
await hardwareManager.scanUSBDevices();

// Add network printer
await hardwareManager.addNetworkPrinter('192.168.1.100', 9100);

// Disconnect all
hardwareManager.disconnectAll();
```

### Printer Service

```typescript
import { printerService, type ReceiptData } from '@/react-app/lib/pos';

// Print a receipt
const receipt: ReceiptData = {
  stationName: 'FuelPro Station',
  stationLocation: 'Nairobi, Kenya',
  receiptNumber: 'RCP20240115001',
  date: '2024-01-15',
  time: '14:30:00',
  items: [
    { name: 'Petrol (E)', quantity: 10, unitPrice: 180.50, total: 1805.00 },
    { name: 'Diesel', quantity: 5, unitPrice: 165.00, total: 825.00 },
  ],
  subtotal: 2630.00,
  tax: 394.50,
  discount: 0,
  total: 3024.50,
  paymentMethod: 'cash',
  amountPaid: 3500,
  change: 475.50,
  customerName: 'John Doe',
  attendantName: 'Jane',
};

await printerService.printReceipt(receipt);

// Test print
await printerService.testPrint();

// Open cash drawer
await printerService.openCashDrawer();

// Print custom text
await printerService.printText('Thank you!', { bold: true, cut: true });
```

### Payment Service

```typescript
import { paymentService } from '@/react-app/lib/pos';

// Process card payment
const result = await paymentService.processPayment({
  amount: 3024.50,
  currency: 'KES',
  type: 'sale',
  reference: 'TXN-001',
});

// Handle result
if (result.success) {
  console.log('Transaction ID:', result.transactionId);
  console.log('Auth Code:', result.authorizationCode);
} else {
  console.error('Payment failed:', result.errorMessage);
}

// Simulate for testing
const simResult = await paymentService.simulateCardPayment(100, 'KES');

// Listen for payment events
paymentService.on('waitingForCard', () => {
  console.log('Please swipe card...');
});

paymentService.on('paymentComplete', (result) => {
  console.log('Payment successful!', result);
});
```

## Security

- **PCI DSS Compliant**: All card data handled securely
- **No Local Storage**: Card numbers never stored locally
- **Encrypted Communication**: HTTPS required for production
- **Tokenization**: Use payment tokens, not raw card data
- **Audit Logging**: All transactions logged

## Performance

- **Print Queue**: Prevents print collisions
- **Async Operations**: UI never blocked
- **Auto Reconnect**: Automatic recovery from disconnects
- **Caching**: Hardware status cached for quick access
- **Optimized ESC/POS**: Minimal command overhead

## Troubleshooting

### Common Issues

#### Printer not detected
```bash
# Check USB connection
lsusb | grep -i epson

# Check printer status
lpstat -p

# Restart USB
sudo usbd restart
```

#### Card reader timeout
```javascript
// Increase timeout
await paymentService.waitForCardSwipe(60000); // 60 seconds
```

#### Cash drawer won't open
```bash
# Test printer self-test
# 1. Turn off printer
# 2. Hold feed button
# 3. Turn on while holding
# 4. Printer prints self-test page
```

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| WebUSB | ✅ | ⚠️ | ❌ | ✅ |
| WebBluetooth | ✅ | ❌ | ❌ | ✅ |
| ESC/POS Print | ✅ | ✅ | ✅ | ✅ |

## Support

For technical support:
1. Check browser console for errors
2. Verify hardware connections
3. Test with known working devices
4. Contact support team
