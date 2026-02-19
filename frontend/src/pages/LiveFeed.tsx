import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Activity, Camera, Zap, Shield, Play, CheckCircle } from 'lucide-react';
import { cameraApi, type Camera as CameraType } from '../services/api';
import FuturisticCard from '../components/FuturisticCard';
import SeverityGauge from '../components/SeverityGauge';
import AlertBadge from '../components/AlertBadge';

export default function LiveFeed() {
    const [cameras, setCameras] = useState<CameraType[]>([]);
    const [selectedCamera, setSelectedCamera] = useState<string>('webcam');
    const [isDetecting, setIsDetecting] = useState(false);
    const [confidence, setConfidence] = useState(0);
    const [isAccident, setIsAccident] = useState(false);
    const [severityLabel, setSeverityLabel] = useState<string>('');
    const [frameCount, setFrameCount] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        cameraApi.list().then(setCameras).catch(console.error);
    }, []);

    const startWebcam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
            setIsDetecting(true);
            startFrameCapture();
        } catch (e) {
            alert('Could not access webcam: ' + (e as Error).message);
        }
    };

    const stopWebcam = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsDetecting(false);
        setConfidence(0);
        setIsAccident(false);
    };

    const startFrameCapture = useCallback(() => {
        intervalRef.current = setInterval(async () => {
            if (!videoRef.current || !canvasRef.current) return;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            canvas.width = videoRef.current.videoWidth || 640;
            canvas.height = videoRef.current.videoHeight || 480;
            ctx.drawImage(videoRef.current, 0, 0);

            const b64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

            try {
                const form = new FormData();
                form.append('frame_b64', b64);
                form.append('camera_id', selectedCamera);

                const res = await fetch('/api/detect/live-frame', { method: 'POST', body: form });
                if (res.ok) {
                    const data = await res.json();
                    setConfidence(data.confidence || 0);
                    setIsAccident(data.accident_detected || false);
                    setSeverityLabel(data.severity_label || '');
                    setFrameCount(c => c + 1);
                }
            } catch {
                // network error
            }
        }, 1000); // 1 FPS
    }, [selectedCamera]);

    useEffect(() => {
        return () => stopWebcam();
    }, []);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="font-orbitron text-cyan text-xl">LIVE DEPLOYMENT Feed</h2>
                    <p className="text-sm text-secondary mt-1">Real-time edge inference & emergency dispatch link</p>
                </div>
                {isDetecting && (
                    <div className="live-badge !bg-danger/20 border-danger/40">
                        <span className="status-dot online animate-pulse" /> AI SCANNER ACTIVE
                    </div>
                )}
            </div>

            <div className="page-content">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Feed */}
                    <div className="lg:col-span-2 space-y-6">
                        <FuturisticCard accent={isAccident ? 'danger' : 'cyan'} className="p-0 overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b border-border bg-glass">
                                <div className="flex items-center gap-3">
                                    <Camera size={18} className="text-cyan" />
                                    <select
                                        className="form-select text-xs font-bold"
                                        value={selectedCamera}
                                        onChange={e => setSelectedCamera(e.target.value)}
                                        disabled={isDetecting}
                                        style={{ width: 'auto' }}
                                    >
                                        <option value="webcam">INTEGRATED WEBCAM</option>
                                        {cameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <button
                                    className={`btn ${isDetecting ? 'btn-danger' : 'btn-primary'} btn-sm px-6`}
                                    onClick={isDetecting ? stopWebcam : startWebcam}
                                >
                                    {isDetecting ? 'DEACTIVATE' : 'ACTIVATE AI SCAN'}
                                </button>
                            </div>

                            <div className="relative aspect-video bg-[#050505] flex items-center justify-center overflow-hidden">
                                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                                <canvas ref={canvasRef} className="hidden" />

                                {!isDetecting && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm z-10">
                                        <div className="w-16 h-16 rounded-full border border-cyan/30 flex items-center justify-center bg-cyan/5">
                                            <Play size={24} className="text-cyan ml-1" />
                                        </div>
                                        <p className="font-orbitron text-[10px] text-cyan uppercase tracking-widest animate-pulse">Waiting for activation...</p>
                                    </div>
                                )}

                                {/* AI Overlays */}
                                <AnimatePresence>
                                    {isAccident && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className="absolute top-6 left-6 right-6 z-20"
                                        >
                                            <div className="bg-danger/90 backdrop-blur-md rounded-lg p-4 border border-white/20 shadow-glow-danger flex items-center gap-4">
                                                <AlertTriangle size={24} className="text-white animate-bounce" />
                                                <div>
                                                    <h4 className="font-orbitron text-sm text-white font-black uppercase tracking-tighter">Accident Detected - Immediate Action Required</h4>
                                                    <p className="text-[10px] text-white/80 font-bold">Location: {cameras.find(c => c.id === selectedCamera)?.location_name || 'Webcam Node'}</p>
                                                </div>
                                                <div className="ml-auto flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full border border-white/30">
                                                    <Zap size={14} className="text-white" />
                                                    <span className="text-xs font-bold text-white">{Math.round(confidence * 100)}%</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* HUD Elements */}
                                {isDetecting && (
                                    <>
                                        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                                            <div className="px-2 py-1 bg-black/40 border border-white/10 rounded text-[9px] font-mono text-white/60">
                                                FPS: 1.0 (CLOUD SYNC)
                                            </div>
                                            <div className="px-2 py-1 bg-black/40 border border-white/10 rounded text-[9px] font-mono text-white/60 uppercase">
                                                Frame: {frameCount}
                                            </div>
                                        </div>

                                        {/* Scanning Animation */}
                                        <div className="absolute inset-0 pointer-events-none overflow-hidden border-2 border-cyan/10">
                                            <motion.div
                                                className="w-full h-[2px] bg-cyan/30 shadow-glow-cyan"
                                                animate={{ top: ['0%', '100%', '0%'] }}
                                                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                                                style={{ position: 'absolute', left: 0 }}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </FuturisticCard>

                        <FuturisticCard title="EDGE PIPELINE LOGS" icon={<Activity size={18} />}>
                            <div className="bg-black/40 rounded border border-border p-4 font-mono text-[10px] space-y-2 h-32 overflow-y-auto custom-scrollbar">
                                <div className="text-success">[SYSTEM] Edge node initialized. Model build: YOLO-v8-RoadNet</div>
                                <div className="text-cyan">[INTEL] Camera source validated: {selectedCamera}</div>
                                {isDetecting && <div className="text-warning">[PROC] Inference cycle starting. Confidence threshold: 0.55</div>}
                                {frameCount > 0 && <div className="text-muted">[RAW] Frame sync successful. Buffering next packet...</div>}
                                {isAccident && <div className="text-danger font-bold">[ALERT] HIGH CONFIDENCE COLLISION DETECTED. SMS DISPATCH TRIGGERED.</div>}
                            </div>
                        </FuturisticCard>
                    </div>

                    {/* Controls Sidebar */}
                    <div className="space-y-6">
                        <FuturisticCard title="REAL-TIME CONFIDENCE" icon={<Zap size={18} />}>
                            <div className="py-4">
                                <SeverityGauge level={confidence} label="Detection Probabilty" />
                                <div className="mt-6 p-4 bg-secondary rounded-lg border border-border text-center">
                                    <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-2">Analysis State</div>
                                    <AlertBadge
                                        type={isAccident ? 'critical' : isDetecting ? 'info' : 'muted'}
                                        label={isAccident ? 'THRESHOLD REACHED' : isDetecting ? 'MONITORING' : 'READY'}
                                    />
                                </div>
                            </div>
                        </FuturisticCard>

                        <FuturisticCard title="SEVERITY CLASSIFICATION" icon={<Shield size={18} />}>
                            <div className="space-y-4 py-2">
                                {[
                                    { id: 'minor', label: 'Minor Impact', v: 1 },
                                    { id: 'substantial', label: 'Substantial', v: 2 },
                                    { id: 'critical', label: 'Critical Failure', v: 3 },
                                ].map(s => (
                                    <div key={s.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isAccident && severityLabel.toLowerCase().includes(s.id)
                                        ? `bg-${s.id === 'minor' ? 'warning' : 'danger'}/20 border-${s.id === 'minor' ? 'warning' : 'danger'}/50`
                                        : 'bg-secondary border-border opacity-50'
                                        }`}>
                                        <span className="text-xs font-bold uppercase tracking-widest">{s.label}</span>
                                        {isAccident && severityLabel.toLowerCase().includes(s.id) && <CheckCircle size={14} className="text-white" />}
                                    </div>
                                ))}
                            </div>
                        </FuturisticCard>

                        <FuturisticCard title="AUTO-DISPATCH PROTOCOL" accent="success">
                            <div className="space-y-4">
                                <p className="text-[11px] text-secondary leading-relaxed">
                                    The system is configured to automatically trigger emergency alerts when detection confidence exceeds <span className="text-cyan font-bold">55%</span>.
                                </p>
                                <div className="p-3 rounded bg-success/10 border border-success/30 flex items-center gap-3">
                                    <Shield size={16} className="text-success" />
                                    <span className="text-[10px] font-black text-success uppercase tracking-tighter">Forensic Encryption: ACTIVE</span>
                                </div>
                            </div>
                        </FuturisticCard>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
