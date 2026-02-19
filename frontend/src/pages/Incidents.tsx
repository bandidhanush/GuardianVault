import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Filter, Eye, Trash2, RefreshCw, Search } from 'lucide-react';
import { incidentApi, type Incident } from '../services/api';
import { format } from 'date-fns';
import FuturisticCard from '../components/FuturisticCard';
import AlertBadge from '../components/AlertBadge';

const SEVERITY_LABELS: Record<number, string> = { 1: 'Minor', 2: 'Substantial', 3: 'Critical' };
const SEVERITY_CLASS: Record<number, any> = { 1: 'minor', 2: 'substantial', 3: 'critical' };

export default function Incidents() {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [severityFilter, setSeverityFilter] = useState<number | ''>('');
    const [statusFilter, setStatusFilter] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const data = await incidentApi.list({
                severity: severityFilter || undefined,
                status: statusFilter || undefined,
                limit: 100,
            });
            setIncidents(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [severityFilter, statusFilter]);

    const updateStatus = async (id: string, status: string) => {
        await incidentApi.updateStatus(id, status);
        load();
    };

    const deleteIncident = async (id: string) => {
        if (!confirm('Delete this incident record?')) return;
        await incidentApi.delete(id);
        load();
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="font-orbitron text-cyan text-xl">INCIDENT ARCHIVE</h2>
                    <p className="text-sm text-secondary mt-1">Historical database of all detected collision events</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="btn btn-ghost btn-sm gap-2" onClick={load}>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> REFRESH DATA
                    </button>
                </div>
            </div>

            <div className="page-content space-y-6">
                <FuturisticCard className="!p-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                        <div className="flex items-center gap-2 shrink-0">
                            <Filter size={14} className="text-cyan" />
                            <span className="text-xs font-black uppercase tracking-widest text-muted">Filter Engine</span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 flex-1">
                            <div className="flex-1 flex gap-2">
                                <select
                                    className="form-select text-xs"
                                    value={severityFilter}
                                    onChange={e => setSeverityFilter(e.target.value ? Number(e.target.value) : '')}
                                >
                                    <option value="">ALL SEVERITIES</option>
                                    <option value="1">LEVEL 1 — MINOR IMPACT</option>
                                    <option value="2">LEVEL 2 — SUBSTANTIAL</option>
                                    <option value="3">LEVEL 3 — CRITICAL</option>
                                </select>
                                <select
                                    className="form-select text-xs"
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value)}
                                >
                                    <option value="">ALL STATUSES</option>
                                    <option value="detected">DETECTED</option>
                                    <option value="reviewed">REVIEWED</option>
                                    <option value="closed">CLOSED</option>
                                </select>
                            </div>

                            {(severityFilter || statusFilter) && (
                                <button className="btn btn-danger btn-sm text-[10px] px-4" onClick={() => { setSeverityFilter(''); setStatusFilter(''); }}>
                                    CLEAR FILTERS
                                </button>
                            )}
                        </div>
                    </div>
                </FuturisticCard>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="spinner h-10 w-10 border-t-cyan" />
                    </div>
                ) : incidents.length === 0 ? (
                    <FuturisticCard>
                        <div className="flex flex-col items-center justify-center p-20 opacity-40">
                            <Search size={48} className="text-muted mb-4" />
                            <h3 className="font-bold">No Records Found</h3>
                            <p className="text-sm">Adjust filters or check system connection</p>
                        </div>
                    </FuturisticCard>
                ) : (
                    <FuturisticCard className="!p-0 overflow-hidden">
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="py-4 px-6 text-[10px] text-muted uppercase tracking-widest">INCIDENT ID</th>
                                        <th className="py-4 px-6 text-[10px] text-muted uppercase tracking-widest">TIMESTAMP</th>
                                        <th className="py-4 px-6 text-[10px] text-muted uppercase tracking-widest">LOCATION</th>
                                        <th className="py-4 px-6 text-[10px] text-muted uppercase tracking-widest">SEVERITY</th>
                                        <th className="py-4 px-6 text-[10px] text-muted uppercase tracking-widest">CONFIDENCE</th>
                                        <th className="py-4 px-6 text-[10px] text-muted uppercase tracking-widest">ALERTS</th>
                                        <th className="py-4 px-6 text-[10px] text-muted uppercase tracking-widest">PROTOCOL</th>
                                        <th className="py-4 px-6 text-[10px] text-muted uppercase tracking-widest text-right">ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                    {incidents.map((inc, i) => (
                                        <motion.tr
                                            key={inc.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.03 }}
                                            className="hover:bg-cyan/5 transition-colors"
                                        >
                                            <td className="py-4 px-6">
                                                <span className="font-mono text-[10px] text-cyan-500">
                                                    {inc.id.slice(0, 8).toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="text-xs font-bold">{format(new Date(inc.timestamp), 'MMM d, yyyy')}</div>
                                                <div className="text-[10px] text-muted font-mono">{format(new Date(inc.timestamp), 'HH:mm:ss')}</div>
                                            </td>
                                            <td className="py-4 px-6 text-xs text-secondary max-w-[150px] truncate">
                                                {inc.location_name || 'STATIONARY FEED'}
                                            </td>
                                            <td className="py-4 px-6">
                                                <AlertBadge type={SEVERITY_CLASS[inc.severity_level]} label={SEVERITY_LABELS[inc.severity_level]} />
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-16 h-1 bg-secondary rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${inc.accident_confidence > 0.8 ? 'bg-danger' : 'bg-cyan'}`}
                                                            style={{ width: `${inc.accident_confidence * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-mono">{(inc.accident_confidence * 100).toFixed(0)}%</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                {inc.alert_sent
                                                    ? <AlertBadge type="success" label="SMS SENT" icon={false} />
                                                    : <AlertBadge type="muted" label="PENDING" icon={false} />}
                                            </td>
                                            <td className="py-4 px-6">
                                                <select
                                                    className="form-select py-1 px-2 text-[10px] font-bold uppercase"
                                                    value={inc.status}
                                                    onChange={e => updateStatus(inc.id, e.target.value)}
                                                    style={{ width: 'auto' }}
                                                >
                                                    <option value="detected">DETECTED</option>
                                                    <option value="reviewed">REVIEWED</option>
                                                    <option value="closed">CLOSED</option>
                                                </select>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link to={`/evidence/${inc.id}`} className="p-2 hover:bg-cyan/20 rounded-md text-cyan transition-colors" title="View Evidence">
                                                        <Eye size={14} />
                                                    </Link>
                                                    <button
                                                        className="p-2 hover:bg-danger/20 rounded-md text-danger transition-colors"
                                                        onClick={() => deleteIncident(inc.id)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </FuturisticCard>
                )}
            </div>
        </motion.div>
    );
}
