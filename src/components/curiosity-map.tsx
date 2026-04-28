"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";

interface RawNode {
  id: string;
  title: string;
  description: string | null;
  source: string;
  explored: boolean;
  lessonId: string | null;
}

// d3 mutates nodes in-place, extending with x/y/vx/vy
type SimNode = SimulationNodeDatum & RawNode;

interface MapEdge {
  from_topic: string;
  to_topic: string;
  label: string | null;
}

// d3-force link format
type SimLink = SimulationLinkDatum<SimNode> & { label: string | null };

interface Props {
  profileId: string;
  profileName: string;
  age: number;
}

const TOPIC_COLORS: Record<string, string> = {
  seed: "#8b5cf6",
  ai_suggested: "#06b6d4",
  parent_added: "#f97316",
  child_requested: "#ec4899",
};

function colorFor(source: string, explored: boolean) {
  if (!explored) return "#d1d5db";
  return TOPIC_COLORS[source] ?? "#8b5cf6";
}

const NODE_RADIUS = 40;
const W = 900;
const H = 600;

export function CuriosityMap({ profileId, age }: Props) {
  const router = useRouter();
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [edges, setEdges] = useState<MapEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ node: SimNode } | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode, SimLink>> | null>(null);

  const nodeRadius = age <= 4 ? NODE_RADIUS + 8 : NODE_RADIUS;

  useEffect(() => {
    fetch(`/api/map?profileId=${profileId}`)
      .then((r) => r.json())
      .then(({ nodes: rawNodes, edges: rawEdges }: { nodes: RawNode[]; edges: MapEdge[] }) => {
        setEdges(rawEdges ?? []);

        const nodes: SimNode[] = (rawNodes ?? []).map((n) => ({
          ...n,
          // scatter from center so simulation has something to work with
          x: W / 2 + (Math.random() - 0.5) * 200,
          y: H / 2 + (Math.random() - 0.5) * 200,
        }));

        const links: SimLink[] = (rawEdges ?? []).map((e) => ({
          source: e.from_topic,
          target: e.to_topic,
          label: e.label,
        }));

        // Stop any previous simulation
        simRef.current?.stop();

        const sim = forceSimulation<SimNode, SimLink>(nodes)
          .force("charge", forceManyBody<SimNode>().strength(-400))
          .force("link", forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(160).strength(0.5))
          .force("center", forceCenter<SimNode>(W / 2, H / 2).strength(0.05))
          .force("collide", forceCollide<SimNode>(nodeRadius + 8))
          .alphaDecay(0.03);

        sim.on("tick", () => {
          // Clamp to canvas
          for (const n of nodes) {
            n.x = Math.max(nodeRadius + 4, Math.min(W - nodeRadius - 4, n.x ?? W / 2));
            n.y = Math.max(nodeRadius + 4, Math.min(H - nodeRadius - 4, n.y ?? H / 2));
          }
          setSimNodes([...nodes]);
        });

        simRef.current = sim;
        setLoading(false);
      });

    return () => { simRef.current?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const handleNodeClick = useCallback(
    async (node: SimNode) => {
      if (node.explored && node.lessonId) {
        router.push(`/${profileId}/lessons/${node.lessonId}`);
        return;
      }
      if (generating) return;
      setGenerating(node.id);
      try {
        const res = await fetch("/api/lessons/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicId: node.id, profileId }),
        });
        const data = await res.json();
        if (data.lessonId) {
          router.push(`/${profileId}/lessons/${data.lessonId}`);
        }
      } finally {
        setGenerating(null);
      }
    },
    [router, profileId, generating]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-400">
        Loading your curiosity map…
      </div>
    );
  }

  if (!simNodes.length) {
    return (
      <div className="flex flex-col items-center gap-4 p-12 text-center text-gray-500">
        <p className="text-lg">No topics yet!</p>
        <p className="text-sm">Ask a parent to add your first topic.</p>
      </div>
    );
  }

  const nodeById = new Map(simNodes.map((n) => [n.id, n]));

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-inner">
      <svg
        width={W}
        height={H}
        className="w-full"
        viewBox={`0 0 ${W} ${H}`}
        onClick={() => setTooltip(null)}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, i) => {
          const a = nodeById.get(edge.from_topic);
          const b = nodeById.get(edge.to_topic);
          if (!a || !b || a.x == null || a.y == null || b.x == null || b.y == null) return null;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const ex = b.x - (dx / len) * (nodeRadius + 4);
          const ey = b.y - (dy / len) * (nodeRadius + 4);
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={ex}
              y2={ey}
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray={a.explored && b.explored ? undefined : "5,4"}
              markerEnd="url(#arrow)"
              opacity={0.6}
            />
          );
        })}

        {/* Nodes */}
        {simNodes.map((node) => {
          if (node.x == null || node.y == null) return null;
          const isGenerating = generating === node.id;
          const fill = colorFor(node.source, node.explored);
          const textColor = node.explored ? "#fff" : "#6b7280";
          const label = node.title.length > 12 ? node.title.slice(0, 11) + "…" : node.title;
          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              style={{ cursor: isGenerating ? "wait" : "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                if (!isGenerating) {
                  setTooltip(tooltip?.node.id === node.id ? null : { node });
                }
              }}
            >
              {node.explored && <circle r={nodeRadius + 3} fill={fill} opacity={0.2} />}
              <circle
                r={nodeRadius}
                fill={node.explored ? fill : "#f9fafb"}
                stroke={node.explored ? fill : "#d1d5db"}
                strokeWidth={node.explored ? 0 : 2}
                strokeDasharray={node.explored ? undefined : "4,3"}
              />
              {isGenerating && (
                <circle r={nodeRadius + 5} fill="none" stroke="#8b5cf6" strokeWidth={2} opacity={0.6}>
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0"
                    to="360"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                fill={textColor}
                fontSize={age <= 4 ? 11 : 10}
                fontWeight={node.explored ? "600" : "400"}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && tooltip.node.x != null && tooltip.node.y != null && (
        <div
          className="absolute z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-3 max-w-xs text-sm"
          style={{
            left: Math.min((tooltip.node.x / W) * 100, 75) + "%",
            top: Math.min((tooltip.node.y / H) * 100, 70) + "%",
            transform: "translate(8px, 8px)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-semibold text-gray-800">{tooltip.node.title}</p>
          {tooltip.node.description && (
            <p className="text-gray-500 mt-0.5 text-xs">{tooltip.node.description}</p>
          )}
          <button
            onClick={() => handleNodeClick(tooltip.node)}
            disabled={generating === tooltip.node.id}
            className="mt-2 w-full py-1.5 px-3 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {tooltip.node.explored
              ? "Open Lesson →"
              : generating === tooltip.node.id
              ? "Generating…"
              : "Start Exploring!"}
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex gap-3 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-purple-500" /> Explored
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-gray-200 border border-dashed border-gray-400" /> Suggested
        </span>
      </div>
    </div>
  );
}
