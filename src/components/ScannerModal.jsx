import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, RefreshCw, X, Flashlight, Keyboard, AlertCircle } from 'lucide-react';
import { playScanBeep, playWarningBeep } from '../utils/audio';

export const ScannerModal = ({ isOpen, onClose, onScanSuccess }) => {
  const [cameras, setCameras] = useState([]);
  const [currentCameraId, setCurrentCameraId] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  
  const scannerRef = useRef(null);
  const html5QrcodeRef = useRef(null);

  // Inicializar cámaras al abrir el modal
  useEffect(() => {
    if (!isOpen) return;

    setScanError(null);

    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Preferir cámara trasera ('back' o 'environment')
          const backCamera = devices.find(device => 
            device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('trasera') ||
            device.label.toLowerCase().includes('posterior') ||
            device.label.toLowerCase().includes('environment')
          );
          const selectedId = backCamera ? backCamera.id : devices[0].id;
          setCurrentCameraId(selectedId);
          startScanner(selectedId);
        } else {
          setScanError('No se encontraron cámaras disponibles en este dispositivo.');
        }
      })
      .catch(err => {
        console.error("Error al obtener cámaras:", err);
        setScanError('Permiso de cámara denegado o cámara no disponible. Por favor permite el acceso a la cámara en el navegador.');
      });

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = (cameraId) => {
    stopScanner().then(() => {
      if (!scannerRef.current) return;

      const html5Qrcode = new Html5Qrcode("reader-region", {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false
      });

      html5QrcodeRef.current = html5Qrcode;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 160 },
        aspectRatio: 1.333334
      };

      html5Qrcode.start(
        cameraId,
        config,
        (decodedText, decodedResult) => {
          // Éxito al escanear
          playScanBeep();
          onScanSuccess(decodedText.trim());
          // Breve pausa para no sobreescanear repetidamente la misma etiqueta
        },
        (errorMessage) => {
          // Errores de frame no legibles se ignoran silenciosamente
        }
      )
      .then(() => {
        setIsScanning(true);
      })
      .catch((err) => {
        console.error("No se pudo iniciar el escáner:", err);
        setScanError("No se pudo iniciar el escáner en esta cámara. Intenta cambiar de cámara.");
      });
    });
  };

  const stopScanner = async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
        html5QrcodeRef.current.clear();
      } catch (e) {
        console.warn("Error al detener el escáner:", e);
      } finally {
        html5QrcodeRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.id === currentCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCameraId = cameras[nextIndex].id;
    setCurrentCameraId(nextCameraId);
    startScanner(nextCameraId);
  };

  const toggleTorch = async () => {
    if (!html5QrcodeRef.current || !isScanning) return;
    try {
      const capabilities = html5QrcodeRef.current.getRunningTrackCapabilities();
      if (capabilities.torch) {
        const nextState = !torchOn;
        await html5QrcodeRef.current.applyVideoConstraints({
          advanced: [{ torch: nextState }]
        });
        setTorchOn(nextState);
      } else {
        alert("El flash / linterna no está disponible en la cámara seleccionada.");
      }
    } catch (e) {
      console.warn("Torch no soportado:", e);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    playScanBeep();
    onScanSuccess(manualCode.trim());
    setManualCode('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Cabecera Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">Escáner de Cámara</h3>
              <p className="text-xs text-slate-400">Apunta el código de barras dentro del recuadro</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Área del Escáner de Video */}
        <div className="relative bg-black flex-1 min-h-[280px] flex items-center justify-center overflow-hidden">
          <div id="reader-region" ref={scannerRef} className="w-full h-full"></div>

          {scanError && (
            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center z-20">
              <AlertCircle className="w-12 h-12 text-rose-500 mb-3 animate-bounce" />
              <p className="text-slate-200 text-sm font-medium mb-4 max-w-xs">{scanError}</p>
              <button
                onClick={() => currentCameraId && startScanner(currentCameraId)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Reintentar Permiso
              </button>
            </div>
          )}

          {/* Botones de Control Flotantes en la Cámara */}
          <div className="absolute top-3 right-3 z-10 flex gap-2">
            {cameras.length > 1 && (
              <button
                onClick={handleSwitchCamera}
                title="Cambiar Cámara"
                className="p-3 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full backdrop-blur-md border border-slate-700 shadow-lg"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={toggleTorch}
              title="Encender Linterna"
              className={`p-3 rounded-full backdrop-blur-md border shadow-lg transition-colors ${
                torchOn 
                  ? 'bg-amber-500 text-slate-950 border-amber-400' 
                  : 'bg-slate-900/80 text-white border-slate-700 hover:bg-slate-800'
              }`}
            >
              <Flashlight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Entrada Manual de Respaldo */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Keyboard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Escribir código manualmente (o usar pistola USB)..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 text-white text-sm rounded-xl pl-10 pr-3 py-2.5 focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-emerald-900/20"
            >
              Procesar
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
