import { useEffect, useRef, useState } from "react";
import type { SoulWorld } from "./engine";

let instance: SoulWorld | null = null;
const waiters: ((w: SoulWorld) => void)[] = [];

/** Run fn against the world once it exists (it loads lazily). */
export function withWorld(fn: (w: SoulWorld) => void) {
  if (instance) fn(instance);
  else waiters.push(fn);
}

export function WorldCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let disposed = false;
    let world: SoulWorld | null = null;
    import("./engine")
      .then(({ SoulWorld }) => {
        if (disposed || !host.current) return;
        try {
          world = new SoulWorld(host.current);
        } catch {
          setFailed(true);
          return;
        }
        instance = world;
        (window as any).__soulplexWorld = world; // handy for debugging and visual tests
        waiters.splice(0).forEach((fn) => fn(world!));
        requestAnimationFrame(() => setReady(true));
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      world?.dispose();
      instance = null;
    };
  }, []);
  return (
    <div className={"world-layer" + (ready ? " ready" : "") + (failed ? " failed" : "")} aria-hidden="true">
      <div ref={host} className="world-host" />
      <div className="world-vignette" />
    </div>
  );
}
