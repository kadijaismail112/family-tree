"use client";

import { useMemo } from "react";
import type { Person, Relationship } from "@/lib/types";
import { buildWorld, GEN_LABEL, type Graph } from "@/lib/beta/world";
import { describeRelationship } from "@/lib/relationship";
import { PersonOrb } from "./PersonOrb";

/**
 * TRIAL 1 · One world, drawn as a stack of generations rather than a chart of lines.
 *
 * A family at this scope is small enough that the rows themselves carry the
 * structure — grandparents on top, grandchildren at the bottom — so the
 * connecting lines that make a full tree unreadable aren't needed here.
 */
export function WorldStage({
  anchorId,
  people,
  relationships,
  graph,
  mePersonId,
  selectedId,
  search,
  onSelect,
  onEnter,
}: {
  anchorId: string;
  people: Person[];
  relationships: Relationship[];
  graph: Graph;
  mePersonId: string | null;
  selectedId: string | null;
  search: string;
  onSelect: (personId: string) => void;
  onEnter: (personId: string) => void;
}) {
  const world = useMemo(
    () => buildWorld(anchorId, people, relationships, graph),
    [anchorId, people, relationships, graph]
  );
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  /**
   * Every face in every world says what they are to you, not to the person
   * the world happens to be centred on. Travelling three marriages out and
   * still reading "your great-aunt" is the whole point of letting you leave
   * your own family in the first place.
   */
  const relationOf = useMemo(() => {
    const out = new Map<string, string>();
    if (!mePersonId) return out;
    for (const m of world.members) {
      if (m.personId === mePersonId) continue;
      const r = describeRelationship(m.personId, mePersonId, people, relationships);
      if (r.aTerm) out.set(m.personId, `your ${r.aTerm}`);
      else if (r.kind === "distant") out.set(m.personId, r.label.toLowerCase());
    }
    return out;
  }, [world.members, mePersonId, people, relationships]);

  const query = search.trim().toLowerCase();

  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center gap-1 px-6 py-10">
      {world.rows.map((row) => (
        <div key={row.generation} className="w-full max-w-5xl">
          <div className="mb-1 flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-300/40">
              {GEN_LABEL[row.generation] ?? ""}
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-indigo-400/20 to-transparent" />
          </div>
          <div className="flex flex-wrap items-start justify-center gap-x-3 gap-y-6 pb-6">
            {row.members.map((m) => {
              const person = byId.get(m.personId);
              if (!person) return null;
              return (
                <PersonOrb
                  key={m.personId}
                  personId={m.personId}
                  name={person.name}
                  photoUrl={person.photoUrl}
                  birthYear={person.birthYear}
                  deathYear={person.deathYear}
                  role={m.role}
                  portal={m.portal}
                  beyond={m.beyond}
                  relation={relationOf.get(m.personId)}
                  isYou={m.personId === mePersonId}
                  selected={selectedId === m.personId}
                  dimmed={
                    !!query && !person.name.toLowerCase().includes(query)
                  }
                  onSelect={onSelect}
                  onEnter={onEnter}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
