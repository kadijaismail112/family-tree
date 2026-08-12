"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { CURRENT_USER_ID } from "@/lib/seed";
import { fileToDataUrl, timeAgo, userName } from "@/lib/helpers";
import type { DetailKey, Person, PersonPhoto } from "@/lib/types";
import { PERSON_DETAIL_FIELDS } from "@/lib/types";
import { Avatar, GhostButton, inputCls, Modal, PrimaryButton, useToast } from "./ui";

type EditorTarget = DetailKey | "photo" | "voice" | "comment";

export function PersonExtras({
  person,
  onSelectPerson,
}: {
  person: Person;
  onSelectPerson: (id: string) => void;
}) {
  const { state, setPersonDetail, setPersonVoice, removePhoto, addComment, removeComment } =
    useStore();
  const toast = useToast();

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState<EditorTarget | null>(null);
  const [lightbox, setLightbox] = useState<PersonPhoto | null>(null);

  useEffect(() => {
    setMenuOpen(false);
    setEditing(null);
    setLightbox(null);
  }, [person.id]);

  const photos = useMemo(
    () =>
      state.photos.filter(
        (ph) => ph.personId === person.id || ph.taggedPersonIds.includes(person.id)
      ),
    [state.photos, person.id]
  );
  const comments = useMemo(
    () => state.comments.filter((c) => c.personId === person.id),
    [state.comments, person.id]
  );

  const filledFields = PERSON_DETAIL_FIELDS.filter((f) => person.details?.[f.key]);
  const emptyFields = PERSON_DETAIL_FIELDS.filter((f) => !person.details?.[f.key]);

  const hasAnything =
    filledFields.length > 0 || photos.length > 0 || comments.length > 0 || !!person.voiceNameUrl;

  const menuItems: { key: EditorTarget; label: string }[] = [
    { key: "photo", label: "Photo of / with them" },
    ...(person.voiceNameUrl ? [] : [{ key: "voice" as const, label: "Voice recording of name" }]),
    { key: "comment", label: "Comment" },
    ...emptyFields.map((f) => ({ key: f.key, label: f.label })),
  ];

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
          More details
        </p>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-teal-800 transition hover:bg-teal-800/10"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add info
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <ul className="absolute right-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
                {menuItems.map((item) => (
                  <li key={item.key}>
                    <button
                      onClick={() => {
                        setEditing(item.key);
                        setMenuOpen(false);
                      }}
                      className="w-full px-3.5 py-1.5 text-left text-[13px] text-stone-700 transition hover:bg-stone-50 hover:text-teal-900"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {!hasAnything && !editing && (
        <p className="rounded-xl border border-dashed border-stone-200 px-3.5 py-3 text-sm text-stone-400">
          Nothing here yet — add a photo, a story, or where they live.
        </p>
      )}

      {/* Inline editors */}
      {editing === "photo" && (
        <PhotoEditor person={person} onDone={() => setEditing(null)} />
      )}
      {editing === "voice" && (
        <VoiceEditor person={person} onDone={() => setEditing(null)} />
      )}
      {editing === "comment" && (
        <CommentComposer
          onCancel={() => setEditing(null)}
          onPost={(text) => {
            addComment(person.id, person.familyId, text);
            setEditing(null);
          }}
        />
      )}
      {editing && editing !== "photo" && editing !== "voice" && editing !== "comment" && (
        <FieldEditor
          fieldKey={editing}
          initial={person.details?.[editing] ?? ""}
          onCancel={() => setEditing(null)}
          onSave={(value) => {
            setPersonDetail(person.id, editing, value);
            setEditing(null);
          }}
        />
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {photos.map((ph) => (
            <button
              key={ph.id}
              onClick={() => setLightbox(ph)}
              className="group relative aspect-square overflow-hidden rounded-lg bg-stone-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ph.dataUrl}
                alt={ph.caption ?? "Family photo"}
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
              {ph.personId !== person.id && (
                <span className="absolute bottom-1 right-1 rounded-full bg-stone-900/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                  tagged
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Voice of name */}
      {person.voiceNameUrl && (
        <VoiceRow
          url={person.voiceNameUrl}
          onRemove={() => setPersonVoice(person.id, null)}
        />
      )}

      {/* Filled text fields */}
      {filledFields.length > 0 && (
        <dl className="space-y-2">
          {filledFields.map((f) => {
            const value = person.details![f.key]!;
            return (
              <div key={f.key} className="group rounded-xl bg-stone-50 px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                    {f.label}
                  </dt>
                  <span className="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={() => setEditing(f.key)}
                      aria-label={`Edit ${f.label}`}
                      className="rounded p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-600"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setPersonDetail(person.id, f.key, null)}
                      aria-label={`Remove ${f.label}`}
                      className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </span>
                </div>
                <dd className="mt-0.5 text-sm leading-snug text-stone-700">
                  {f.kind === "url" ? (
                    <a
                      href={value.startsWith("http") ? value : `https://${value}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all font-medium text-teal-800 underline decoration-teal-700/30 underline-offset-2 hover:decoration-teal-700"
                    >
                      {value.replace(/^https?:\/\//, "")}
                    </a>
                  ) : f.kind === "date" ? (
                    formatDate(value)
                  ) : (
                    <span className="whitespace-pre-wrap">{value}</span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {/* Comments */}
      {comments.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
            Comments · {comments.length}
          </p>
          <ul className="space-y-1.5">
            {[...comments]
              .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
              .map((c) => (
                <li key={c.id} className="group rounded-xl bg-stone-50 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-stone-600">
                      <Avatar name={userName(state, c.userId)} id={c.userId} size={18} />
                      {userName(state, c.userId)}
                      <span className="font-normal text-stone-400">· {timeAgo(c.createdAt)}</span>
                    </span>
                    {c.userId === CURRENT_USER_ID && (
                      <button
                        onClick={() => removeComment(c.id)}
                        aria-label="Delete comment"
                        className="rounded p-1 text-stone-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-snug text-stone-700">{c.text}</p>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Lightbox */}
      <Modal
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        title={lightbox?.caption ?? "Family photo"}
        subtitle={
          lightbox
            ? `Added by ${userName(state, lightbox.addedById)} · ${timeAgo(lightbox.createdAt)}`
            : undefined
        }
        wide
      >
        {lightbox && (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.dataUrl}
              alt={lightbox.caption ?? "Family photo"}
              className="w-full rounded-xl"
            />
            {(lightbox.taggedPersonIds.length > 0 || lightbox.personId !== person.id) && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-stone-400">In this photo:</span>
                {[lightbox.personId, ...lightbox.taggedPersonIds].map((pid) => {
                  const p = state.people.find((x) => x.id === pid);
                  if (!p) return null;
                  return (
                    <button
                      key={pid}
                      onClick={() => {
                        setLightbox(null);
                        onSelectPerson(pid);
                      }}
                      className="rounded-full bg-teal-800/10 px-2.5 py-1 text-xs font-semibold text-teal-800 transition hover:bg-teal-800/20"
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            )}
            {lightbox.addedById === CURRENT_USER_ID && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    removePhoto(lightbox.id);
                    setLightbox(null);
                    toast("Photo removed", "info");
                  }}
                  className="rounded-xl px-3.5 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  Remove photo
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ─── Field editor ──────────────────────────────────────────────────── */

function FieldEditor({
  fieldKey,
  initial,
  onSave,
  onCancel,
}: {
  fieldKey: DetailKey;
  initial: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const def = PERSON_DETAIL_FIELDS.find((f) => f.key === fieldKey)!;
  const [value, setValue] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSave(value);
      }}
      className="mb-3 rounded-xl border border-teal-700/30 bg-teal-800/5 p-3"
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-800">
        {def.label}
      </p>
      {def.kind === "textarea" ? (
        <textarea
          autoFocus
          className={`${inputCls} min-h-[70px] resize-y`}
          placeholder={def.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      ) : (
        <input
          autoFocus
          type={def.kind === "text" ? "text" : def.kind}
          className={inputCls}
          placeholder={def.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      )}
      <div className="mt-2 flex justify-end gap-2">
        <GhostButton type="button" onClick={onCancel} className="!px-3 !py-1.5 text-xs">
          Cancel
        </GhostButton>
        <PrimaryButton type="submit" disabled={!value.trim()} className="!px-3 !py-1.5 text-xs">
          Save
        </PrimaryButton>
      </div>
    </form>
  );
}

/* ─── Photo editor ──────────────────────────────────────────────────── */

function PhotoEditor({ person, onDone }: { person: Person; onDone: () => void }) {
  const { state, addPhoto } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [tagged, setTagged] = useState<Set<string>>(new Set());

  const others = state.people.filter(
    (p) => p.familyId === person.familyId && p.id !== person.id
  );

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      setDataUrl(await fileToDataUrl(file));
    } catch {
      toast("Couldn't read that image", "error");
    }
  };

  return (
    <div className="mb-3 rounded-xl border border-teal-700/30 bg-teal-800/5 p-3">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-800">
        Add a photo
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {dataUrl ? (
        <button onClick={() => fileRef.current?.click()} className="block w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt="Selected" className="max-h-40 w-full rounded-lg object-cover" />
        </button>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-teal-700/30 py-5 text-teal-800 transition hover:bg-teal-800/5"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          <span className="text-xs font-semibold">Choose an image</span>
        </button>
      )}
      <input
        className={`${inputCls} mt-2`}
        placeholder="Caption (optional)"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />
      {others.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
            Tag people in this photo
          </p>
          <div className="flex flex-wrap gap-1.5">
            {others.map((p) => {
              const on = tagged.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setTagged((s) => {
                      const next = new Set(s);
                      if (next.has(p.id)) {
                        next.delete(p.id);
                      } else {
                        next.add(p.id);
                      }
                      return next;
                    })
                  }
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    on
                      ? "bg-teal-800 text-white"
                      : "bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-teal-700/40"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-stone-400">
            Tagged people get this photo under their node too.
          </p>
        </div>
      )}
      <div className="mt-2.5 flex justify-end gap-2">
        <GhostButton type="button" onClick={onDone} className="!px-3 !py-1.5 text-xs">
          Cancel
        </GhostButton>
        <PrimaryButton
          type="button"
          disabled={!dataUrl}
          className="!px-3 !py-1.5 text-xs"
          onClick={() => {
            addPhoto({
              personId: person.id,
              familyId: person.familyId,
              dataUrl: dataUrl!,
              caption,
              taggedPersonIds: Array.from(tagged),
            });
            toast("Photo added");
            onDone();
          }}
        >
          Add photo
        </PrimaryButton>
      </div>
    </div>
  );
}

/* ─── Voice recording ───────────────────────────────────────────────── */

function VoiceEditor({ person, onDone }: { person: Person; onDone: () => void }) {
  const { setPersonVoice } = useStore();
  const toast = useToast();
  const [recording, setRecording] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        const reader = new FileReader();
        reader.onload = () => setDataUrl(reader.result as string);
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast("Microphone unavailable — upload an audio file instead", "error");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="mb-3 rounded-xl border border-teal-700/30 bg-teal-800/5 p-3">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-800">
        How do you say “{person.name.split(" ")[0]}”?
      </p>
      <div className="flex items-center gap-2">
        {!recording ? (
          <GhostButton type="button" onClick={start} className="!px-3 !py-1.5 text-xs">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            {dataUrl ? "Re-record" : "Record"}
          </GhostButton>
        ) : (
          <PrimaryButton type="button" onClick={stop} className="!bg-red-600 !px-3 !py-1.5 text-xs hover:!bg-red-500">
            ■ Stop
          </PrimaryButton>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-xs font-medium text-stone-500 underline underline-offset-2 hover:text-stone-700"
        >
          or upload audio
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => setDataUrl(reader.result as string);
            reader.readAsDataURL(file);
          }}
        />
      </div>
      {recording && (
        <p className="mt-2 animate-pulse text-xs font-medium text-red-600">
          Recording… say the name, then hit stop.
        </p>
      )}
      {dataUrl && !recording && (
        <audio controls src={dataUrl} className="mt-2 h-9 w-full" />
      )}
      <div className="mt-2.5 flex justify-end gap-2">
        <GhostButton type="button" onClick={onDone} className="!px-3 !py-1.5 text-xs">
          Cancel
        </GhostButton>
        <PrimaryButton
          type="button"
          disabled={!dataUrl}
          className="!px-3 !py-1.5 text-xs"
          onClick={() => {
            setPersonVoice(person.id, dataUrl!);
            toast("Name recording saved");
            onDone();
          }}
        >
          Save recording
        </PrimaryButton>
      </div>
    </div>
  );
}

function VoiceRow({ url, onRemove }: { url: string; onRemove: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="group mb-3 flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2">
      <button
        onClick={() => {
          const a = audioRef.current;
          if (!a) return;
          if (playing) {
            a.pause();
            a.currentTime = 0;
            setPlaying(false);
          } else {
            a.play();
            setPlaying(true);
          }
        }}
        className="flex items-center gap-2 text-sm font-medium text-stone-700 transition hover:text-teal-800"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-800 text-white">
          {playing ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </span>
        Hear their name
      </button>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} className="hidden" />
      <button
        onClick={onRemove}
        aria-label="Remove recording"
        className="rounded p-1 text-stone-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

/* ─── Comment composer ──────────────────────────────────────────────── */

function CommentComposer({
  onPost,
  onCancel,
}: {
  onPost: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onPost(text);
      }}
      className="mb-3 rounded-xl border border-teal-700/30 bg-teal-800/5 p-3"
    >
      <textarea
        autoFocus
        className={`${inputCls} min-h-[60px] resize-y`}
        placeholder="A memory, a correction, a question…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2 flex justify-end gap-2">
        <GhostButton type="button" onClick={onCancel} className="!px-3 !py-1.5 text-xs">
          Cancel
        </GhostButton>
        <PrimaryButton type="submit" disabled={!text.trim()} className="!px-3 !py-1.5 text-xs">
          Post comment
        </PrimaryButton>
      </div>
    </form>
  );
}

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
