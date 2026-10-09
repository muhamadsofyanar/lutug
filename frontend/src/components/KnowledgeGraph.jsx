import React, { useMemo, useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export default function KnowledgeGraph({ references, onNodeClick }) {
    const graphRef = useRef();
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const containerRef = useRef();

    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight
                });
            }
        };

        window.addEventListener('resize', updateDimensions);
        updateDimensions();
        
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    const data = useMemo(() => {
        const nodes = [];
        const links = [];
        
        // Create Nodes
        references.forEach(ref => {
            nodes.push({
                id: ref.id,
                name: ref.title,
                group: ref.business_unit || 'Umum',
                val: (ref.content?.length || 100) / 100 // Size based on content length
            });
        });

        // Create Links based on Business Unit
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                // Link if same business unit
                if (nodes[i].group !== 'Umum' && nodes[i].group === nodes[j].group) {
                    links.push({
                        source: nodes[i].id,
                        target: nodes[j].id,
                        value: 1,
                        type: 'unit'
                    });
                }
                
                // Link if sharing tags
                const tags1 = (references[i].tags || '').split(',').map(t => t.trim()).filter(Boolean);
                const tags2 = (references[j].tags || '').split(',').map(t => t.trim()).filter(Boolean);
                
                const sharedTags = tags1.filter(t => tags2.includes(t));
                if (sharedTags.length > 0) {
                     links.push({
                        source: nodes[i].id,
                        target: nodes[j].id,
                        value: sharedTags.length * 2, // Stronger link for tags
                        type: 'tag'
                    });
                }
            }
        }

        return { nodes, links };
    }, [references]);

    return (
        <div ref={containerRef} className="w-full h-full min-h-[500px] bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative group">
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
                <h3 className="text-slate-700 dark:text-slate-300 font-semibold text-sm bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur-sm">
                    Visualisasi Relasi
                </h3>
            </div>
            
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                <div className="bg-white/80 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur-sm">
                    <div className="text-[10px] font-bold text-slate-500 mb-1">Legenda</div>
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-teal-500 shadow-sm"></span>
                            <span className="text-xs text-slate-600 dark:text-slate-300">Tugas</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-sky-500 shadow-sm"></span>
                            <span className="text-xs text-slate-600 dark:text-slate-300">Proyek</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm"></span>
                            <span className="text-xs text-slate-600 dark:text-slate-300">Konteks</span>
                        </div>
                    </div>
                </div>
            </div>

            {references.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm italic">
                    Data belum cukup untuk visualisasi
                </div>
            ) : (
                <ForceGraph2D
                    ref={graphRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    graphData={data}
                    nodeLabel="name"
                    nodeColor={node => {
                        const colors = ['#f59e0b', '#0ea5e9', '#f43f5e', '#8b5cf6', '#10b981']; // Amber, Sky, Rose, Violet(soft), Emerald
                        // Simple hash for color
                        let hash = 0;
                        for (let i = 0; i < node.group.length; i++) hash = node.group.charCodeAt(i) + ((hash << 5) - hash);
                        return colors[Math.abs(hash) % colors.length];
                    }}
                    nodeRelSize={6}
                    linkColor={link => link.type === 'unit' ? '#334155' : '#475569'}
                    linkWidth={link => link.type === 'unit' ? 1 : 2}
                    linkDirectionalParticles={2}
                    linkDirectionalParticleSpeed={d => d.value * 0.001}
                    onNodeClick={node => {
                        const ref = references.find(r => r.id === node.id);
                        if (ref && onNodeClick) onNodeClick(ref);
                    }}
                    backgroundColor="rgba(0,0,0,0)"
                    cooldownTicks={100}
                />
            )}
        </div>
    );
}
