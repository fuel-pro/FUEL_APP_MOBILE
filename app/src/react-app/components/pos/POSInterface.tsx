// POS Hardware Interface Component
import React, { useState, useEffect, useCallback } from 'react';
import { hardwareManager, type PrinterDevice, type CardReaderDevice, type CashDrawerDevice, type BarcodeScannerDevice } from '@/react-app/lib/pos/hardware-manager';
import { printerService } from '@/react-app/lib/pos/printer-service';
import { paymentService } from '@/react-app/lib/pos/payment-service';
import { useAuth } from '@/react-app/context/AuthContext';
import { useFuel } from '@/react-app/context/FuelContext';
import { useLocation } from '@/react-app/context/LocationContext';
import { 
  Printer, 
  CreditCard, 
  CircleDollarSign,
  ScanLine, 
  Bluetooth,
  Usb,
  Wifi,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  User,
  MapPin,
  Building2
} from 'lucide-react';

interface DeviceStatusProps {
  device: { name: string; type: string; status: string };
  onRemove?: () => void;
}

function DeviceStatus({ device }: DeviceStatusProps) {
  const statusColor = device.status === 'connected' ? 'text-green-600' : 
                      device.status === 'waiting_for_card' ? 'text-yellow-600' : 'text-red-600';
  const StatusIcon = device.status === 'connected' ? CheckCircle : 
                    device.status === 'waiting_for_card' ? RefreshCw : XCircle;

  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
      <div className="flex items-center gap-3">
        <StatusIcon className={`w-5 h-5 ${statusColor}`} />
        <div>
          <p className="font-medium">{device.name}</p>
          <p className="text-sm text-gray-500">{device.type}</p>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ icon: Icon, label, count, color }: { icon: any; label: string; count: number; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center gap-3">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-2xl font-bold">{count}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function POSInterface() {
  // Get context data for existing logged-in users
  const { user, bindings } = useAuth();
  const { state } = useFuel();
  const location = useLocation();
  
  // Get station info from context
  const currentStation = location.currentLocation;
  const companyData = state.companyData;
  const userBindings = bindings || [];
  
  const [devices, setDevices] = useState({
    printers: [] as PrinterDevice[],
    cardReaders: [] as CardReaderDevice[],
    cashDrawers: [] as CashDrawerDevice[],
    barcodeScanners: [] as BarcodeScannerDevice[],
  });
  const [networkPrinterIP, setNetworkPrinterIP] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | 'pending'>>({});

  const refreshDevices = useCallback(() => {
    setDevices({
      printers: hardwareManager.getAllPrinters(),
      cardReaders: hardwareManager.getAllCardReaders(),
      cashDrawers: hardwareManager.getAllCashDrawers(),
      barcodeScanners: hardwareManager.getAllBarcodeScanners(),
    });
  }, []);

  useEffect(() => {
    refreshDevices();

    hardwareManager.on('printerConnected', refreshDevices);
    hardwareManager.on('printerDisconnected', refreshDevices);
    hardwareManager.on('cardReaderConnected', refreshDevices);
    hardwareManager.on('cardReaderDisconnected', refreshDevices);
    hardwareManager.on('cashDrawerConnected', refreshDevices);
    hardwareManager.on('cashDrawerDisconnected', refreshDevices);
    hardwareManager.on('barcodeScannerConnected', refreshDevices);
    hardwareManager.on('barcodeScannerDisconnected', refreshDevices);

    return () => {
      hardwareManager.removeAllListeners();
    };
  }, [refreshDevices]);

  const handleScanUSB = async () => {
    setIsScanning(true);
    try {
      await hardwareManager.scanUSBDevices();
    } catch (error) {
      console.error('USB scan failed:', error);
    }
    setIsScanning(false);
    refreshDevices();
  };

  const handleScanBluetooth = async () => {
    setIsScanning(true);
    try {
      await hardwareManager.scanBluetoothDevices();
    } catch (error) {
      console.error('Bluetooth scan failed:', error);
    }
    setIsScanning(false);
    refreshDevices();
  };

  const handleAddNetworkPrinter = async () => {
    if (!networkPrinterIP) return;
    
    try {
      await hardwareManager.addNetworkPrinter(networkPrinterIP, 9100);
      setNetworkPrinterIP('');
      refreshDevices();
    } catch (error) {
      console.error('Failed to add network printer:', error);
    }
  };

  const handleTestPrinter = async (printerId: string) => {
    setTestResults(prev => ({ ...prev, [printerId]: 'pending' }));
    try {
      await printerService.testPrint(printerId);
      setTestResults(prev => ({ ...prev, [printerId]: 'success' }));
    } catch {
      setTestResults(prev => ({ ...prev, [printerId]: 'error' }));
    }
  };

  const handleOpenCashDrawer = async () => {
    try {
      await printerService.openCashDrawer();
    } catch (error) {
      console.error('Failed to open cash drawer:', error);
    }
  };

  const handleTestCardReader = async () => {
    try {
      await paymentService.simulateCardPayment(10, 'KES');
    } catch (error) {
      console.error('Card reader test failed:', error);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">POS Hardware Setup</h1>
        <p className="text-gray-600">Configure your point-of-sale hardware devices</p>
      </div>

      {/* Current User & Station Info - Works for existing logged-in users */}
      {(user || currentStation) && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6 border border-blue-100">
          <div className="flex flex-wrap gap-6">
            {user && (
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{user.name || user.email}</p>
                  <p className="text-xs text-gray-500">
                    {user.role && <span className="capitalize">{user.role}</span>}
                    {user.authMethod && <span> • {user.authMethod}</span>}
                  </p>
                </div>
              </div>
            )}
            {currentStation && (
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{currentStation.name || 'Current Station'}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {currentStation.location || 'Location not set'}
                  </p>
                </div>
              </div>
            )}
            {userBindings.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                  {userBindings.length} station{userBindings.length > 1 ? 's' : ''} accessible
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connection Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatusCard icon={Printer} label="Printers" count={devices.printers.length} color="blue" />
        <StatusCard icon={CreditCard} label="Card Readers" count={devices.cardReaders.length} color="green" />
        <StatusCard icon={CircleDollarSign} label="Cash Drawers" count={devices.cashDrawers.length} color="yellow" />
        <StatusCard icon={ScanLine} label="Scanners" count={devices.barcodeScanners.length} color="purple" />
      </div>

      {/* Add Devices */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Add Devices</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleScanUSB}
            disabled={isScanning}
            className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition disabled:opacity-50"
          >
            <Usb className="w-6 h-6 text-gray-600" />
            <span>{isScanning ? 'Scanning...' : 'Scan USB'}</span>
          </button>

          <button
            onClick={handleScanBluetooth}
            disabled={isScanning}
            className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition disabled:opacity-50"
          >
            <Bluetooth className="w-6 h-6 text-gray-600" />
            <span>{isScanning ? 'Scanning...' : 'Scan Bluetooth'}</span>
          </button>

          <div className="flex items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg">
            <Wifi className="w-6 h-6 text-gray-600" />
            <input
              type="text"
              placeholder="Printer IP (e.g., 192.168.1.100)"
              value={networkPrinterIP}
              onChange={(e) => setNetworkPrinterIP(e.target.value)}
              className="flex-1 border-none outline-none text-sm"
            />
            <button
              onClick={handleAddNetworkPrinter}
              disabled={!networkPrinterIP}
              className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Connected Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Printers */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Printers
            </h2>
            <button onClick={refreshDevices} className="p-2 hover:bg-gray-100 rounded">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            {devices.printers.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No printers connected</p>
            ) : (
              devices.printers.map((printer) => (
                <DeviceStatus key={printer.id} device={printer} />
              ))
            )}
          </div>

          {devices.printers.length > 0 && (
            <button
              onClick={() => handleTestPrinter(devices.printers[0].id)}
              className="mt-4 w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Test Print
            </button>
          )}
        </div>

        {/* Card Readers */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Card Readers
            </h2>
          </div>
          
          <div className="space-y-3">
            {devices.cardReaders.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No card readers connected</p>
            ) : (
              devices.cardReaders.map((reader) => (
                <DeviceStatus key={reader.id} device={reader} />
              ))
            )}
          </div>

          {devices.cardReaders.length > 0 && (
            <button
              onClick={handleTestCardReader}
              className="mt-4 w-full py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              Test Card Reader
            </button>
          )}
        </div>

        {/* Cash Drawers */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CircleDollarSign className="w-5 h-5" />
              Cash Drawers
            </h2>
          </div>
          
          <div className="space-y-3">
            {devices.cashDrawers.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No cash drawers connected</p>
            ) : (
              devices.cashDrawers.map((drawer) => (
                <DeviceStatus key={drawer.id} device={drawer} />
              ))
            )}
          </div>

          <button
            onClick={handleOpenCashDrawer}
            className="mt-4 w-full py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
          >
            Open Cash Drawer
          </button>
        </div>

        {/* Barcode Scanners */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ScanLine className="w-5 h-5" />
              Barcode Scanners
            </h2>
          </div>
          
          <div className="space-y-3">
            {devices.barcodeScanners.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 mb-2">No scanners detected</p>
                <p className="text-sm text-gray-400">Keyboard wedge scanners are auto-detected</p>
              </div>
            ) : (
              devices.barcodeScanners.map((scanner) => (
                <DeviceStatus key={scanner.id} device={scanner} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Test Results</h2>
          <div className="space-y-2">
            {Object.entries(testResults).map(([printerId, result]) => (
              <div key={printerId} className="flex items-center gap-2">
                {result === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
                {result === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
                {result === 'pending' && <RefreshCw className="w-5 h-5 text-yellow-600 animate-spin" />}
                <span>
                  {result === 'success' ? 'Test print successful' : 
                   result === 'error' ? 'Test print failed' : 'Printing...'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="mt-6 bg-blue-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Setup Tips
        </h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
          <li>Connect USB printers before clicking "Scan USB"</li>
          <li>For network printers, ensure they're on the same network</li>
          <li>Card readers should be in HID mode for web support</li>
          <li>Keyboard wedge scanners work automatically (no setup needed)</li>
          <li>Grant USB/Bluetooth permissions when prompted by your browser</li>
        </ul>
      </div>
    </div>
  );
}
