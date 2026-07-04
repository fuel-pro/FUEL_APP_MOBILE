# POS Hardware Compatibility

## Tested & Supported Devices

### Thermal Printers
- ✅ Epson TM-T20II/TM-T88V/TM-T82III
- ✅ Star Micronics TSP100/TSP650
- ✅ Bixolon SRP-350/SRP-352
- ✅ Generic ESC/POS printers (USB & Network)
- ✅ Zjiang POS-58/POS-80
- ✅ Custom Thermal K1/K2

### Card Readers
- ✅ ID Tech MagStripe readers
- ✅ SwipeSimple readers
- ✅ Square Reader (via WebUSB)
- ✅ Generic HID card readers
- ✅ Bluetooth card readers (limited)

### Cash Drawers
- ✅ Any drawer connected via printer (RJ11/RJ12)
- ✅ APG cash drawers
- ✅ Star Micronics cash drawers

### Barcode Scanners
- ✅ All keyboard emulation scanners
- ✅ USB scanners (HID mode)
- ✅ Bluetooth scanners
- ✅ 1D/2D scanners

### Customer Displays
- ✅ Bixolon customer displays
- ✅ FTDI-based displays
- ✅ Serial/USB VFD displays

## Browser Requirements

| Browser | WebUSB | WebBluetooth | Status |
|---------|--------|-------------|--------|
| Chrome 89+ | ✅ | ✅ | Full Support |
| Edge 89+ | ✅ | ✅ | Full Support |
| Opera 75+ | ✅ | ✅ | Full Support |
| Firefox 100+ | ⚠️ | ❌ | Limited (flags) |
| Safari 15+ | ❌ | ❌ | Not Supported |

## Setup Instructions

### Windows
1. Install Zadig driver for USB devices
2. Replace driver with WinUSB/libusb
3. Grant USB permissions in browser

### Linux
```bash
# Create udev rules:
sudo nano /etc/udev/rules.d/99-pos-devices.rules

# Add:
SUBSYSTEM=="usb", ATTR{idVendor}=="04b8", MODE="0666"
SUBSYSTEM=="usb", ATTR{idVendor}=="0416", MODE="0666"
SUBSYSTEM=="usb", ATTR{idVendor}=="076b", MODE="0666"

# Reload:
sudo udevadm control --reload-rules
```

### macOS
1. No driver installation needed
2. Grant permissions when prompted
3. May need to run as administrator

## Network Printer Setup

1. Configure printer with static IP
2. Default port: 9100 (RAW)
3. Alternative: 515 (LPR) or 631 (IPP)
4. Test: `telnet <printer-ip> 9100`

## USB Vendor IDs

| Vendor | Brand |
|--------|-------|
| 0x04b8 | Epson |
| 0x0416 | Winbond/NPC |
| 0x04a9 | Canon |
| 0x076b | MagTek |
| 0x0c15 | MagTek |
| 0x0dd0 | Generic |

## Troubleshooting

### Printer Not Detected
1. Check USB cable connection
2. Install correct drivers
3. Try different USB port
4. Restart printer

### Card Reader Not Working
1. Ensure reader is in HID mode
2. Check browser permissions
3. Try incognito mode
4. Update reader firmware

### Cash Drawer Not Opening
1. Verify drawer is connected to printer
2. Check drawer cable (RJ11/RJ12)
3. Test with printer self-test
4. Verify voltage (24V typical)

### Permission Denied
1. Grant USB permissions in browser
2. Check OS-level permissions
3. Run browser as admin (Windows)
4. Configure udev rules (Linux)
