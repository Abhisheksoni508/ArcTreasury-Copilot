import React from 'react';

export default function AnimatedLogo({ className = "w-48 h-48" }: { className?: string }) {
    return (
        <svg viewBox="0 0 200 200" className={className} xmlns="http://www.w3.org/2000/svg" fill="none">
            <defs>
                <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#6b21a8" />
                </linearGradient>

                <linearGradient id="legLeftGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#1e3a8a" />
                </linearGradient>

                <linearGradient id="legRightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#7e22ce" />
                </linearGradient>

                <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f0f9ff" />
                    <stop offset="50%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>

                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            {/* SHIELD (Background right) */}
            <g className="shield-anim origin-center" style={{ animation: 'fadeInScale 0.8s ease-out forwards 0.2s, pulseGlow 4s infinite alternate 1.5s', opacity: 0 }}>
                <path
                    d="M100 30 L170 45 V90 C170 135 140 170 100 185 C80 177.5 65 160 55 140 L100 130 Z"
                    fill="url(#shieldGrad)"
                />
                {/* Shield Circuit Lines */}
                <path
                    d="M130 50 V150 M110 70 H150 M140 90 H170 M100 110 H130"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="1.5"
                    className="circuit-path"
                />
                <circle cx="130" cy="50" r="2" fill="rgba(255,255,255,0.4)" className="fade-in-dot" style={{ animationDelay: '1s' }} />
                <circle cx="150" cy="70" r="2" fill="rgba(255,255,255,0.4)" className="fade-in-dot" style={{ animationDelay: '1.2s' }} />
                <circle cx="170" cy="90" r="2" fill="rgba(255,255,255,0.4)" className="fade-in-dot" style={{ animationDelay: '1.4s' }} />
            </g>

            {/* LETTER "A" */}
            <g className="origin-center" style={{ animation: 'slideUpFade 0.7s ease-out forwards 0.5s', opacity: 0 }}>
                {/* Right Leg */}
                <polygon
                    points="85,25 145,155 110,155 75,70"
                    fill="url(#legRightGrad)"
                />
                {/* Left Leg */}
                <polygon
                    points="85,25 30,155 65,155 95,80"
                    fill="url(#legLeftGrad)"
                />
                {/* The drop shadow under the cross arc to give 3D overlap */}
                <path d="M40 120 C 80 100 120 70 160 50" stroke="rgba(0,0,0,0.3)" strokeWidth="12" filter="blur(4px)" />
            </g>

            {/* SWOOPING ARC */}
            <path
                d="M30 135 C 70 115 110 80 155 40"
                stroke="url(#arcGrad)"
                strokeWidth="14"
                strokeLinecap="round"
                className="arc-path"
                filter="url(#glow)"
            />
            <path
                d="M30 135 C 70 115 110 80 155 40"
                stroke="white"
                strokeWidth="4"
                strokeLinecap="round"
                className="arc-path-inner"
            />
        </svg>
    );
}
