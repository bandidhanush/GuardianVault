import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    AlertTriangle, Camera, Activity, TrendingUp,
    Clock, Bell, Eye, ArrowRight, MapPin
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { incidentApi, cameraApi, type Incident, type Stats, type Camera as CameraType } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { format } from 'date-fns';
import FuturisticCard from '../components/FuturisticCard';
import AlertBadge from '../components/AlertBadge';
import MapView from '../components/MapView';

export default function Dashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [cameras, setCameras] = useState<CameraType[]>([]);
    const [loading, setLoading] = useState(true);
    const { isConnected, messages } = useWebSocket();

    const loadData = async () => {
        try {
            const [s, inc, cams] = await Promise.all([
                incidentApi.stats(),
                incidentApi.list({ limit: 10 }),
                cameraApi.list(),
            ]);
            setStats(s);
            setIncidents(inc);
            setCameras(cams);
        } catch (e) {
            console.error('Dashboard load error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        const latest = messages[0];
        if (latest?.type === 'accident_detected') loadData();
    }, [messages]);

    const severityData = stats ? [
        { name: 'Minor', value: stats.severity_distribution['1'] || 0, color: '#f59e0b' },
        { name: 'Substantial', value: stats.severity_distribution['2'] || 0, color: '#f97316' },
        { name: 'Critical', value: stats.severity_distribution['3'] || 0, color: '#ef4444' },
    ] : [];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <div className="spinner h-12 w-12 border-t-cyan-500" />
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between py-6">
                <div>
                    <h2 className="text-2xl font-orbitron text-cyan tracking-widest">COMMAND CENTER</h2>
                    <p className="text-sm text-secondary mt-1 flex items-center gap-2">
                        <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
                        {isConnected ? 'Neural Link Established' : 'System Offline'} — Monitoring {cameras.length} Nodes
                    </p>
                </div>
                <div className="flex gap-4 mt-4 md:mt-0">
                    <Link to="/live" className="btn btn-primary btn-sm">
                        <Activity size={14} /> LIVE MONITOR
                    </Link>
                </div>
            </div>

            <div className="page-content !py-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <FuturisticCard className="!p-0">
                        <div className="stat-card">
                            <div className="stat-icon cyan">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <div className="stat-value">{stats?.total || 0}</div>
                                <div className="stat-label">Total Collisions</div>
                            </div>
                        </div>
                    </FuturisticCard>

                    <FuturisticCard className="!p-0">
                        <div className="stat-card">
                            <div className="stat-icon purple">
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <div className="stat-value">99.8%</div>
                                <div className="stat-label">System Fidelity</div>
                            </div>
                        </div>
                    </FuturisticCard>

                    <FuturisticCard className="!p-0">
                        <div className="stat-card">
                            <div className="stat-icon danger">
                                <Bell size={24} />
                            </div>
                            <div>
                                <div className="stat-value">{stats?.alert_sent_count || 0}</div>
                                <div className="stat-label">Alerts Dispatched</div>
                            </div>
                        </div>
                    </FuturisticCard>

                    <FuturisticCard className="!p-0">
                        <div className="stat-card">
                            <div className="stat-icon success">
                                <Camera size={24} />
                            </div>
                            <div>
                                <div className="stat-value">{cameras.filter(c => c.is_active).length}</div>
                                <div className="stat-label">Active Nodes</div>
                            </div>
                        </div>
                    </FuturisticCard>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <FuturisticCard title="LIVE NETWORK GEOMETRY" icon={<MapPin size={18} />}>
                            <div className="h-[400px] rounded-xl overflow-hidden mt-4">
                                <MapView
                                    center={[12.9716, 77.5946]}
                                    markers={cameras.filter(c => c.latitude && c.longitude).map(c => ({
                                        id: c.id,
                                        position: [c.latitude!, c.longitude!],
                                        label: c.name,
                                        type: 'camera'
                                    }))}
                                />
                            </div>
                        </FuturisticCard>

                        <FuturisticCard title="RECENT ANOMALY LOG" icon={<Clock size={18} />}>
                            <div className="table-container mt-4">
                                <table className="w-full">
                                    <thead>
                                        <tr>
                                            <th className="px-6 py-3">Timestamp</th>
                                            <th className="px-6 py-3">Location</th>
                                            <th className="px-6 py-3 text-center">Severity</th>
                                            <th className="px-6 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/20">
                                        {incidents.slice(0, 5).map((inc) => (
                                            <tr key={inc.id} className="hover:bg-cyan/5 transition-colors">
                                                <td className="px-6 py-4 text-xs font-mono">
                                                    {format(new Date(inc.timestamp), 'HH:mm:ss')}
                                                    <div className="text-[10px] text-muted">{format(new Date(inc.timestamp), 'dd MMM')}</div>
                                                </td>
                                                <td className="px-6 py-4 text-xs font-bold text-secondary">
                                                    {inc.location_name || 'Edge Node'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center">
                                                        <AlertBadge
                                                            type={inc.severity_level === 3 ? 'critical' : inc.severity_level === 2 ? 'substantial' : 'minor'}
                                                            label={inc.severity_label.toUpperCase()}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Link to={`/evidence/${inc.id}`} className="text-cyan hover:text-cyan-400 p-2 inline-block">
                                                        <Eye size={16} />
                                                    </Link>
                                                    <Link to="/incidents" className="text-secondary hover:text-white p-2 inline-block">
                                                        <ArrowRight size={16} />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </FuturisticCard>
                    </div>

                    <div className="space-y-8">
                        <FuturisticCard title="SEVERITY METRICS" icon={<TrendingUp size={18} />}>
                            <div className="h-[300px] w-full mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={severityData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {severityData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                                            itemStyle={{ color: '#fff', fontSize: '10px', textTransform: 'uppercase' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-3 mt-4">
                                {severityData.map(s => (
                                    <div key={s.name} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                            <span className="text-secondary font-bold uppercase tracking-widest">{s.name}</span>
                                        </div>
                                        <span className="font-mono">{s.value} incidents</span>
                                    </div>
                                ))}
                            </div>
                        </FuturisticCard>

                        <FuturisticCard accent="purple" className="flex items-center gap-4 bg-purple/10 border-dashed">
                            <div className="stat-icon purple shrink-0">
                                <Activity size={24} />
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Neural Health</h4>
                                <p className="text-xs text-secondary mt-1">Core active. Zero-latency inference engaged.</p>
                            </div>
                        </FuturisticCard>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
