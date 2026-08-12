"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoOrthographic, geoPath, geoGraticule10, geoDistance } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import landTopo from "world-atlas/land-110m.json";
import type { Person } from "@/lib/types";
import { groupByCity, type CityGroup } from "@/lib/geo";
import { Avatar } from "./ui";

// world-atlas ships TopoJSON; unpack it once at module scope
const land = feature(
  landTopo as never,
  (landTopo as never as { objects: { land: unknown } }).objects.land as never
) as unknown as FeatureCollection<Geometry>;

export function GlobeView({
  people,
  onSelectPerson,
}: {
  people: Person[];
  onSelectPerson: (id: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [rotation, setRotation] = useState<[number, number]>([-20, -15]);
  const [zoom, setZoom] = useState(1);
  const [active, setActive] = useState<CityGroup | null>(null);
  const [spinning, setSpinning] = useState(true);
  const drag = useRef<{ x: number; y: number; rot: [number, number] } | null>(null);

  const { groups, unplaced, without } = useMemo(() => groupByCity(people), [people]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height })
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // idle spin, paused whenever someone is interacting or reading a city
  useEffect(() => {
    if (!spinning || active) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setRotation((r) => [r[0] + dt * 0.004, r[1]]);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spinning, active]);

  const radius = (Math.min(size.w, size.h) / 2 - 30) * zoom;
  const projection = useMemo(
    () =>
      geoOrthographic()
        .translate([size.w / 2, size.h / 2])
        .scale(radius)
        .rotate([rotation[0], rotation[1]]),
    [size.w, size.h, radius, rotation]
  );
  const path = useMemo(() => geoPath(projection), [projection]);
  const centre: [number, number] = [-rotation[0], -rotation[1]];

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, rot: rotation };
    setSpinning(false);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const k = 0.25 / zoom;
    setRotation([
      d.rot[0] + (e.clientX - d.x) * k,
      Math.max(-90, Math.min(90, d.rot[1] - (e.clientY - d.y) * k)),
    ]);
  };
  const endDrag = () => {
    drag.current = null;
  };

  const spinTo = (g: CityGroup) => {
    setSpinning(false);
    setActive(g);
    setRotation([-g.city.lon, -g.city.lat]);
  };

  const maxCount = Math.max(1, ...groups.map((g) => g.people.length));

  return (
    <div className="flex h-full w-full">
      {/* Globe */}
      <div
        ref={wrapRef}
        className="relative min-w-0 flex-1 touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onWheel={(e) => {
          setZoom((z) => Math.max(0.6, Math.min(3, z - e.deltaY * 0.0012)));
        }}
        style={{ cursor: drag.current ? "grabbing" : "grab" }}
      >
        <svg width={size.w} height={size.h} className="block">
          <defs>
            <radialGradient id="globe-shade" cx="35%" cy="30%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f5f5f4" />
            </radialGradient>
          </defs>

          {/* ocean */}
          <circle
            cx={size.w / 2}
            cy={size.h / 2}
            r={radius}
            fill="url(#globe-shade)"
            stroke="#d6d3d1"
          />
          {/* graticule */}
          <path
            d={path(geoGraticule10()) ?? undefined}
            fill="none"
            stroke="#e7e5e4"
            strokeWidth={0.8}
          />
          {/* land */}
          <path d={path(land) ?? undefined} fill="#e7e5e4" stroke="#a8a29e" strokeWidth={0.7} />

          {/* cities */}
          {groups.map((g) => {
            const hidden = geoDistance([g.city.lon, g.city.lat], centre) > Math.PI / 2;
            if (hidden) return null;
            const pt = projection([g.city.lon, g.city.lat]);
            if (!pt) return null;
            const isActive = active?.city.name === g.city.name;
            const r = 4 + (g.people.length / maxCount) * 7;
            return (
              <g
                key={g.city.name}
                transform={`translate(${pt[0]},${pt[1]})`}
                className="cursor-pointer"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => spinTo(g)}
              >
                <circle r={r + 5} fill="#0f766e" opacity={isActive ? 0.22 : 0.1} />
                <circle
                  r={r}
                  fill={isActive ? "#134e4a" : "#0f766e"}
                  stroke="#ffffff"
                  strokeWidth={1.6}
                />
                <text
                  y={-r - 7}
                  textAnchor="middle"
                  className="pointer-events-none fill-stone-700 font-semibold"
                  style={{ fontSize: 11, paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 }}
                >
                  {g.city.name}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="pointer-events-none absolute bottom-4 left-4 hidden rounded-xl border border-stone-200/80 bg-white/90 px-3 py-2 text-[11px] text-stone-500 shadow-sm backdrop-blur md:block">
          Drag to spin · scroll to zoom
        </div>
      </div>

      {/* Side list — a drawer on phones, a column on desktop */}
      <aside className="absolute inset-x-0 bottom-0 z-10 flex max-h-[46%] flex-col overflow-y-auto border-t border-stone-200/70 bg-white md:static md:inset-auto md:max-h-none md:w-72 md:shrink-0 md:border-l md:border-t-0">
        <div className="border-b border-stone-100 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
            Where the family lives
          </p>
          <p className="mt-0.5 text-sm text-stone-600">
            {groups.length} {groups.length === 1 ? "city" : "cities"} ·{" "}
            {groups.reduce((n, g) => n + g.people.length, 0)} people
          </p>
        </div>

        <ul className="p-2">
          {groups.map((g) => (
            <li key={g.city.name}>
              <button
                onClick={() => spinTo(g)}
                className={`w-full rounded-xl px-3 py-2 text-left transition ${
                  active?.city.name === g.city.name
                    ? "bg-teal-800/10"
                    : "hover:bg-stone-50"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-stone-800">
                    {g.city.name}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-teal-800">
                    {g.people.length}
                  </span>
                </span>
                {active?.city.name === g.city.name && (
                  <span className="mt-1.5 flex flex-col gap-1">
                    {g.people.map((p) => (
                      <span
                        key={p.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPerson(p.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            onSelectPerson(p.id);
                          }
                        }}
                        className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs text-stone-600 hover:bg-white"
                      >
                        <Avatar name={p.name} id={p.name} size={20} src={p.photoUrl} />
                        {p.name}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {(unplaced.length > 0 || without > 0) && (
          <div className="mt-auto border-t border-stone-100 px-5 py-3">
            {unplaced.length > 0 && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                  Couldn&apos;t place
                </p>
                <ul className="mt-1 space-y-0.5">
                  {unplaced.map((u) => (
                    <li key={u.label} className="text-xs text-stone-500">
                      {u.label}{" "}
                      <span className="text-stone-400">· {u.people.length}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {without > 0 && (
              <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
                {without} {without === 1 ? "person has" : "people have"} no current
                city recorded.
              </p>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
