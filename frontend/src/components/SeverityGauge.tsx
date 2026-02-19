import React from 'react';
import { motion } from 'framer-motion';

interface SeverityGaugeProps {
    level: number; // 0-1
    label?: string;
    color?: string;
}

const SeverityGauge: React.FC<SeverityGaugeProps> = ({ level, label, color }) => {
    const getSeverityColor = () => {
        if (color) return color;
        if (level > 0.8) return 'var(--danger)';
        if (level > 0.5) return 'var(--warning)';
        return 'var(--success)';
    };

    const percentage = Math.round(level * 100);

    return (
        <div className="w-full">
            <div className="flex justify-between items-end mb-2">
                <span className="text-xs text-muted uppercase tracking-widest font-semibold">{label || 'Confidence'}</span>
                <span className="font-orbitron text-lg font-bold" style={{ color: getSeverityColor() }}>{percentage}%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden border border-border">
                <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    style={{
                        background: `linear-gradient(90deg, ${getSeverityColor()}88, ${getSeverityColor()})`,
                        boxShadow: `0 0 10px ${getSeverityColor()}44`
                    }}
                />
            </div>
        </div>
    );
};

export default SeverityGauge;
