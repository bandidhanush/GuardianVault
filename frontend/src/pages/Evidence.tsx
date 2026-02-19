import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft, Download, Shield, Clock, MapPin,
    ExternalLink, Share2, RefreshCw, Activity
} from 'lucide-react';
import { incidentApi, evidenceApi, type Incident, type Evidence as EvidenceType } from '../services/api';
import { format } from 'date-fns';
import FuturisticCard from '../components/FuturisticCard';
import AlertBadge from '../components/AlertBadge';
import VideoPlayer from '../components/VideoPlayer';
import HashVerifier from '../components/HashVerifier';

export default function Evidence() {
    const { id } = useParams<{ id: string }>();
    const [incident, setIncident] = useState<Incident | null>(null);
    const [evidence, setEvidence] = useState<EvidenceType | null>(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const inc = await incidentApi.get(id);
            setIncident(inc);
            const ev = await evidenceApi.get(id);
            setEvidence(ev);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [id]);

    if (loading) return <div className="flex justify-center p-20"><div className="spinner" /></div>;
    if (!incident) return <div className="text-center p-20"><h3>Incident record not found</h3></div>;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="page-header flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/incidents" className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h2 className="font-orbitron text-cyan text-xl">FORENSIC EVIDENCE</h2>
                        <p className="text-sm text-secondary mt-1">Incident Hash: {incident.id.slice(0, 12).toUpperCase()}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="btn btn-ghost btn-sm gap-2" onClick={load}>
                        <RefreshCw size={14} /> RE-VERIFY
                    </button>
                    <button className="btn btn-primary btn-sm gap-2">
                        <Share2 size={14} /> EXPORT DOSSIER
                    </button>
                </div>
            </div>

            <div className="page-content">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <FuturisticCard title="AUTHENTICATED PLAYBACK" icon={<Shield size={18} />}>
                            <div className="mt-4">
                                <VideoPlayer
                                    src={evidenceApi.streamUrl(incident.id)}
                                    isEncrypted={true}
                                    watermark={`RAD-SYSTEM | ${incident.id.slice(0, 8)} | ${format(new Date(incident.timestamp), 'yyyy-MM-dd')}`}
                                />
                            </div>
                        </FuturisticCard>

                        <FuturisticCard title="CRYPTOGRAPHIC INTEGRITY" icon={<Download size={18} />}>
                            <HashVerifier
                                sha256={evidence?.sha256_hash || incident.video_hash_sha256 || 'AWAITING GENERATION'}
                                md5={evidence?.md5_hash || incident.video_hash_md5 || 'AWAITING GENERATION'}
                                onVerify={() => evidenceApi.verify(incident.id)}
                            />
                        </FuturisticCard>
                    </div>

                    <div className="space-y-6">
                        <FuturisticCard title="INCIDENT TELEMETRY" icon={<Activity size={18} />}>
                            <div className="space-y-6 py-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase font-black tracking-widest text-muted">Severity Status</span>
                                    <AlertBadge
                                        type={incident.severity_level === 3 ? 'critical' : incident.severity_level === 2 ? 'substantial' : 'minor'}
                                        label={incident.severity_label.toUpperCase()}
                                    />
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-secondary rounded-lg border border-border">
                                        <Clock size={16} className="text-cyan mb-2" />
                                        <div className="text-[10px] text-muted font-bold uppercase">Timestamp</div>
                                        <div className="text-xs font-bold">{format(new Date(incident.timestamp), 'HH:mm:ss')}</div>
                                    </div>
                                    <div className="p-3 bg-secondary rounded-lg border border-border flex-1">
                                        <MapPin size={16} className="text-purple mb-2" />
                                        <div className="text-[10px] text-muted font-bold uppercase">Location</div>
                                        <div className="text-xs font-bold truncate">{incident.location_name || 'STATIONARY_NODE'}</div>
                                    </div>
                                </div>

                                <div className="p-4 bg-cyan/5 border border-cyan/20 rounded-xl">
                                    <h4 className="text-[10px] font-black uppercase text-cyan mb-2 tracking-tighter">AI Detection Profile</h4>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-secondary">Confidence Factor</span>
                                        <span className="text-xs font-mono font-bold">{(incident.accident_confidence * 100).toFixed(2)}%</span>
                                    </div>
                                    <div className="w-full h-1 bg-black/20 rounded-full mt-2 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${incident.accident_confidence * 100}%` }}
                                            className="h-full bg-cyan"
                                        />
                                    </div>
                                </div>
                            </div>
                        </FuturisticCard>

                        <FuturisticCard title="RESPONSE PROTOCOL" icon={<ExternalLink size={18} />}>
                            <div className="space-y-4">
                                <div className={`p-4 rounded-xl border flex flex-col gap-1 ${incident.alert_sent ? 'bg-success/5 border-success/20' : 'bg-warning/5 border-warning/20'}`}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted">Emergency SMS</span>
                                        <AlertBadge type={incident.alert_sent ? 'success' : 'muted'} label={incident.alert_sent ? 'DISPATCHED' : 'MANUAL'} icon={false} />
                                    </div>
                                    {incident.alert_sent && (
                                        <p className="text-[10px] text-success/70 font-bold mt-1 italic">Alert successfully routed to local emergency unit.</p>
                                    )}
                                </div>

                                <button className="btn btn-secondary w-full justify-center">
                                    <Activity size={16} /> VIEW LIVE LOGS
                                </button>
                            </div>
                        </FuturisticCard>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
