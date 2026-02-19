import React from 'react';
import { Play, Shield } from 'lucide-react';

interface VideoPlayerProps {
    src: string;
    poster?: string;
    watermark?: string;
    className?: string;
    isEncrypted?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
    src,
    poster,
    watermark = 'EVIDENCE - DO NOT DISTRIBUTE',
    className = '',
    isEncrypted = true,
}) => {
    return (
        <div className={`card overflow-hidden p-0 relative ${className}`} style={{ background: '#000' }}>
            <div className="flex items-center gap-2 p-3 border-b border-border bg-glass backdrop-blur-md">
                <Play size={14} color="var(--accent-cyan)" />
                <span className="text-sm font-semibold text-cyan">
                    {isEncrypted ? 'ENCRYPTED EVIDENCE FEED' : 'VIDEO PLAYER'}
                </span>
                {isEncrypted && (
                    <div className="ml-auto flex items-center gap-2">
                        <Shield size={12} color="var(--danger)" />
                        <span className="text-xs text-danger font-bold uppercase tracking-wider">Secure</span>
                    </div>
                )}
            </div>

            <div className="relative group">
                <video
                    key={src}
                    poster={poster}
                    controls
                    className="w-full h-auto block"
                    style={{ maxHeight: '500px', background: '#000' }}
                    preload="metadata"
                >
                    <source src={src} type="video/mp4" />
                    Your browser does not support the video tag.
                </video>

                <div className="absolute top-4 left-4 flex gap-2">
                    {isEncrypted && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-danger/20 border border-danger/40 backdrop-blur-md rounded text-[9px] font-black text-white uppercase tracking-tighter">
                            <Shield size={10} className="text-danger" /> SECURE DECRYPT
                        </div>
                    )}
                </div>

                {watermark && (
                    <div className="absolute top-4 right-4 bg-danger/80 text-white px-2 py-1 rounded text-[10px] font-black tracking-tighter pointer-events-none select-none">
                        {watermark}
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoPlayer;
