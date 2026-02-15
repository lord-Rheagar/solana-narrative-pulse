'use client';

interface TopBarProps {
    loading: boolean;
    lastUpdated: string | null;
    onDetect: () => void;
}

function getFortnightNumber(): number {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return Math.floor(days / 14) + 1;
}

export function TopBar({ loading, lastUpdated, onDetect }: TopBarProps) {
    const fortnight = getFortnightNumber();

    return (
        <header className="top-bar">
            <div className="brand uppercase">
                Solana Narrative Radar
            </div>

            <div className="nav-links">
                <button
                    className={`nav-link ${loading ? 'loading' : ''} detect-btn`}
                    onClick={onDetect}
                    disabled={loading}
                >
                    {loading ? '● Scanning...' : '▶ Detect'}
                </button>
            </div>

            <div className="period-indicator">
                Fortnight {fortnight} • {lastUpdated ? 'Active' : 'Idle'}
            </div>
        </header>
    );
}
