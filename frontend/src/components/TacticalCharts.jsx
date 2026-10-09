import React, { useState } from 'react';

export default function TacticalCharts({ 
    velocity: rawVelocity = [], 
    distribution: rawDistribution = [], 
    projectDistribution: rawProjectDistribution = [], 
    taskDistribution: rawTaskDistribution = [], 
    inboxDistribution: rawInboxDistribution = [], 
    energy: rawEnergy = [],
    radarPoints: rawRadarPoints = [],
    unitSummary: rawUnitSummary = {}
}) {
    // Shared Constants
    const chartHeight = 100;
    const chartWidth = 300;
    const padding = 10;
    const getX = (index, length) => (index / (length - 1)) * (chartWidth - padding * 2) + padding;

    // Safe Props (Robust Null Handling)
    const velocity = rawVelocity || [];
    const distribution = rawDistribution || [];
    const projectDistribution = rawProjectDistribution || [];
    const taskDistribution = rawTaskDistribution || [];
    const inboxDistribution = rawInboxDistribution || [];
    const energy = rawEnergy || [];
    const radarPoints = rawRadarPoints || [];
    const unitSummary = rawUnitSummary || {};

    // State for Tabs
    const [distMode, setDistMode] = useState('projects'); // projects, tasks, inbox
    const [radarMode, setRadarMode] = useState('tasks'); // tasks, units

    // 1. Velocity Chart Logic (Line Chart)
    const maxVelocity = Math.max(...velocity.map(v => v.count), 5); // Minimum scale of 5
    const getY = (value) => chartHeight - ((value / maxVelocity) * (chartHeight - padding * 2)) - padding;
    
    const points = velocity.map((v, i) => `${getX(i, velocity.length)},${getY(v.count)}`).join(' ');
    const areaPoints = velocity.length > 0 ? `${getX(0, velocity.length)},${chartHeight} ${points} ${getX(velocity.length - 1, velocity.length)},${chartHeight}` : '';

    // 2. Distribution Logic (Horizontal Bars)
    let currentDist = [];
    if (distMode === 'projects') {
        currentDist = (Array.isArray(projectDistribution) && projectDistribution.length > 0) ? projectDistribution : distribution;
    } else if (distMode === 'tasks') {
        currentDist = taskDistribution;
    } else if (distMode === 'inbox') {
        currentDist = inboxDistribution;
    }

    // Ultra-Safety check
    if (!Array.isArray(currentDist)) {
        currentDist = [];
    }

    const totalCount = currentDist.reduce((acc, curr) => {
        if (!curr) return acc;
        return acc + (parseInt(curr.count) || 0);
    }, 0);

    // 3. Energy Chart Logic
    const getEnergyY = (value) => chartHeight - ((value / 100) * (chartHeight - padding * 2)) - padding;
    const energyPoints = energy.map((e, i) => `${getX(i, energy.length)},${getEnergyY(e.level)}`).join(' ');
    const energyAreaPoints = energy.length > 0 ? `${getX(0, energy.length)},${chartHeight} ${energyPoints} ${getX(energy.length - 1, energy.length)},${chartHeight}` : '';

    // 4. Radar Chart Logic (Eisenhower)
    const getRadarX = (u) => ((u || 0) / 10) * (chartWidth - padding * 2) + padding;
    const getRadarY = (i) => ((10 - (i || 0)) / 10) * (chartHeight - padding * 2) + padding;

    // 5. Unit Health Radar Logic (Polygon)
    const units = Object.keys(unitSummary);
    const numUnits = units.length;
    const radarCenter = { x: chartWidth / 2, y: chartHeight / 2 };
    const radarRadius = Math.min(chartWidth, chartHeight) / 2 - padding;

    const getUnitRadarPoint = (index, value) => {
        const angle = (Math.PI * 2 * index) / numUnits - Math.PI / 2;
        const r = (value / 100) * radarRadius;
        return {
            x: radarCenter.x + r * Math.cos(angle),
            y: radarCenter.y + r * Math.sin(angle)
        };
    };

    const unitPolygonPoints = units.map((unit, i) => {
        const value = unitSummary[unit]?.health_score || 0;
        const p = getUnitRadarPoint(i, value);
        return `${p.x},${p.y}`;
    }).join(' ');

    const unitPolygonBgPoints = units.map((unit, i) => {
        const p = getUnitRadarPoint(i, 100); // Max radius
        return `${p.x},${p.y}`;
    }).join(' ');

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-700 delay-300">
            {/* Velocity Module */}
            <div className="relative group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-all shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                    <span className="text-emerald-500">⚡</span>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Tren Aktivitas <span className="text-slate-400 font-normal text-xs">/ 7 Hari</span>
                    </h3>
                </div>

                <div className="h-[120px] w-full flex items-end justify-between relative overflow-hidden">
                    {/* Grid Lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
                        <div className="border-t border-slate-300 w-full h-0"></div>
                        <div className="border-t border-slate-300 w-full h-0"></div>
                        <div className="border-t border-slate-300 w-full h-0"></div>
                    </div>

                    {/* SVG Chart */}
                    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                        <defs>
                            <linearGradient id="velocityGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        {velocity.length > 1 && (
                            <>
                                <polygon points={areaPoints} fill="url(#velocityGradient)" className="transition-all duration-500" />
                                <polyline points={points} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </>
                        )}
                        {velocity.map((v, i) => (
                            <circle 
                                key={i} 
                                cx={getX(i, velocity.length)} 
                                cy={getY(v.count)} 
                                r="3" 
                                className="fill-white dark:fill-slate-900 stroke-emerald-500 stroke-2 hover:r-4 transition-all cursor-crosshair"
                            >
                                <title>{v.day}: {v.count}</title>
                            </circle>
                        ))}
                    </svg>
                </div>
                
                {/* X-Axis Labels */}
                <div className="flex justify-between mt-2 px-1">
                    {velocity.map((v, i) => (
                        <span key={i} className="text-[10px] font-medium text-slate-500">{v.day.substring(0, 3)}</span>
                    ))}
                </div>
            </div>

            {/* Energy Module */}
            <div className="relative group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-all shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                    <span className="text-emerald-500">🔋</span>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Energi <span className="text-slate-400 font-normal text-xs">Harian</span>
                    </h3>
                </div>

                <div className="h-[120px] w-full flex items-end justify-between relative overflow-hidden">
                    {/* Grid Lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
                        <div className="border-t border-slate-300 w-full h-0"></div>
                        <div className="border-t border-slate-300 w-full h-0"></div>
                        <div className="border-t border-slate-300 w-full h-0"></div>
                    </div>

                    {/* SVG Chart */}
                    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                        <defs>
                            <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        {energy.length > 1 && (
                            <>
                                <polygon points={energyAreaPoints} fill="url(#energyGradient)" className="transition-all duration-500" />
                                <polyline points={energyPoints} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </>
                        )}
                        {energy.map((e, i) => (
                            <circle 
                                key={i} 
                                cx={getX(i, energy.length)} 
                                cy={getEnergyY(e.level)} 
                                r="3" 
                                className="fill-white dark:fill-slate-900 stroke-emerald-500 stroke-2 hover:r-4 transition-all cursor-crosshair"
                            >
                                <title>{e.day}: {e.level}%</title>
                            </circle>
                        ))}
                    </svg>
                </div>
                
                {/* X-Axis Labels */}
                <div className="flex justify-between mt-2 px-1">
                    {energy.map((e, i) => (
                        <span key={i} className="text-[10px] md:text-xs font-medium text-slate-500">{e.day.substring(0, 3)}</span>
                    ))}
                </div>
            </div>

            {/* Radar Module (Switchable: Eisenhower / Unit Health) */}
            <div className="relative group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-500/30 transition-all shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <span className="text-teal-500">🎯</span>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Peta Fokus <span className="text-slate-400 font-normal text-xs">/ {radarMode === 'tasks' ? 'Tugas' : 'Unit'}</span>
                        </h3>
                    </div>
                     {/* Radar Toggle */}
                     <div className="flex gap-1 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg">
                        <button 
                            onClick={() => setRadarMode('tasks')}
                            className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all ${
                                radarMode === 'tasks' 
                                ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                            }`}
                        >
                            Tugas
                        </button>
                        <button 
                            onClick={() => setRadarMode('units')}
                            className={`text-[10px] font-medium px-2 py-1 rounded-md transition-all ${
                                radarMode === 'units' 
                                ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                            }`}
                        >
                            Unit
                        </button>
                    </div>
                </div>

                <div className="h-[120px] w-full flex items-center justify-center relative overflow-hidden bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-200 dark:border-slate-800/50">
                    {radarMode === 'tasks' ? (
                        <>
                            {/* Quadrant Grid */}
                            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none opacity-30">
                                <div className="border-r border-b border-slate-300 dark:border-slate-700 bg-green-500/5"></div>
                                <div className="border-b border-slate-300 dark:border-slate-700 bg-red-500/10"></div>
                                <div className="border-r border-slate-300 dark:border-slate-700 bg-slate-500/5"></div>
                                <div className="bg-yellow-500/5"></div>
                            </div>
                            
                            {/* Axis Labels */}
                            <span className="absolute bottom-1 right-1 text-[8px] text-slate-400 font-medium">Urgensi &rarr;</span>
                            <span className="absolute top-1 left-1 text-[8px] text-slate-400 font-medium writing-mode-vertical">&uarr; Kepentingan</span>

                            {/* SVG Chart */}
                            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                                {radarPoints.map((p, i) => (
                                    <circle 
                                        key={p.id ? `${p.type || 'unknown'}-${p.id}` : i} 
                                        cx={getRadarX(p.urgency)} 
                                        cy={getRadarY(p.importance)} 
                                        r="3" 
                                        className={`stroke-2 transition-all cursor-pointer hover:r-5 ${
                                            (p.importance >= 5 && p.urgency >= 5) ? 'fill-red-100 dark:fill-red-900/80 stroke-red-500' :
                                            (p.importance >= 5) ? 'fill-green-100 dark:fill-green-900/80 stroke-green-500' :
                                            (p.urgency >= 5) ? 'fill-yellow-100 dark:fill-yellow-900/80 stroke-yellow-500' :
                                            'fill-slate-100 dark:fill-slate-900/80 stroke-slate-500'
                                        }`}
                                    >
                                        <title>{p.title} (Imp:{p.importance}, Urg:{p.urgency})</title>
                                    </circle>
                                ))}
                            </svg>
                        </>
                    ) : (
                        <>
                            {/* Unit Radar (Spider Chart) */}
                            {/* Radial Grid */}
                            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                                {/* Background Polygon (Max) */}
                                <polygon 
                                    points={unitPolygonBgPoints} 
                                    fill="none" 
                                    stroke="#334155" 
                                    strokeWidth="1" 
                                    strokeDasharray="4 2" 
                                    className="opacity-20"
                                />
                                {/* Spokes */}
                                {units.map((unit, i) => {
                                    const p = getUnitRadarPoint(i, 100);
                                    return (
                                        <line 
                                            key={i} 
                                            x1={radarCenter.x} 
                                            y1={radarCenter.y} 
                                            x2={p.x} 
                                            y2={p.y} 
                                            stroke="#334155" 
                                            strokeWidth="1" 
                                            className="opacity-10"
                                        />
                                    );
                                })}
                                {/* Data Polygon */}
                                <polygon 
                                    points={unitPolygonPoints} 
                                    fill="rgba(20, 184, 166, 0.1)" 
                                    stroke="#14b8a6" 
                                    strokeWidth="1.5" 
                                    className="transition-all duration-500"
                                />
                                {/* Data Points */}
                                {units.map((unit, i) => {
                                    const value = unitSummary[unit]?.health_score || 0;
                                    const p = getUnitRadarPoint(i, value);
                                    return (
                                        <circle 
                                            key={i}
                                            cx={p.x} 
                                            cy={p.y} 
                                            r="3" 
                                            className="fill-white dark:fill-slate-900 stroke-teal-500 stroke-2 hover:r-5 transition-all cursor-pointer"
                                        >
                                            <title>{unit}: {value}%</title>
                                        </circle>
                                    );
                                })}
                            </svg>
                            {/* Labels (Simplified) */}
                            {units.length === 0 && (
                                <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500">
                                    Belum ada data unit
                                </div>
                            )}
                        </>
                    )}
                </div>
                
                {/* Stats */}
                <div className="flex justify-between mt-2 px-1 text-[10px] font-medium text-slate-500">
                    <span>{radarMode === 'tasks' ? radarPoints.length : units.length} {radarMode === 'tasks' ? 'Target' : 'Unit'}</span>
                    <span>{radarMode === 'tasks' ? 'Matriks Prioritas' : 'Skor Kesehatan'}</span>
                </div>
            </div>

            {/* Distribution Module */}
            <div className="relative group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-500/30 transition-all shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <span className="text-teal-500">📊</span>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Sebaran Beban
                        </h3>
                    </div>
                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg">
                        <button 
                            onClick={() => setDistMode('projects')}
                            className={`text-[9px] font-medium px-2 py-1 rounded-md transition-all ${
                                distMode === 'projects' 
                                    ? 'bg-teal-500 text-white shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                            }`}
                        >
                            Proyek
                        </button>
                        <button 
                            onClick={() => setDistMode('tasks')}
                            className={`text-[9px] font-medium px-2 py-1 rounded-md transition-all ${
                                distMode === 'tasks' 
                                    ? 'bg-teal-500 text-white shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                            }`}
                        >
                            Tugas
                        </button>
                        <button 
                            onClick={() => setDistMode('inbox')}
                            className={`text-[9px] font-medium px-2 py-1 rounded-md transition-all ${
                                distMode === 'inbox' 
                                    ? 'bg-teal-500 text-white shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                            }`}
                        >
                            Inbox
                        </button>
                    </div>
                </div>

                <div className="h-[120px] w-full flex items-end justify-between gap-1 relative overflow-hidden bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-200 dark:border-slate-800/50 p-2">
                    {/* Bars */}
                    {currentDist.map((item, i) => {
                         const count = parseInt(item.count) || 0;
                         const h = totalCount > 0 ? (count / totalCount) * 100 : 0;
                         
                         return (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1 group/bar relative">
                                <span className="text-[8px] font-bold text-slate-500 mb-1 opacity-0 group-hover/bar:opacity-100 transition-opacity absolute bottom-full">{count}</span>
                                
                                <div 
                                    className="w-full bg-slate-200 dark:bg-slate-800 rounded-sm relative overflow-hidden transition-all duration-500 group-hover/bar:bg-slate-300 dark:group-hover/bar:bg-slate-700" 
                                    style={{ height: `${Math.max(h, 5)}%` }}
                                >
                                    <div className={`absolute bottom-0 left-0 right-0 top-0 opacity-50 bg-teal-500`}></div>
                                </div>
                                
                                <span className="text-slate-500 text-[8px] font-medium capitalize truncate w-full text-center">{item.status || item.name || item.business_unit}</span>
                            </div>
                         );
                    })}
                    
                    {/* Total Overlay */}
                    <div className="absolute top-2 right-2 pointer-events-none">
                        <div className="text-6xl font-bold text-slate-200 dark:text-teal-500/5 tabular-nums tracking-tighter">{totalCount}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
