"use client";

import type { PlacementPanelContext } from "@/components/HouseExperience";
import HouseExperience from "@/components/HouseExperience";

function EditPanel(context: PlacementPanelContext) {
  const { registry, assignments, setAssignments, wallImageSrc, setWallSrc } =
    context;

  const updateSlotUrl = (id: string, url: string) => {
    setAssignments({ ...assignments, [id]: url.trim() });
  };

  const onLocalGlb =
    (id: string) => (evt: React.ChangeEvent<HTMLInputElement>) => {
      const file = evt.target.files?.[0];
      if (!file) return;
      const prev = assignments[id];
      if (prev?.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      const blobUrl = URL.createObjectURL(file);
      setAssignments({ ...assignments, [id]: blobUrl });
      evt.target.value = "";
    };

  const removeSlot = (id: string) => {
    const prev = assignments[id];
    const next = { ...assignments };
    delete next[id];
    setAssignments(next);
    if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
  };

  const onWallPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setWallSrc(String(reader.result));
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  return (
    <div className="museum-sans space-y-8 text-[var(--museum-ink)]">
      <header>
        <h2 className="museum-serif text-lg">Staging room</h2>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--museum-muted)]">
          Fasten meshes to named perches · hang a likeness on plaster.
        </p>
      </header>

      <section aria-label="Furniture placements">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--museum-muted)]">
          Objects
        </h3>
        <ul className="mt-3 space-y-4">
          {registry.slots.length === 0 ? (
            <li className="text-xs text-[var(--museum-muted)]">
              Searching for slot markers… reload if still empty once the house settles.
            </li>
          ) : (
            registry.slots.map((slot) => (
              <li key={slot.id} className="border-b border-[var(--museum-rule)] pb-4">
                <p className="museum-serif text-sm">{slot.label}</p>
                <label className="mt-2 block text-[10px] uppercase tracking-[0.16em] text-[var(--museum-muted)]">
                  Mesh URL
                </label>
                <input
                  className="mt-1 w-full rounded-sm border border-[var(--museum-rule)] bg-transparent px-2 py-1.5 text-xs outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--museum-brass)]"
                  placeholder="Paste Meshy HTTPS link …"
                  value={assignments[slot.id] ?? ""}
                  onChange={(e) => updateSlotUrl(slot.id, e.target.value)}
                  spellCheck={false}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-[var(--museum-muted)]">
                    <span>Or local</span>
                    <input
                      type="file"
                      accept=".glb,model/gltf-binary"
                      className="sr-only"
                      onChange={onLocalGlb(slot.id)}
                    />
                    <span className="text-[var(--museum-brass-dark)] underline">
                      upload .glb
                    </span>
                  </label>
                  {(assignments[slot.id]?.length ?? 0) > 0 ? (
                    <button
                      type="button"
                      className="text-[11px] text-[var(--museum-muted)] underline"
                      onClick={() => removeSlot(slot.id)}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section aria-label="Wall art">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--museum-muted)]">
          Portrait wall
        </h3>
        <p className="mt-2 text-[11px] text-[var(--museum-muted)]">
          JPG or PNG floats with the room proportions.
        </p>
        <input
          type="file"
          accept="image/png,image/jpeg,.jpg,.jpeg,.png"
          className="mt-3 block w-full text-xs file:mr-2 file:rounded-sm file:border file:border-[var(--museum-rule)] file:bg-transparent file:px-2 file:text-[11px]"
          onChange={onWallPick}
        />
        {wallImageSrc ? (
          <button
            type="button"
            className="museum-sans mt-2 text-[11px] text-[var(--museum-muted)] underline"
            onClick={() => setWallSrc(null)}
          >
            Strip frame
          </button>
        ) : null}
      </section>
    </div>
  );
}

export default function EditHomeClient() {
  return (
    <HouseExperience siteMode="edit" placementPanel={(c) => <EditPanel {...c} />} />
  );
}
