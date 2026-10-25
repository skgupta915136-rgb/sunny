import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  X,
  RotateCw,
  FileText,
  Eye,
  Sparkles,
  Check,
  AlertCircle,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';
import { Attachment } from '../types';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureAndSend: (prompt: string, attachment: Attachment) => void;
}

export type VisionScanMode = 'ocr' | 'object' | 'general';

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCaptureAndSend,
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<VisionScanMode>('ocr');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Start camera when modal opens or facing mode toggles
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedImage(null);
      setErrorMessage('');
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    setIsInitializing(true);
    setErrorMessage('');
    stopCamera();

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      // Fallback without specific facingMode
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play();
        }
      } catch (fbErr: any) {
        setErrorMessage('कैमरा एक्सेस की अनुमति नहीं मिल सकी। कृपया ब्राउज़र सेटिंग्स में कैमरा की अनुमति दें।');
      }
    } finally {
      setIsInitializing(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setCapturedImage(ev.target.result);
        stopCamera();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleSendToSara = () => {
    if (!capturedImage) return;

    let prompt = '';
    if (scanMode === 'ocr') {
      prompt =
        'सारा, इस फोटो में लिखे हुए टेक्स्ट, किताब, सवाल या पर्ची को बहुत ध्यान से पढ़िए, बताइए इसमें क्या लिखा है और इसका पूरा विषय सरल और स्पष्ट रूप से समझाइए।';
    } else if (scanMode === 'object') {
      prompt =
        'सारा, इस तस्वीर में दिख रही वस्तु, पौधे, जीव या दृश्य को पहचानिए, बताइए इसमें क्या है और इस पूरे विषय को रोचक व ज्ञानवर्धक तरीके से समझाइए।';
    } else {
      prompt =
        'सारा, इस फोटो को बहुत ध्यान से देखकर बताइए कि इसमें क्या-क्या दिख रहा है, और इस पूरे विषय (Topic) को अच्छे से विस्तार से समझाइए।';
    }

    const attachment: Attachment = {
      id: `cam-${Date.now()}`,
      name: `snapshot-${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      data: capturedImage,
      type: 'image',
    };

    onCaptureAndSend(prompt, attachment);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>सारा कैमरा & विज़न</span>
                <span className="text-[11px] font-normal text-rose-300 font-serif">
                  (Vision & OCR)
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                फोटो खींचिए और सारा से तुरंत समझाइए
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scan Mode Selector */}
        <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-950/40 border-b border-slate-800/80 text-xs font-medium">
          <button
            onClick={() => setScanMode('ocr')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl transition-all ${
              scanMode === 'ocr'
                ? 'bg-rose-500/20 border border-rose-500/50 text-rose-200 font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-rose-400" />
            <span>दस्तावेज़ / बिल OCR</span>
          </button>
          <button
            onClick={() => setScanMode('object')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl transition-all ${
              scanMode === 'object'
                ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>वस्तु / पौधा पहचानें</span>
          </button>
          <button
            onClick={() => setScanMode('general')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl transition-all ${
              scanMode === 'general'
                ? 'bg-sky-500/20 border border-sky-500/50 text-sky-200 font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-sky-400" />
            <span>सामान्य फोटो</span>
          </button>
        </div>

        {/* Viewfinder or Preview Area */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[320px] overflow-hidden">
          {errorMessage ? (
            <div className="p-6 text-center max-w-sm">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <p className="text-xs sm:text-sm text-slate-300">{errorMessage}</p>
              <button
                onClick={startCamera}
                className="mt-4 px-4 py-2 rounded-full bg-rose-600 text-white text-xs font-semibold"
              >
                पुनः प्रयास करें
              </button>
            </div>
          ) : capturedImage ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={capturedImage}
                alt="Captured preview"
                className="max-h-[380px] w-auto object-contain rounded-lg shadow-xl"
              />
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-xs text-emerald-300 font-medium flex items-center gap-1.5 border border-emerald-500/30">
                <Check className="w-3.5 h-3.5" />
                <span>फोटो ली गई</span>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-full object-cover max-h-[380px]"
              />

              {/* Viewfinder Target Overlay */}
              <div className="absolute inset-8 border-2 border-dashed border-rose-400/40 rounded-2xl pointer-events-none flex items-center justify-center">
                <div className="text-[11px] text-white/80 bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
                  {scanMode === 'ocr'
                    ? 'किताब, पर्ची या बिल को बीच में रखें'
                    : scanMode === 'object'
                    ? 'वस्तु, पौधे या गाड़ी पर फोकस करें'
                    : 'कैमरा फोकस करें'}
                </div>
              </div>

              {/* Camera Switcher Button */}
              <button
                onClick={toggleFacingMode}
                className="absolute top-4 right-4 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/80 shadow-lg backdrop-blur-md transition-all active:scale-90"
                title="कैमरा बदलें (Switch Camera)"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Hidden Canvas for Frame Capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-3">
          {capturedImage ? (
            <>
              <button
                onClick={handleRetake}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>दोबारा लें</span>
              </button>

              <button
                onClick={handleSendToSara}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-rose-950 transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>
                  {scanMode === 'ocr'
                    ? 'सारा से पढ़वाएं (Read Text)'
                    : scanMode === 'object'
                    ? 'पहचानें (Identify Object)'
                    : 'सारा को भेजें (Analyze)'}
                </span>
              </button>
            </>
          ) : (
            <div className="w-full flex items-center justify-center gap-6">
              {/* Hidden file input for uploading photo from phone gallery or PC */}
              <input
                type="file"
                ref={galleryInputRef}
                onChange={handleGalleryUpload}
                accept="image/*"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all text-[11px]"
                title="फोन की गैलरी से फोटो चुनें"
              >
                <ImageIcon className="w-5 h-5 text-rose-400" />
                <span>गैलरी फोटो</span>
              </button>

              <button
                onClick={handleCapture}
                disabled={isInitializing || !!errorMessage}
                className="flex items-center justify-center gap-2 p-4 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 hover:scale-105 active:scale-95 text-white shadow-xl shadow-rose-950 border-4 border-slate-800 transition-all disabled:opacity-50"
                title="फोटो खींचिए"
              >
                <Camera className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
