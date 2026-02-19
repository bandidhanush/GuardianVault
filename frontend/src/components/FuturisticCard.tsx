import React from 'react';
import { motion } from 'framer-motion';

interface FuturisticCardProps {
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
    icon?: React.ReactNode;
    className?: string;
    glass?: boolean;
    accent?: 'cyan' | 'purple' | 'danger' | 'success' | 'warning';
}

const FuturisticCard: React.FC<FuturisticCardProps> = ({
    title,
    subtitle,
    children,
    icon,
    className = '',
    glass = false,
    accent,
}) => {
    const accentClass = accent ? `border-${accent}` : '';
    const cardClass = glass ? 'card-glass' : 'card';

    return (
        <motion.div
            className={`${cardClass} ${accentClass} ${className} relative overflow-hidden`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={accent ? { borderColor: `var(--${accent})` } : {}}
        >
            {/* Scanline Effect */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />

            {/* Corner Accents */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan/30 rounded-tl-sm" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan/30 rounded-tr-sm" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan/30 rounded-bl-sm" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan/30 rounded-br-sm" />

            {(title || icon) && (
                <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                        {icon && (
                            <div className={`stat-icon ${accent || 'cyan'}`} style={{ width: 32, height: 32 }}>
                                {icon}
                            </div>
                        )}
                        <div>
                            {title && <h3 className="font-orbitron text-sm text-cyan tracking-widest">{title}</h3>}
                            {subtitle && <p className="text-[10px] text-muted mt-1 uppercase font-bold tracking-tighter">{subtitle}</p>}
                        </div>
                    </div>
                </div>
            )}
            <div className="relative z-10">
                {children}
            </div>
        </motion.div>
    );
};

export default FuturisticCard;
