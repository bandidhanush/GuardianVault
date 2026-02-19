import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    Upload, FileText, CheckCircle, AlertTriangle,
    Settings, Database, Smartphone, Shield, X, MapPin,
    RefreshCw, Play, Search, ArrowRight, Activity
} from 'lucide-react';
import { detectionApi, cameraApi, type Camera } from '../services/api';
import FuturisticCard from '../components/FuturisticCard';
import AlertBadge from '../components/AlertBadge';
import SeverityGauge from '../components/SeverityGauge';

type PipelineStep = 'uploading' | 'preprocessing' | 'detecting' | 'analyzing' | 'encrypting' | 'completed';

export default function UploadVideo() {
    const [file, setFile] = useState<File | null>(null);
    const [cameras, setCameras] = useState<Camera[]>([]);
    const [selectedCamera, setSelectedCamera] = useState<string>('');
    const [customLocation, setCustomLocation] = useState('');

    const [step, setStep] = useState<PipelineStep | null>(null);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        cameraApi.list().then(setCameras).catch(console.error);
    }, []);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
            setError(null);
            setResult(null);
            setStep(null);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'video/*': ['.mp4', '.avi', '.mov'] },
        multiple: false
    });

    const runAnalysis = async () => {
        if (!file) return;

        setStep('uploading');
        setProgress(0);
        setError(null);

        try {
            const res = await detectionApi.uploadVideo(file, {
                camera_id: selectedCamera || undefined,
                location_name: customLocation || undefined
            }, (pct) => {
                setProgress(pct);
                if (pct < 100) {
                    setStep('uploading');
                } else {
                    const steps: PipelineStep[] = ['preprocessing', 'detecting', 'analyzing', 'encrypting'];
                    let current = 0;
                    const stepInterval = setInterval(() => {
                        if (current < steps.length) {
                            setStep(steps[current]);
                            current++;
                        } else {
                            clearInterval(stepInterval);
                        }
                    }, 800);
                }
            });

            setProgress(100);
            setResult(res);
            setStep('completed');
        } catch (e: any) {
            setError(e.response?.data?.detail || 'Analysis pipeline failed');
            setStep(null);
        }
    };

    const PipelineStatus = ({ currentStep, targetStep, label, icon }: { currentStep: PipelineStep | null, targetStep: PipelineStep, label: string, icon: any }) => {
        const steps: PipelineStep[] = ['uploading', 'preprocessing', 'detecting', 'analyzing', 'encrypting', 'completed'];
        const currentIdx = steps.indexOf(currentStep as PipelineStep);
        const targetIdx = steps.indexOf(targetStep);

        const isCompleted = currentIdx > targetIdx || (currentStep === 'completed' && targetStep !== 'completed') || (currentStep === 'completed' && targetStep === 'completed');
        const isActive = currentStep === targetStep;

        return (
            <div className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isActive ? 'bg-cyan/10 border border-cyan/30 shadow-glow-cyan' : isCompleted ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isCompleted ? 'bg-success/20 text-success' : isActive ? 'bg-cyan/20 text-cyan animate-pulse' : 'bg-secondary'}`}>
                    {isCompleted ? <CheckCircle size={20} /> : icon}
                </div>
                <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted">{isCompleted ? 'System Verified' : isActive ? 'Engaged' : 'Standby'}</div>
                    <div className={`text-xs font-bold ${isActive ? 'text-cyan' : 'text-secondary'}`}>{label}</div>
                </div>
                {isActive && (
                    <div className="ml-auto">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan animate-ping" />
                    </div>
                )}
            </div>
        );
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="font-orbitron text-cyan text-xl">INGESTION ENGINE</h2>
                    <p className="text-sm text-secondary mt-1">Upload video clusters for deep hierarchical analysis</p>
                </div>
                {step && (
                    <div className="flex items-center gap-4 bg-secondary/50 px-4 py-2 rounded-full border border-border">
                        <span className="text-[10px] font-black text-cyan uppercase tracking-widest">Pipeline Health</span>
                        <div className="w-32 h-1.5 bg-black/20 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                className="h-full bg-cyan shadow-glow-cyan"
                            />
                        </div>
                        <span className="text-[10px] font-mono text-cyan">{progress}%</span>
                    </div>
                )}
            </div>

            <div className="page-content">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        {!result ? (
                            <FuturisticCard className="!p-0 overflow-hidden">
                                <div {...getRootProps()} className={`upload-zone !border-0 !rounded-none min-h-[400px] flex flex-col items-center justify-center ${isDragActive ? 'bg-cyan/10' : ''}`}>
                                    <input {...getInputProps()} />
                                    <div className="w-20 h-20 rounded-full bg-cyan/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        <Upload size={32} className="text-cyan" />
                                    </div>
                                    {file ? (
                                        <div className="text-center">
                                            <h3 className="text-lg font-bold text-white mb-2">{file.name}</h3>
                                            <p className="text-xs text-muted font-mono">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                            <button
                                                className="btn btn-ghost btn-sm mt-6 gap-2"
                                                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                            >
                                                <X size={14} /> REMOVE FILE
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <h3 className="text-lg font-orbitron text-white mb-2 tracking-widest">DRAG & DROP FOOTAGE</h3>
                                            <p className="text-sm text-secondary">MP4, AVI, or MOV source files accepted</p>
                                            <div className="mt-8 px-6 py-2 border border-white/10 rounded-full text-[10px] font-black text-muted uppercase tracking-tighter">
                                                Secure SSL Uplink Active
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 bg-glass border-t border-border flex flex-col sm:flex-row gap-4 items-end sm:items-center">
                                    <div className="grid grid-cols-2 gap-4 flex-1 w-full">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-muted ml-1">Edge Node Association</label>
                                            <select
                                                className="form-select text-xs"
                                                value={selectedCamera}
                                                onChange={e => setSelectedCamera(e.target.value)}
                                            >
                                                <option value="">SELECT SOURCE NODE</option>
                                                {cameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-muted ml-1">Manual Geospatial Tag</label>
                                            <div className="relative">
                                                <MapPin size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                                <input
                                                    className="form-input text-xs pl-9"
                                                    placeholder="Enter Site Name..."
                                                    value={customLocation}
                                                    onChange={e => setCustomLocation(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-primary h-full px-8 disabled:opacity-50"
                                        disabled={!file || !!step}
                                        onClick={runAnalysis}
                                    >
                                        {step ? <RefreshCw className="animate-spin" /> : <Play />}
                                        {step ? 'ANALYZING...' : 'INITIATE AI'}
                                    </button>
                                </div>
                            </FuturisticCard>
                        ) : (
                            <div className="space-y-6">
                                <FuturisticCard accent={result.accident_found ? 'danger' : 'success'} title="PIPELINE RESULTS" icon={<Search size={18} />}>
                                    <div className="flex flex-col md:flex-row gap-8 items-center py-6">
                                        <div className="flex-1 w-full space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Detection Vector</span>
                                                <AlertBadge
                                                    type={result.accident_found ? 'critical' : 'success'}
                                                    label={result.accident_found ? 'ACCIDENT IDENTIFIED' : 'SECURE / NO COLLISION'}
                                                />
                                            </div>

                                            <div className="p-4 bg-secondary rounded-xl border border-border">
                                                <div className="flex justify-between items-end mb-4">
                                                    <div>
                                                        <h4 className="text-xs font-bold text-white uppercase tracking-tighter">Collision Confidence</h4>
                                                        <p className="text-[10px] text-muted">Probability of motor-vehicle impact</p>
                                                    </div>
                                                    <div className="text-xl font-orbitron font-black text-cyan">
                                                        {(result.confidence * 100).toFixed(1)}%
                                                    </div>
                                                </div>
                                                <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${result.confidence * 100}%` }}
                                                        className={`h-full ${result.accident_found ? 'bg-danger shadow-glow-danger' : 'bg-success shadow-glow-success'}`}
                                                    />
                                                </div>
                                            </div>

                                            {result.accident_found && (
                                                <div className="p-4 bg-danger/5 border border-danger/20 rounded-xl">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Smartphone size={14} className="text-danger" />
                                                        <span className="text-[10px] font-black uppercase text-danger">Emergency Dispatch Link</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-secondary italic">SMS Alert Status:</span>
                                                        <AlertBadge type={result.alert_sent ? 'success' : 'muted'} label={result.alert_sent ? 'SENT' : 'NOT TRIGGERED'} icon={false} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="w-px h-32 bg-border hidden md:block" />

                                        <div className="w-full md:w-48 flex flex-col items-center">
                                            <SeverityGauge level={result.severity_level ? result.severity_level / 3 : result.confidence} label="Threat Level" />
                                            <div className="mt-4 text-center">
                                                <div className="text-[9px] font-black text-muted uppercase mb-1">Impact Rating</div>
                                                <div className={`text-xs font-bold uppercase ${result.severity_level === 3 ? 'text-danger shadow-glow-danger' : result.severity_level === 2 ? 'text-warning' : 'text-success'}`}>
                                                    {result.severity_label || 'Low'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-border flex justify-between items-center">
                                        <button className="btn btn-ghost btn-sm" onClick={() => { setFile(null); setResult(null); setStep(null); }}>
                                            ANALYZE NEW FOOTAGE
                                        </button>
                                        {result.incident_id && (
                                            <Link to={`/evidence/${result.incident_id}`} className="btn btn-primary btn-sm">
                                                VIEW EVIDENCE ARCHIVE <ArrowRight size={14} />
                                            </Link>
                                        )}
                                    </div>
                                </FuturisticCard>

                                {result.accident_found && (
                                    <FuturisticCard title="ENCRYPTION AUDIT" icon={<Shield size={18} />}>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="p-3 bg-secondary rounded-lg border border-border">
                                                    <div className="text-[10px] font-black text-muted uppercase mb-2">SHA-256 Fingerprint</div>
                                                    <div className="font-mono text-[9px] break-all text-cyan">{result.video_hash_sha256}</div>
                                                </div>
                                                <div className="p-3 bg-secondary rounded-lg border border-border">
                                                    <div className="text-[10px] font-black text-muted uppercase mb-2">MD5 Integrity Hash</div>
                                                    <div className="font-mono text-[9px] break-all text-purple-400">{result.video_hash_md5}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 px-3 py-2 bg-success/10 border border-success/30 rounded-lg">
                                                <CheckCircle size={14} className="text-success" />
                                                <span className="text-[10px] font-bold text-success uppercase">Data successfully immutableized & stored in redundant clusters</span>
                                            </div>
                                        </div>
                                    </FuturisticCard>
                                )}
                            </div>
                        )}

                        {error && (
                            <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl flex items-center gap-3 text-danger animate-fade-in">
                                <AlertTriangle size={20} />
                                <p className="text-sm font-bold">{error}</p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <FuturisticCard title="PIPELINE STATUS" icon={<Settings size={18} />}>
                            <div className="space-y-4 py-2">
                                <PipelineStatus targetStep="uploading" currentStep={step} label="Stream Ingestion" icon={<Upload size={18} />} />
                                <PipelineStatus targetStep="preprocessing" currentStep={step} label="Frame Extraction" icon={<FileText size={18} />} />
                                <PipelineStatus targetStep="detecting" currentStep={step} label="AI Conflict Probe" icon={<Search size={18} />} />
                                <PipelineStatus targetStep="analyzing" currentStep={step} label="Impact Quantification" icon={<Database size={18} />} />
                                <PipelineStatus targetStep="encrypting" currentStep={step} label="Quantum-Safe Lock" icon={<Shield size={18} />} />
                                <PipelineStatus targetStep="completed" currentStep={step} label="Archival Finalized" icon={<CheckCircle size={18} />} />
                            </div>
                        </FuturisticCard>

                        <FuturisticCard title="THREAT INTEL" accent="cyan">
                            <div className="space-y-4">
                                <p className="text-xs text-secondary leading-relaxed">
                                    Our neural network (YOLOv8-Custom) performs exhaustive parallel scans to detect structural deformation and velocity changes consistent with road accidents.
                                </p>
                                <div className="flex items-center gap-3 p-3 bg-cyan/5 border border-cyan/20 rounded-lg">
                                    <Activity className="text-cyan" size={16} />
                                    <span className="text-[10px] font-black text-cyan uppercase">Edge Latency: 42ms</span>
                                </div>
                            </div>
                        </FuturisticCard>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
