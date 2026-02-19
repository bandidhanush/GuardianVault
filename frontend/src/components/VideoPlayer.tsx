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

            <div className="relative">
                <video
                    src={src}
                    poster={poster}
                    controls
                    className="w-full h-auto block"
                    style={{ maxHeight: '500px' }}
                >
                    Your browser does not support the video tag.
                </video>

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
