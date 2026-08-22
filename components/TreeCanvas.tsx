"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  useStore as useFlowStore,
  type Edge,
  type Node,
} from "reactflow";
import { useStore } from "@/lib/store";
import { layoutTree, NODE_H, NODE_W } from "@/lib/layout";
import { layoutClusters, type ClusterKey } from "@/lib/cluster";
import { layoutIsolated } from "@/lib/isolate";
import { personMatches, tallyFor, userName } from "@/lib/helpers";
import { computeKinship } from "@/lib/kinship";
import { allSuggestions } from "@/lib/suggestions";
import {
  BLOOD_COLOR,
  MARRIED_COLOR,
  PersonNode,
  type PersonNodeData,
} from "./PersonNode";
import { RelationshipEdge, type RelationshipEdgeData } from "./RelationshipEdge";
import { ClusterBubbleNode, type ClusterBubbleData } from "./ClusterBubbleNode";

const nodeTypes = { person: PersonNode, clusterBubble: ClusterBubbleNode };
const edgeTypes = { relationship: RelationshipEdge };

export type ViewMode = "tree" | "clusters" | "map";

export interface Selection {
  kind: "person" | "relationship";
  id: string;
}

export interface PathHighlight {
  personIds: string[];
  relationshipIds: string[];
}

export function TreeCanvas(props: {
  familyId: string;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
  searchQuery: string;
  focusPersonId: string | null;
  focusNonce: number;
  highlight: PathHighlight | null;
  mode: ViewMode;
  clusterKey: ClusterKey;
  isolateId: string | null;
  rightInset: number;
  onQuickAdd: (personId: string) => void;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function CanvasInner({
  familyId,
  selection,
  onSelect,
  searchQuery,
  focusPersonId,
  focusNonce,
  highlight,
  mode,
  clusterKey,
  isolateId,
  rightInset,
  onQuickAdd,
}: {
  familyId: string;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
  searchQuery: string;
  focusPersonId: string | null;
  focusNonce: number;
  highlight: PathHighlight | null;
  mode: ViewMode;
  clusterKey: ClusterKey;
  isolateId: string | null;
  rightInset: number;
  onQuickAdd: (personId: string) => void;
}) {
  const { state, currentUser } = useStore();
  const { setCenter, fitView } = useReactFlow();
  const viewW = useFlowStore((s) => s.width);
  const viewH = useFlowStore((s) => s.height);

  const people = useMemo(
    () => state.people.filter((p) => p.familyId === familyId),
    [state.people, familyId]
  );
  const relationships = useMemo(
    () => state.relationships.filter((r) => r.familyId === familyId),
    [state.relationships, familyId]
  );

  const treePositions = useMemo(
    () => layoutTree(people, relationships),
    [people, relationships]
  );

  const kinship = useMemo(
    () => computeKinship(people, relationships, currentUser?.id),
    [people, relationships, currentUser?.id]
  );

  const clusterLayout = useMemo(
    () => (mode === "clusters" ? layoutClusters(people, clusterKey) : null),
    [mode, people, clusterKey]
  );

  const isolation = useMemo(() => {
    if (!isolateId || mode !== "tree") return null;
    if (!people.some((p) => p.id === isolateId)) return null;
    return layoutIsolated(people, relationships, isolateId);
  }, [isolateId, mode, people, relationships]);

  const positions = useMemo(() => {
    if (isolation) return isolation.positions;
    if (!clusterLayout) return treePositions;
    const map = new Map<string, { x: number; y: number }>();
    clusterLayout.positions.forEach((v, k) => map.set(k, v));
    return map;
  }, [treePositions, clusterLayout, isolation]);

  const query = searchQuery.trim().toLowerCase();

  const nodes: Node<PersonNodeData | ClusterBubbleData>[] = useMemo(() => {
    // an active search is the user's current intent — it outranks the Me path
    const onPath =
      highlight && !query && mode === "tree" ? new Set(highlight.personIds) : null;

    const bubbleNodes: Node<ClusterBubbleData>[] = (clusterLayout?.bubbles ?? []).map(
      (b) => ({
        id: b.id,
        type: "clusterBubble",
        position: { x: b.x, y: b.y },
        selectable: false,
        draggable: false,
        zIndex: -1,
        data: { label: b.label, count: b.count, muted: b.muted, size: b.size },
      })
    );

    // in isolate mode the rest of the family is removed outright, not faded:
    // ghosted cards keep drawing their lines across the stage
    const visible = isolation
      ? people.filter((p) => isolation.focusIds.has(p.id))
      : people;

    const personNodes: Node<PersonNodeData>[] = visible.map((p) => {
      const pos = positions.get(p.id);
      const dimmed = isolation
        ? false
        : query
          ? !personMatches(p, query)
          : onPath
            ? !onPath.has(p.id)
            : false;
      return {
        id: p.id,
        type: "person",
        position: { x: pos?.x ?? 0, y: pos?.y ?? 0 },
        selected: selection?.kind === "person" && selection.id === p.id,
        data: {
          name: p.name,
          birthYear: p.birthYear,
          deathYear: p.deathYear,
          addedByName: userName(state, p.addedById).split(" ")[0],
          claimed: !!p.accountUserId,
          isYou: !!currentUser && p.accountUserId === currentUser.id,
          dimmed,
          marriedIn: !kinship.bloodIds.has(p.id),
          personId: p.id,
          photoUrl: p.photoUrl,
          onQuickAdd,
          quickAddVisible: selection?.kind === "person" && selection.id === p.id,
        },
      };
    });

    return [...bubbleNodes, ...personNodes];
  }, [
    people,
    positions,
    selection,
    query,
    state,
    highlight,
    mode,
    clusterLayout,
    isolation,
    kinship,
    onQuickAdd,
    currentUser,
  ]);

  const edges: Edge<RelationshipEdgeData>[] = useMemo(() => {
    if (mode === "clusters") return [];
    const onPath = highlight && !query ? new Set(highlight.relationshipIds) : null;

    // faint dotted branches for assumed connections; clicking one opens a
    // panel where it can be confirmed or denied
    const assumedEdges: Edge<RelationshipEdgeData>[] = allSuggestions(
      relationships,
      state.dismissedSuggestions
    )
      // sibling guesses are left off the canvas for the same reason the
      // confirmed ones are — they crowd it without adding information.
      // The review queue and each person's panel still surface them.
      .filter((s) => s.type !== "SIBLING_OF")
      .map((s) => {
      const lateral = s.type !== "PARENT_OF";
      const fromLeftOfTo =
        (positions.get(s.fromPersonId)?.x ?? 0) <= (positions.get(s.toPersonId)?.x ?? 0);
      return {
        id: `sugg|${s.audience[0]}|${s.key}`,
        source: s.fromPersonId,
        target: s.toPersonId,
        type: "relationship",
        sourceHandle: lateral ? (fromLeftOfTo ? "sr" : "sl") : "b",
        targetHandle: lateral ? (fromLeftOfTo ? "tl" : "tr") : "t",
        data: {
          type: s.type,
          confirms: 0,
          disputes: 0,
          assumed: true,
          dimmed: !!onPath || !!query,
        },
      };
    });

    // When a child's two recorded parents are also recorded as a couple, the
    // descent line should leave the marriage bar between them rather than
    // running from each parent's card — the conventional way family trees are
    // drawn. A disputed parentage is deliberately excluded so it stays visible
    // as its own flagged line instead of disappearing into a merged one.
    const spousePairs = new Set(
      relationships
        .filter((r) => r.type === "SPOUSE_OF")
        .map((r) => [r.fromPersonId, r.toPersonId].sort().join("|"))
    );
    const disputedRels = new Set(
      state.confirmations.filter((c) => c.type === "DISPUTE").map((c) => c.relationshipId)
    );
    const parentRelsByChild = new Map<string, typeof relationships>();
    for (const r of relationships) {
      if (r.type !== "PARENT_OF") continue;
      if (!parentRelsByChild.has(r.toPersonId)) parentRelsByChild.set(r.toPersonId, []);
      parentRelsByChild.get(r.toPersonId)!.push(r);
    }
    const coupleDescent = new Map<
      string,
      { parents: [string, string]; rels: typeof relationships }
    >();
    parentRelsByChild.forEach((rels, childId) => {
      if (rels.length !== 2) return;
      const parents = rels.map((r) => r.fromPersonId);
      if (!spousePairs.has([...parents].sort().join("|"))) return;
      if (rels.some((r) => disputedRels.has(r.id))) return;
      coupleDescent.set(childId, { parents: [parents[0], parents[1]], rels });
    });
    const mergedRelIds = new Set(
      Array.from(coupleDescent.values()).flatMap((c) => c.rels.map((r) => r.id))
    );

    // Give every set of co-parents its own sibling bar. Families whose bars
    // would overlap horizontally get different lanes, so two unrelated
    // branches never share one continuous rail.
    const laneOf = new Map<string, number>(); // relationship id -> lane
    {
      const families = new Map<string, { rels: string[]; left: number; right: number }>();
      for (const r of relationships) {
        if (r.type !== "PARENT_OF") continue;
        const coParents = relationships
          .filter((o) => o.type === "PARENT_OF" && o.toPersonId === r.toPersonId)
          .map((o) => o.fromPersonId)
          .sort();
        const key = coParents.join("+");
        const xs = [
          ...coParents.map((id) => (positions.get(id)?.x ?? 0) + NODE_W / 2),
          (positions.get(r.toPersonId)?.x ?? 0) + NODE_W / 2,
        ];
        const fam = families.get(key);
        if (fam) {
          fam.rels.push(r.id);
          fam.left = Math.min(fam.left, ...xs);
          fam.right = Math.max(fam.right, ...xs);
        } else {
          families.set(key, {
            rels: [r.id],
            left: Math.min(...xs),
            right: Math.max(...xs),
          });
        }
      }
      const placed: { left: number; right: number; lane: number }[] = [];
      for (const fam of Array.from(families.values()).sort((a, b) => a.left - b.left)) {
        const taken = new Set(
          placed.filter((p) => p.right > fam.left && p.left < fam.right).map((p) => p.lane)
        );
        let lane = 0;
        while (taken.has(lane)) lane++;
        placed.push({ left: fam.left, right: fam.right, lane });
        fam.rels.forEach((id) => laneOf.set(id, lane));
      }
    }

    // one descent line per child of a couple, springing from the marriage bar
    const coupleEdges: Edge<RelationshipEdgeData>[] = [];
    coupleDescent.forEach((info, childId) => {
      const pa = positions.get(info.parents[0]);
      const pb = positions.get(info.parents[1]);
      const kid = positions.get(childId);
      if (!pa || !pb || !kid) return;
      const primary = info.rels[0];
      const confirms = info.rels.reduce(
        (n, r) => n + tallyFor(state.confirmations, r.id).confirms,
        0
      );
      coupleEdges.push({
        id: `couple|${childId}`,
        source: info.parents[0],
        target: childId,
        type: "relationship",
        sourceHandle: "b",
        targetHandle: "t",
        selected:
          selection?.kind === "relationship" &&
          info.rels.some((r) => r.id === selection.id),
        data: {
          type: "PARENT_OF",
          confirms,
          disputes: 0,
          highlighted: onPath ? info.rels.some((r) => onPath.has(r.id)) : false,
          dimmed: onPath ? !info.rels.some((r) => onPath.has(r.id)) : false,
          lane: laneOf.get(primary.id),
          origin: {
            x: (pa.x + pb.x) / 2 + NODE_W / 2,
            y: pa.y + NODE_H / 2,
            cardBottomY: pa.y + NODE_H,
          },
        },
      });
    });

    const realEdges = relationships
      .filter((r) => !mergedRelIds.has(r.id))
      // Sibling lines are dropped from the canvas: siblings already sit side
      // by side, so the line restated what the layout showed and crowded
      // everything else. Two exceptions stay drawn, because hiding them would
      // hide information the layout does *not* convey — a disputed sibling
      // claim, and any link on a kinship path being traced.
      .filter(
        (r) =>
          r.type !== "SIBLING_OF" ||
          tallyFor(state.confirmations, r.id).disputes > 0 ||
          (onPath?.has(r.id) ?? false)
      )
      .map((r) => {
      const from = positions.get(r.fromPersonId);
      const to = positions.get(r.toPersonId);
      const lateral = r.type !== "PARENT_OF";
      const fromLeftOfTo = (from?.x ?? 0) <= (to?.x ?? 0);
      const { confirms, disputes } = tallyFor(state.confirmations, r.id);
      return {
        id: r.id,
        source: r.fromPersonId,
        target: r.toPersonId,
        type: "relationship",
        sourceHandle: lateral ? (fromLeftOfTo ? "sr" : "sl") : "b",
        targetHandle: lateral ? (fromLeftOfTo ? "tl" : "tr") : "t",
        selected: selection?.kind === "relationship" && selection.id === r.id,
        data: {
          type: r.type,
          confirms,
          disputes,
          highlighted: onPath ? onPath.has(r.id) : false,
          dimmed: onPath ? !onPath.has(r.id) : false,
          lane: laneOf.get(r.id),
          kind: r.kind,
        },
      };
    });

    const all = [...assumedEdges, ...coupleEdges, ...realEdges];
    // drop every line that would reach outside the isolated family
    return isolation
      ? all.filter(
          (e) => isolation.focusIds.has(e.source) && isolation.focusIds.has(e.target)
        )
      : all;
  }, [
    relationships,
    positions,
    selection,
    state.confirmations,
    state.dismissedSuggestions,
    highlight,
    query,
    mode,
    isolation,
  ]);

  // fly to a person when asked (search result, panel link)
  useEffect(() => {
    if (!focusPersonId) return;
    const pos = positions.get(focusPersonId);
    if (!pos) return;
    setCenter(pos.x + NODE_W / 2, pos.y + NODE_H / 2, {
      zoom: 1.1,
      duration: 500,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPersonId, focusNonce]);

  // Refit when *switching* between tree and cluster views (or cluster key).
  // Deliberately skips the first run so it can't stomp the initial view
  // chosen below.
  const firstViewPass = useRef(true);
  useEffect(() => {
    if (firstViewPass.current) {
      firstViewPass.current = false;
      return;
    }
    const t = setTimeout(() => fitView({ padding: 0.15, duration: 500 }), 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, clusterKey]);

  /**
   * Frame a set of node positions. Computed from the layout we just produced
   * rather than via fitView, which silently bails while a freshly swapped
   * node set is still unmeasured — the exact failure that left the camera
   * stranded over empty canvas.
   */
  const frameTo = useCallback(
    (
      pts: { x: number; y: number }[],
      opts: { inset?: number; maxZoom?: number } = {}
    ) => {
      if (!pts.length || !viewW || !viewH) return;
      const minX = Math.min(...pts.map((p) => p.x));
      const maxX = Math.max(...pts.map((p) => p.x)) + NODE_W;
      const minY = Math.min(...pts.map((p) => p.y));
      const maxY = Math.max(...pts.map((p) => p.y)) + NODE_H;
      const inset = opts.inset ?? 0;
      const usableW = Math.max(240, viewW - inset);
      const zoom = Math.min(
        (usableW * 0.84) / (maxX - minX),
        (viewH * 0.8) / (maxY - minY),
        opts.maxZoom ?? 1.1
      );
      // nudge the target right so content lands clear of the detail panel
      setCenter((minX + maxX) / 2 + inset / 2 / zoom, (minY + maxY) / 2, {
        zoom,
        duration: 500,
      });
    },
    [viewW, viewH, setCenter]
  );

  // frame the isolated family as it takes the stage
  useEffect(() => {
    if (!isolateId || !isolation) return;
    const t = setTimeout(
      () => frameTo(Array.from(isolation.positions.values()), { inset: rightInset }),
      40
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isolateId, rightInset, viewW, viewH]);

  // ...and put the whole tree back in view on the way out, so leaving isolate
  // mode doesn't strand you over the empty space the family used to occupy
  const wasIsolating = useRef(false);
  useEffect(() => {
    if (isolateId) {
      wasIsolating.current = true;
      return;
    }
    if (!wasIsolating.current) return;
    wasIsolating.current = false;
    const t = setTimeout(
      () =>
        frameTo(Array.from(treePositions.values()), {
          inset: rightInset,
          maxZoom: 1,
        }),
      40
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isolateId, treePositions, viewW, viewH]);

  // A tree seven generations wide does not fit on screen at any readable
  // size — fitting it renders every card as an illegible smudge. Open big
  // trees at a readable zoom over a meaningful anchor (your own node, or
  // the oldest generation) and let people zoom out deliberately.
  const nodesInitialized = useNodesInitialized();
  const opened = useRef(false);
  useEffect(() => {
    if (!nodesInitialized || opened.current || people.length === 0) return;
    opened.current = true;
    const xs = Array.from(positions.values()).map((p) => p.x);
    const spread = Math.max(...xs) - Math.min(...xs);
    // "small enough to fit" depends on the screen, not on a fixed number:
    // a tree that fits a laptop is a smear on a phone
    if (spread < Math.max(1200, viewW * 2.2)) {
      fitView({ padding: 0.25, maxZoom: 1 });
      return;
    }
    const anchor =
      people.find((p) => p.accountUserId === currentUser?.id) ??
      [...people].sort(
        (a, b) => (positions.get(a.id)?.y ?? 0) - (positions.get(b.id)?.y ?? 0)
      )[0];
    const pos = anchor && positions.get(anchor.id);
    if (pos) {
      // sit the anchor near the top of the viewport so the generations
      // descending from it are what fills the screen
      const isRoot = anchor.accountUserId !== currentUser?.id;
      // one card is ~190px wide; aim to show three across whatever screen
      const zoom = Math.max(0.45, Math.min(0.9, viewW / 640));
      setCenter(pos.x + NODE_W / 2, pos.y + NODE_H / 2 + (isRoot ? 280 / zoom : 0), {
        zoom,
      });
    } else fitView({ padding: 0.25, maxZoom: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesInitialized, people, positions]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={(_, node) => {
        if (node.type === "person") onSelect({ kind: "person", id: node.id });
      }}
      onEdgeClick={(_, edge) => {
        if (edge.id.startsWith("sugg|")) {
          // assumed edge → open a panel where confirm/deny lives
          onSelect({ kind: "person", id: edge.id.split("|")[1] });
        } else if (edge.id.startsWith("couple|")) {
          // one line, two parent records — open the child, whose panel lists
          // both with their own tallies
          onSelect({ kind: "person", id: edge.id.split("|")[1] });
        } else {
          onSelect({ kind: "relationship", id: edge.id });
        }
      }}
      onPaneClick={() => onSelect(null)}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      minZoom={0.15}
      maxZoom={1.8}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#d6d3d1" />
      <Controls
        showInteractive={false}
        position="top-left"
        className="!left-3 !top-3 sm:!bottom-4 sm:!left-auto sm:!right-4 sm:!top-auto"
      />
      {/* The detail panel opens over the top-right corner, so a minimap
          pinned there was invisible for as long as anyone was actually
          reading someone's details. It steps aside instead. Its nodes carry
          the same blood/married-in colour as the cards, which is the only
          thing legible at that size — grey blocks read as a loading state. */}
      <MiniMap
        position="top-right"
        pannable
        zoomable
        className="!hidden lg:!block"
        style={{ right: rightInset + 16, transition: "right 200ms ease" }}
        nodeColor={(n) =>
          n.type === "person"
            ? (n.data as PersonNodeData).marriedIn
              ? MARRIED_COLOR
              : BLOOD_COLOR
            : "#d6d3d1"
        }
        nodeStrokeWidth={0}
        maskColor="rgba(250,250,249,0.7)"
      />
    </ReactFlow>
  );
}
