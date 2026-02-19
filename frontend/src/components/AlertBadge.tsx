import React from 'react';
import { AlertTriangle, CheckCircle, Info, Clock } from 'lucide-react';

interface AlertBadgeProps {
    type: 'minor' | 'substantial' | 'critical' | 'success' | 'info' | 'muted' | 'warning';
    label: string;
    icon?: boolean;
}

const AlertBadge: React.FC<AlertBadgeProps> = ({ type, label, icon = true }) => {
    const getIcon = () => {
        switch (type) {
            case 'minor':
            case 'substantial':
                return <AlertTriangle size={12} />;
            case 'critical':
                return <AlertTriangle size={12} />;
            case 'success':
                return <CheckCircle size={12} />;
            case 'info':
                return <Info size={12} />;
            case 'muted':
                return <Clock size={12} />;
            default:
                return null;
        }
    };

    return (
        <span className={`badge badge-${type}`}>
            {icon && getIcon()}
            {label}
        </span>
    );
};

export default AlertBadge;
