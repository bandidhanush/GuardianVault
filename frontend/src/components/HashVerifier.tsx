import React, { useState } from 'react';
import { Shield, CheckCircle, XCircle, RefreshCw, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HashVerifierProps {
    sha256: string;
    md5: string;
    onVerify: () => Promise<{ verified: boolean; status: string }>;
}

const HashVerifier: React.FC<HashVerifierProps> = ({ sha256, md5, onVerify }) => {
    const [isVerifying, setIsVerifying] = useState(false);
    const [result, setResult] = useState<{ verified: boolean; status: string } | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    const handleVerify = async () => {
        setIsVerifying(true);
        setResult(null);
        try {
            const res = await onVerify();
            setResult(res);
        } catch (e) {
            setResult({ verified: false, status: 'Verification system error' });
        } finally {
            setIsVerifying(false);
        }
    };

    const copy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <div className="card border-accent-cyan/30 bg-accent-cyan/5 shadow-glow-cyan">
            <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan to-purple flex items-center justify-center mx-auto mb-4 shadow-glow-cyan">
                    <Shield size={28} color="#000" />
                </div>
                <h3 className="font-orbitron text-sm text-cyan uppercase tracking-tighter">Cryptographic Certificate</h3>
                <p className="text-[10px] text-muted mt-1">SEC. 65B INDIAN EVIDENCE ACT COMPLIANT</p>
            </div>

            <div className="space-y-4 mb-6">
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-muted uppercase font-bold tracking-widest">SHA-256 Hash</span>
                        <button onClick={() => copy(sha256, 'sha')} className="text-cyan text-[10px] hover:underline flex items-center gap-1">
                            <Copy size={10} /> {copied === 'sha' ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                    <div className="hash-display text-[10px] p-2 bg-secondary border border-border rounded font-mono break-all text-cyan-500">
                        {sha256}
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-muted uppercase font-bold tracking-widest">MD5 Hash</span>
                        <button onClick={() => copy(md5, 'md5')} className="text-cyan text-[10px] hover:underline flex items-center gap-1">
                            <Copy size={10} /> {copied === 'md5' ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                    <div className="hash-display text-[10px] p-2 bg-secondary border border-border rounded font-mono break-all text-purple-400">
                        {md5}
                    </div>
                </div>
            </div>

            <button
                onClick={handleVerify}
                disabled={isVerifying}
                className="btn btn-primary w-full py-3 flex justify-center items-center gap-2 group"
            >
                {isVerifying ? (
                    <RefreshCw size={16} className="animate-spin" />
                ) : (
                    <Shield size={16} className="group-hover:scale-110 transition-transform" />
                )}
                {isVerifying ? 'CALCULATING HASHES...' : 'VERIFY INTEGRITY'}
            </button>

            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`mt-4 p-3 rounded-lg border flex items-start gap-3 ${result.verified
                                ? 'bg-success/10 border-success/30 text-success'
                                : 'bg-danger/10 border-danger/30 text-danger'
                            }`}
                    >
                        {result.verified ? <CheckCircle size={20} className="shrink-0" /> : <XCircle size={20} className="shrink-0" />}
                        <div>
                            <div className="text-xs font-bold uppercase tracking-tighter">{result.status}</div>
                            <p className="text-[10px] opacity-80 mt-1">
                                {result.verified
                                    ? 'The cryptographic fingerprint matches the original recording. Integrity confirmed.'
                                    : 'Hash mismatch detected. This evidence has been potentially tampered with.'}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default HashVerifier;
