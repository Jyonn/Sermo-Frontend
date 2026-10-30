import { useEffect, useRef } from "react";

export function ExplorerProfileScene() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scene = ref.current;
    if (!scene) return;
    const update = () => scene.classList.toggle("is-active", document.visibilityState === "visible");
    const observer = new IntersectionObserver(([entry]) => scene.classList.toggle("is-visible", entry.isIntersecting));
    observer.observe(scene);
    document.addEventListener("visibilitychange", update);
    update();
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);
  return <div className="explorer-profile-scene" ref={ref} aria-hidden="true">
    <div className="explorer-profile-city" />
    <div className="explorer-profile-water"><i /><i /><i /></div>
    <div className="explorer-profile-lanterns"><i /><i /><i /></div>
    <div className="explorer-profile-couple" />
    <div className="explorer-profile-rain is-back" /><div className="explorer-profile-rain is-front" />
    <div className="explorer-profile-petals"><i /><i /><i /><i /></div>
    <div className="explorer-profile-vignette" />
  </div>;
}
