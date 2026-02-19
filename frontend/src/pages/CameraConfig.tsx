import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Plus, Trash2, MapPin, Phone, Edit2, Save, X, ToggleLeft, ToggleRight, Shield, Activity, HardDrive, RefreshCw, AlertTriangle } from 'lucide-react';
import { cameraApi, type Camera as CameraType } from '../services/api';
import FuturisticCard from '../components/FuturisticCard';
import AlertBadge from '../components/AlertBadge';

const emptyForm = (): Partial<CameraType> => ({
    name: '', location_name: '', latitude: undefined, longitude: undefined,
    rtsp_url: '', is_active: true,
    police_name: '', nearby_police_lat: undefined, nearby_police_lon: undefined, police_phone: '',
    hospital_name: '', nearby_hospital_lat: undefined, nearby_hospital_lon: undefined, hospital_phone: '',
});

export default function CameraConfig() {
    const [cameras, setCameras] = useState<CameraType[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<Partial<CameraType>>(emptyForm());
    const [editId, setEditId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const load = () => cameraApi.list().then(setCameras).catch(console.error);
    useEffect(() => { load(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.location_name) { setError('Name and location are required'); return; }
        setSaving(true);
        setError('');
        try {
            if (editId) {
                await cameraApi.update(editId, form);
            } else {
                await cameraApi.create(form);
            }
            setShowForm(false);
            setForm(emptyForm());
            setEditId(null);
            load();
        } catch (e: unknown) {
            setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (cam: CameraType) => {
        setForm(cam);
        setEditId(cam.id);
        setShowForm(true);
        setError('');
    };

    const deleteCamera = async (id: string) => {
        if (!confirm('Delete this camera from the network?')) return;
        await cameraApi.delete(id);
        load();
    };

    const toggleCamera = async (id: string) => {
        await cameraApi.toggle(id);
        load();
    };

    const F = (key: keyof CameraType, label: string, icon: React.ReactNode, type = 'text', placeholder = '') => (
        <div className="form-group">
            <label className="form-label mb-2 flex items-center gap-2">
                {icon}
                <span className="text-[10px] uppercase font-bold tracking-widest text-muted">{label}</span>
            </label>
            <input
                className="form-input"
                type={type}
                placeholder={placeholder}
                value={(form[key] as string | number | undefined) ?? ''}
                onChange={e => setForm(prev => ({
                    ...prev,
                    [key]: type === 'number' ? (e.target.value ? Number(e.target.value) : undefined) : e.target.value,
                }))}
            />
        </div>
    );

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="font-orbitron text-cyan text-xl">NETWORK CONSOLE</h2>
                    <p className="text-sm text-secondary mt-1">Configure edge nodes and emergency response parameters</p>
                </div>
                <button
                    className="btn btn-primary gap-2 group"
                    onClick={() => { setShowForm(true); setForm(emptyForm()); setEditId(null); }}
                >
                    <Plus size={18} className="group-hover:rotate-90 transition-transform" /> REGISTER NEW NODE
                </button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm font-bold flex items-center gap-2">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            <div className="page-content">
                <AnimatePresence mode="wait">
                    {!showForm ? (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                        >
                            {cameras.length === 0 ? (
                                <div className="col-span-full">
                                    <FuturisticCard className="p-20 border-dashed opacity-50 text-center">
                                        <Camera size={64} className="text-muted mx-auto mb-4" />
                                        <h3 className="font-bold text-muted">No Nodes Optimized</h3>
                                        <p className="text-sm text-muted">Register an IP camera or webcam to initiate monitoring</p>
                                    </FuturisticCard>
                                </div>
                            ) : (
                                cameras.map((cam) => (
                                    <FuturisticCard
                                        key={cam.id}
                                        accent={cam.is_active ? 'success' : undefined}
                                        className="flex flex-col h-full"
                                    >
                                        <div className="flex items-start justify-between mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cam.is_active ? 'bg-success/10 text-success' : 'bg-secondary text-muted'} border border-border`}>
                                                    <Camera size={24} />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-sm tracking-tight">{cam.name}</h3>
                                                    <div className="text-[10px] text-muted flex items-center gap-1">
                                                        <MapPin size={10} /> {cam.location_name}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button className="p-2 hover:bg-white/10 rounded-lg text-secondary transition-colors" onClick={() => startEdit(cam)}>
                                                    <Edit2 size={14} />
                                                </button>
                                                <button className="p-2 hover:bg-danger/10 rounded-lg text-danger transition-colors" onClick={() => deleteCamera(cam.id)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-3 flex-1">
                                            <div className="p-3 bg-black/20 rounded-lg border border-border">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Shield size={12} className="text-cyan" />
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted">Response Unit</span>
                                                    </div>
                                                    <span className="text-[9px] font-bold text-cyan">{cam.police_name || 'NOT CONFIGURED'}</span>
                                                </div>
                                                <div className="text-[10px] text-secondary flex items-center gap-2">
                                                    <Phone size={10} /> {cam.police_phone || 'N/A'}
                                                </div>
                                            </div>

                                            <div className="p-3 bg-black/20 rounded-lg border border-border">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Activity size={12} className="text-success" />
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted">Medical Unit</span>
                                                    </div>
                                                    <span className="text-[9px] font-bold text-success">{cam.hospital_name || 'NOT CONFIGURED'}</span>
                                                </div>
                                                <div className="text-[10px] text-secondary flex items-center gap-2">
                                                    <Phone size={10} /> {cam.hospital_phone || 'N/A'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                                            <AlertBadge type={cam.is_active ? 'success' : 'muted'} label={cam.is_active ? 'Active Node' : 'Suspended'} />
                                            <button
                                                className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${cam.is_active ? 'text-danger' : 'text-success'}`}
                                                onClick={() => toggleCamera(cam.id)}
                                            >
                                                {cam.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                                {cam.is_active ? 'Disable' : 'Enable'}
                                            </button>
                                        </div>
                                    </FuturisticCard>
                                ))
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 30 }}
                        >
                            <FuturisticCard accent="cyan" className="max-w-4xl mx-auto">
                                <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="stat-icon cyan">
                                            <Plus size={20} />
                                        </div>
                                        <h3 className="font-orbitron text-sm text-cyan uppercase tracking-widest font-black">
                                            {editId ? `UPDATING NODE: ${form.name}` : 'NEW NODE REGISTRATION'}
                                        </h3>
                                    </div>
                                    <button className="p-2 hover:bg-white/10 rounded-full" onClick={() => setShowForm(false)}>
                                        <X size={20} />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                                        {/* Column 1: Core Config */}
                                        <div className="space-y-6">
                                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan pb-2 border-b border-cyan/20">Core Parameters</div>
                                            {F('name', 'Node Identifier', <Camera size={12} />, 'text', 'e.g. ALPHA-1-STREET')}
                                            {F('location_name', 'Deployment Site', <MapPin size={12} />, 'text', 'e.g. NH-7 Flyover South')}
                                            <div className="grid grid-cols-2 gap-4">
                                                {F('latitude', 'Lat', <Activity size={12} />, 'number', '13.08')}
                                                {F('longitude', 'Lon', <Activity size={12} />, 'number', '80.27')}
                                            </div>
                                            {F('rtsp_url', 'RTSP Stream Hash', <HardDrive size={12} />, 'text', 'rtsp://...')}
                                        </div>

                                        {/* Column 2: Emergency Routing */}
                                        <div className="space-y-6">
                                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple pb-2 border-b border-purple/20">Emergency Protocols</div>

                                            <div className="space-y-4 p-4 bg-purple/5 rounded-lg border border-purple/20">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Shield size={14} className="text-purple" />
                                                    <span className="text-[10px] font-black uppercase tracking-tighter">Police Dispatch</span>
                                                </div>
                                                {F('police_name', 'Station Name', null, 'text', 'e.g. City Central Police')}
                                                {F('police_phone', 'Hotline', <Phone size={10} />, 'text', 'Emergency number')}
                                            </div>

                                            <div className="space-y-4 p-4 bg-success/5 rounded-lg border border-success/20">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Activity size={14} className="text-success" />
                                                    <span className="text-[10px] font-black uppercase tracking-tighter">Medical Dispatch</span>
                                                </div>
                                                {F('hospital_name', 'Hospital Name', null, 'text', 'e.g. Apollo Trauma Center')}
                                                {F('hospital_phone', 'Ambulance', <Phone size={10} />, 'text', 'Hospital number')}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-4 pt-6 mt-8 border-t border-border">
                                        <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
                                            ABORT REGISTRATION
                                        </button>
                                        <button type="submit" className="btn btn-primary px-12" disabled={saving}>
                                            {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                                            {editId ? 'COMMIT CHANGES' : 'INITIALIZE NODE'}
                                        </button>
                                    </div>
                                </form>
                            </FuturisticCard>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
