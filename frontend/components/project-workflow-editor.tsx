"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Link2, Plus, Trash2, WandSparkles } from "lucide-react";
import {
  cn,
  getTaskStatusInlineStyle,
  normalizeTaskWorkflow,
  type TaskWorkflow,
  type TaskWorkflowNode,
} from "@/lib/utils";

const NODE_WIDTH = 164;
const NODE_HEIGHT = 60;

function createNodeId() {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEdgeId(source: string, target: string) {
  return `edge-${source}-${target}-${Math.random().toString(36).slice(2, 6)}`;
}

function getConnectorPath(source: TaskWorkflowNode, target: TaskWorkflowNode) {
  const sourceCenterX = source.x + NODE_WIDTH / 2;
  const sourceCenterY = source.y + NODE_HEIGHT / 2;
  const targetCenterX = target.x + NODE_WIDTH / 2;
  const targetCenterY = target.y + NODE_HEIGHT / 2;

  let startX = sourceCenterX;
  let startY = sourceCenterY;
  let endX = targetCenterX;
  let endY = targetCenterY;

  if (target.x >= source.x + NODE_WIDTH) {
    startX = source.x + NODE_WIDTH;
    startY = sourceCenterY;
    endX = target.x;
    endY = targetCenterY;
  } else if (source.x >= target.x + NODE_WIDTH) {
    startX = source.x;
    startY = sourceCenterY;
    endX = target.x + NODE_WIDTH;
    endY = targetCenterY;
  } else if (target.y >= source.y + NODE_HEIGHT) {
    startX = sourceCenterX;
    startY = source.y + NODE_HEIGHT;
    endX = targetCenterX;
    endY = target.y;
  } else {
    startX = sourceCenterX;
    startY = source.y;
    endX = targetCenterX;
    endY = target.y + NODE_HEIGHT;
  }

  const controlX = (startX + endX) / 2;
  return `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`;
}

function autoLayout(nodes: TaskWorkflowNode[]) {
  return nodes.map((node, index) => ({
    ...node,
    x: 80 + (index % 4) * 220,
    y: 80 + Math.floor(index / 4) * 140,
  }));
}

function sortNodesByCanvasPosition(nodes: TaskWorkflowNode[]) {
  return [...nodes].sort((left, right) => {
    const horizontalDiff = left.x - right.x;
    if (Math.abs(horizontalDiff) > 40) return horizontalDiff;
    return left.y - right.y;
  });
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const updateSize = () => {
      setSize({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

function WorkflowGraph({
  workflow,
  selectedNodeId,
  selectedEdgeId,
  connectingFromId,
  onNodeMouseDown,
  onNodeClick,
  onEdgeClick,
  className,
  fitToView = false,
}: {
  workflow: TaskWorkflow;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  connectingFromId?: string | null;
  onNodeMouseDown?: (
    nodeId: string,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  className?: string;
  fitToView?: boolean;
}) {
  const markerId = useMemo(
    () => `workflow-arrow-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );
  const [containerRef, containerSize] = useElementSize<HTMLDivElement>();

  const layout = useMemo(() => {
    const padding = 48;
    const minX = Math.min(...workflow.nodes.map((node) => node.x), 0);
    const minY = Math.min(...workflow.nodes.map((node) => node.y), 0);
    const maxX = Math.max(
      ...workflow.nodes.map((node) => node.x + NODE_WIDTH),
      NODE_WIDTH,
    );
    const maxY = Math.max(
      ...workflow.nodes.map((node) => node.y + NODE_HEIGHT),
      NODE_HEIGHT,
    );

    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    const nodes = workflow.nodes.map((node) => ({
      ...node,
      x: node.x - minX + padding,
      y: node.y - minY + padding,
    }));

    return {
      width,
      height,
      nodes,
    };
  }, [workflow]);

  const scale =
    fitToView && containerSize.width > 0 && containerSize.height > 0
      ? Math.min(
          containerSize.width / layout.width,
          containerSize.height / layout.height,
          1,
        )
      : 1;
  const offsetX = fitToView
    ? Math.max((containerSize.width - layout.width * scale) / 2, 0)
    : 0;
  const offsetY = fitToView
    ? Math.max((containerSize.height - layout.height * scale) / 2, 0)
    : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.12),_transparent_32%),linear-gradient(180deg,_#fff,_#f8fafc)]",
        fitToView ? "overflow-hidden" : "overflow-auto",
        className,
      )}
    >
      <div
        className='relative'
        style={{
          width: layout.width,
          height: layout.height,
          transform: fitToView
            ? `translate(${offsetX}px, ${offsetY}px) scale(${scale})`
            : undefined,
          transformOrigin: "top left",
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.14) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      >
        <svg className='absolute inset-0 h-full w-full overflow-visible pointer-events-none'>
          <defs>
            <marker
              id={markerId}
              viewBox='0 0 10 10'
              refX='8'
              refY='5'
              markerWidth='6'
              markerHeight='6'
              orient='auto-start-reverse'
            >
              <path d='M 0 0 L 10 5 L 0 10 z' fill='#cbd5e1' />
            </marker>
          </defs>
          {workflow.edges.map((edge) => {
            const source = layout.nodes.find((node) => node.id === edge.source);
            const target = layout.nodes.find((node) => node.id === edge.target);
            if (!source || !target) return null;

            const path = getConnectorPath(source, target);
            const isSelected = selectedEdgeId === edge.id;
            const midX =
              (source.x + NODE_WIDTH / 2 + target.x + NODE_WIDTH / 2) / 2;
            const midY =
              (source.y + NODE_HEIGHT / 2 + target.y + NODE_HEIGHT / 2) / 2;

            return (
              <g key={edge.id}>
                {/* Wide invisible hit area */}
                <path
                  d={path}
                  fill='none'
                  stroke='transparent'
                  strokeWidth='16'
                  className={onEdgeClick ? "cursor-pointer" : ""}
                  onClick={() => onEdgeClick?.(edge.id)}
                />
                {/* Visible path */}
                <path
                  d={path}
                  fill='none'
                  stroke={isSelected ? "#ef4444" : "#cbd5e1"}
                  strokeWidth='3'
                  markerEnd={`url(#${markerId})`}
                  className={
                    onEdgeClick ? "cursor-pointer pointer-events-none" : ""
                  }
                />
                {/* Delete button at midpoint when selected */}
                {isSelected && onEdgeClick && (
                  <g
                    transform={`translate(${midX}, ${midY})`}
                    onClick={() => onEdgeClick(edge.id)}
                    className='cursor-pointer'
                    style={{ pointerEvents: "all" }}
                  >
                    <circle r='10' fill='#ef4444' />
                    <text
                      textAnchor='middle'
                      dominantBaseline='central'
                      fill='white'
                      fontSize='13'
                      fontWeight='bold'
                      style={{ userSelect: "none" }}
                    >
                      ×
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {layout.nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isConnecting = connectingFromId === node.id;

          return (
            <button
              key={node.id}
              type='button'
              onMouseDown={(event) => onNodeMouseDown?.(node.id, event)}
              onClick={() => onNodeClick?.(node.id)}
              className={cn(
                "absolute flex h-[60px] w-[164px] items-center justify-center rounded-xl border px-4 text-center text-sm font-semibold shadow-sm transition-all",
                isSelected && "ring-4 ring-sky-200",
                isConnecting && "ring-4 ring-emerald-200",
                !onNodeClick && "cursor-default",
              )}
              style={{
                left: node.x,
                top: node.y,
                ...getTaskStatusInlineStyle(node.name, workflow),
              }}
            >
              {node.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WorkflowPreview({
  workflow,
  className,
}: {
  workflow: TaskWorkflow;
  className?: string;
}) {
  return <WorkflowGraph workflow={workflow} className={className} fitToView />;
}

export function ProjectWorkflowEditor({
  open,
  initialWorkflow,
  isSaving,
  onClose,
  onSave,
}: {
  open: boolean;
  initialWorkflow: TaskWorkflow;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (workflow: TaskWorkflow) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [workflow, setWorkflow] = useState<TaskWorkflow>(initialWorkflow);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialWorkflow.nodes[0]?.id ?? null,
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const normalized = normalizeTaskWorkflow(
      initialWorkflow,
      initialWorkflow.nodes.map((node) => node.name),
    );
    setWorkflow(normalized);
    setSelectedNodeId(normalized.nodes[0]?.id ?? null);
    setSelectedEdgeId(null);
    setConnectingFromId(null);
    setDragging(null);
  }, [initialWorkflow, open]);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (event: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const nextX = Math.max(
        24,
        event.clientX - rect.left + canvas.scrollLeft - dragging.offsetX,
      );
      const nextY = Math.max(
        24,
        event.clientY - rect.top + canvas.scrollTop - dragging.offsetY,
      );

      setWorkflow((current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          node.id === dragging.nodeId ? { ...node, x: nextX, y: nextY } : node,
        ),
      }));
    };

    const handleMouseUp = () => setDragging(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  if (!open) return null;

  const selectedNode = selectedNodeId
    ? (workflow.nodes.find((node) => node.id === selectedNodeId) ?? null)
    : null;

  const addNode = () => {
    const nextIndex = workflow.nodes.length + 1;
    const nextNode: TaskWorkflowNode = {
      id: createNodeId(),
      name: `STATUS ${nextIndex}`,
      color: "#2563EB",
      x: 80 + ((nextIndex - 1) % 4) * 220,
      y: 80 + Math.floor((nextIndex - 1) / 4) * 140,
    };

    setWorkflow((current) => ({
      ...current,
      nodes: [...current.nodes, nextNode],
    }));
    setSelectedNodeId(nextNode.id);
  };

  const removeNode = (nodeId: string) => {
    setWorkflow((current) => ({
      nodes: current.nodes.filter((node) => node.id !== nodeId),
      edges: current.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId,
      ),
    }));
    const nextNode = workflow.nodes.find((node) => node.id !== nodeId);
    setSelectedNodeId((current) =>
      current === nodeId ? (nextNode?.id ?? null) : current,
    );
    setConnectingFromId((current) => (current === nodeId ? null : current));
    setSelectedEdgeId(null);
  };

  const removeEdge = (edgeId: string) => {
    setWorkflow((current) => ({
      ...current,
      edges: current.edges.filter((edge) => edge.id !== edgeId),
    }));
    setSelectedEdgeId(null);
  };

  const selectOrConnectNode = (nodeId: string) => {
    setSelectedEdgeId(null);
    if (connectingFromId && connectingFromId !== nodeId) {
      const edgeExists = workflow.edges.some(
        (edge) => edge.source === connectingFromId && edge.target === nodeId,
      );
      if (!edgeExists) {
        setWorkflow((current) => ({
          ...current,
          edges: [
            ...current.edges,
            {
              id: createEdgeId(connectingFromId, nodeId),
              source: connectingFromId,
              target: nodeId,
            },
          ],
        }));
      }
      setSelectedNodeId(nodeId);
      setConnectingFromId(null);
      return;
    }

    setSelectedNodeId(nodeId);
  };

  const saveWorkflow = () => {
    const normalized = normalizeTaskWorkflow(
      {
        nodes: sortNodesByCanvasPosition(workflow.nodes),
        edges: workflow.edges,
      },
      workflow.nodes.map((node) => node.name),
    );
    onSave(normalized);
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4'>
      <div className='flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl'>
        <div className='flex items-center justify-between border-b border-slate-200 px-6 py-4'>
          <div>
            <h3 className='text-lg font-semibold text-slate-900'>
              Workflow Builder
            </h3>
            <p className='text-sm text-slate-500'>
              Drag nodes, connect transitions, and choose a color for each
              status.
            </p>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50'
          >
            Close
          </button>
        </div>

        <div className='grid flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_320px]'>
          <div className='flex min-h-0 flex-col border-r border-slate-200'>
            <div className='flex items-center gap-2 border-b border-slate-200 px-5 py-3'>
              <button
                type='button'
                onClick={addNode}
                className='inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700'
              >
                <Plus size={14} />
                Add status
              </button>
              <button
                type='button'
                onClick={() =>
                  setWorkflow((current) => ({
                    ...current,
                    nodes: autoLayout(current.nodes),
                  }))
                }
                className='inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50'
              >
                <WandSparkles size={14} />
                Auto layout
              </button>
              <div className='ml-auto text-xs text-slate-400'>
                {connectingFromId
                  ? "Select a target node to create a transition"
                  : "Drag and drop cards to arrange the flow"}
              </div>
            </div>

            <div ref={canvasRef} className='min-h-0 flex-1 p-5'>
              <WorkflowGraph
                workflow={workflow}
                selectedNodeId={selectedNodeId}
                selectedEdgeId={selectedEdgeId}
                connectingFromId={connectingFromId}
                onEdgeClick={(edgeId) => {
                  setSelectedEdgeId((current) =>
                    current === edgeId ? null : edgeId,
                  );
                  setSelectedNodeId(null);
                }}
                onNodeMouseDown={(nodeId, event) => {
                  setSelectedEdgeId(null);
                  if ((event.target as HTMLElement).closest("input")) return;

                  const canvas = canvasRef.current;
                  const node = workflow.nodes.find(
                    (item) => item.id === nodeId,
                  );
                  if (!canvas || !node) return;

                  const rect = canvas.getBoundingClientRect();
                  setDragging({
                    nodeId,
                    offsetX:
                      event.clientX - rect.left + canvas.scrollLeft - node.x,
                    offsetY:
                      event.clientY - rect.top + canvas.scrollTop - node.y,
                  });
                }}
                onNodeClick={selectOrConnectNode}
                className='h-full'
              />
            </div>
          </div>

          <div className='flex min-h-0 flex-col bg-slate-50/70'>
            <div className='border-b border-slate-200 px-5 py-4'>
              <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
                {selectedEdgeId ? "Connection Detail" : "Status Detail"}
              </p>
            </div>
            <div className='min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5'>
              {selectedEdgeId ? (
                (() => {
                  const edge = workflow.edges.find(
                    (e) => e.id === selectedEdgeId,
                  );
                  const sourceNode = edge
                    ? workflow.nodes.find((n) => n.id === edge.source)
                    : null;
                  const targetNode = edge
                    ? workflow.nodes.find((n) => n.id === edge.target)
                    : null;
                  if (!edge || !sourceNode || !targetNode) return null;
                  return (
                    <div className='space-y-4'>
                      <div className='rounded-2xl border border-slate-200 bg-white p-4 space-y-3'>
                        <div className='flex items-center gap-2 text-sm text-slate-600'>
                          <span
                            className='rounded-md px-2 py-1 text-xs font-semibold'
                            style={getTaskStatusInlineStyle(
                              sourceNode.name,
                              workflow,
                            )}
                          >
                            {sourceNode.name}
                          </span>
                          <span className='text-slate-400'>→</span>
                          <span
                            className='rounded-md px-2 py-1 text-xs font-semibold'
                            style={getTaskStatusInlineStyle(
                              targetNode.name,
                              workflow,
                            )}
                          >
                            {targetNode.name}
                          </span>
                        </div>
                        <p className='text-xs text-slate-400'>
                          Nhấn nút bên dưới hoặc click vào dấu × trên mũi tên để
                          xóa liên kết này.
                        </p>
                      </div>
                      <div className='rounded-2xl border border-red-100 bg-red-50 p-3'>
                        <button
                          type='button'
                          onClick={() => removeEdge(edge.id)}
                          className='inline-flex items-center gap-2 text-sm font-medium text-red-600'
                        >
                          <Trash2 size={14} />
                          Xóa liên kết này
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : selectedNode ? (
                <>
                  <div className='space-y-2'>
                    <label className='text-xs font-medium text-slate-500'>
                      Status name
                    </label>
                    <input
                      value={selectedNode.name}
                      onChange={(event) =>
                        setWorkflow((current) => ({
                          ...current,
                          nodes: current.nodes.map((node) =>
                            node.id === selectedNode.id
                              ? { ...node, name: event.target.value }
                              : node,
                          ),
                        }))
                      }
                      className='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400'
                    />
                  </div>

                  <div className='space-y-2'>
                    <label className='text-xs font-medium text-slate-500'>
                      Status color
                    </label>
                    <div className='flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5'>
                      <input
                        type='color'
                        value={selectedNode.color}
                        onChange={(event) =>
                          setWorkflow((current) => ({
                            ...current,
                            nodes: current.nodes.map((node) =>
                              node.id === selectedNode.id
                                ? {
                                    ...node,
                                    color: event.target.value.toUpperCase(),
                                  }
                                : node,
                            ),
                          }))
                        }
                        className='h-10 w-14 cursor-pointer rounded border-0 bg-transparent p-0'
                      />
                      <div
                        className='rounded-lg border px-3 py-1.5 text-sm font-semibold'
                        style={getTaskStatusInlineStyle(
                          selectedNode.name,
                          workflow,
                        )}
                      >
                        {selectedNode.color}
                      </div>
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <label className='text-xs font-medium text-slate-500'>
                      Transitions
                    </label>
                    <div className='space-y-2 rounded-2xl border border-slate-200 bg-white p-3'>
                      <button
                        type='button'
                        onClick={() =>
                          setConnectingFromId((current) =>
                            current === selectedNode.id
                              ? null
                              : selectedNode.id,
                          )
                        }
                        className={cn(
                          "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                          connectingFromId === selectedNode.id
                            ? "bg-emerald-600 text-white"
                            : "border border-slate-200 text-slate-600 hover:bg-slate-50",
                        )}
                      >
                        <Link2 size={14} />
                        {connectingFromId === selectedNode.id
                          ? "Connecting..."
                          : "Connect to another status"}
                      </button>

                      <div className='space-y-2'>
                        {workflow.edges
                          .filter((edge) => edge.source === selectedNode.id)
                          .map((edge) => {
                            const targetNode = workflow.nodes.find(
                              (node) => node.id === edge.target,
                            );
                            if (!targetNode) return null;

                            return (
                              <div
                                key={edge.id}
                                className='flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm'
                              >
                                <span className='text-slate-600'>
                                  {targetNode.name}
                                </span>
                                <button
                                  type='button'
                                  onClick={() =>
                                    setWorkflow((current) => ({
                                      ...current,
                                      edges: current.edges.filter(
                                        (item) => item.id !== edge.id,
                                      ),
                                    }))
                                  }
                                  className='rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600'
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            );
                          })}
                        {workflow.edges.filter(
                          (edge) => edge.source === selectedNode.id,
                        ).length === 0 && (
                          <p className='text-xs text-slate-400'>
                            No outgoing transitions from this status yet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className='rounded-2xl border border-red-100 bg-red-50 p-3'>
                    <button
                      type='button'
                      disabled={workflow.nodes.length === 1}
                      onClick={() => removeNode(selectedNode.id)}
                      className='inline-flex items-center gap-2 text-sm font-medium text-red-600 disabled:opacity-50'
                    >
                      <Trash2 size={14} />
                      Delete this status
                    </button>
                  </div>
                </>
              ) : (
                <div className='rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-400'>
                  {selectedEdgeId
                    ? "Liên kết đã được chọn."
                    : "Select a status on the canvas to edit its name, color, and transitions."}
                </div>
              )}

              <div className='space-y-2'>
                <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
                  Status Order
                </p>
                <div className='space-y-2 rounded-2xl border border-slate-200 bg-white p-3'>
                  {sortNodesByCanvasPosition(workflow.nodes).map(
                    (node, index) => (
                      <button
                        key={node.id}
                        type='button'
                        onClick={() => setSelectedNodeId(node.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm",
                          selectedNodeId === node.id
                            ? "border-sky-300 bg-sky-50"
                            : "border-transparent hover:border-slate-200 hover:bg-slate-50",
                        )}
                      >
                        <span className='flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500'>
                          {index + 1}
                        </span>
                        <span
                          className='rounded-md px-2 py-1 text-xs font-semibold'
                          style={getTaskStatusInlineStyle(node.name, workflow)}
                        >
                          {node.name}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>

            <div className='flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4'>
              <button
                type='button'
                onClick={onClose}
                className='rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={saveWorkflow}
                disabled={isSaving}
                className='rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50'
              >
                {isSaving ? "Saving..." : "Save workflow"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
