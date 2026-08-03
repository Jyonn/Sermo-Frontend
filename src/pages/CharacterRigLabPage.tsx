import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type Motion = "moonwalk" | "wave";
type LoadState = "loading" | "ready" | "error";
type Variant = 0 | 1;

interface OutfitOptions {
  cape: Variant;
  hat: Variant;
  pants: Variant;
  shoes: Variant;
  top: Variant;
}

const INITIAL_OUTFIT: OutfitOptions = { cape: 0, hat: 0, pants: 0, shoes: 0, top: 0 };

const WARDROBE: Array<{ key: keyof OutfitOptions; label: string; options: [string, string] }> = [
  { key: "hat", label: "头饰", options: ["渔夫帽", "星环"] },
  { key: "top", label: "上衣", options: ["赤红运动服", "薄荷训练服"] },
  { key: "pants", label: "裤子", options: ["赤红短裤", "夜航短裤"] },
  { key: "shoes", label: "鞋子", options: ["街头板鞋", "月面球鞋"] },
  { key: "cape", label: "披风", options: ["短斗篷", "长披风"] },
];

const MOTIONS: Array<{ key: Motion; label: string; note: string; view: string }> = [
  { key: "moonwalk", label: "太空漫步", note: "侧面 · 倒放步态", view: "PROFILE" },
  { key: "wave", label: "挥手", note: "正面 · 全身招呼", view: "FRONT" },
];

function CharacterStage({ motion, outfit, onStateChange }: { motion: Motion; outfit: OutfitOptions; onStateChange: (state: LoadState) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef(motion);
  const outfitRef = useRef(outfit);

  useEffect(() => {
    motionRef.current = motion;
  }, [motion]);

  useEffect(() => {
    outfitRef.current = outfit;
  }, [outfit]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let frame = 0;
    let mixer: THREE.AnimationMixer | null = null;
    let character: THREE.Group | null = null;
    let activeAction: THREE.AnimationAction | null = null;
    let activeMotion: Motion | null = null;
    let appliedOutfit = "";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 100);
    camera.position.set(0, 1.45, 6.8);
    camera.lookAt(0, 1.25, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xfff8e8, 0x40235e, 2.25));
    const keyLight = new THREE.DirectionalLight(0xfff4dc, 4.2);
    keyLight.position.set(-3, 6, 4);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x76e8ff, 2.4);
    rimLight.position.set(4, 3, -3);
    scene.add(rimLight);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.25, 80),
      new THREE.MeshStandardMaterial({ color: 0x523b77, opacity: 0.25, transparent: true, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    floor.receiveShadow = true;
    scene.add(floor);

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const loader = new GLTFLoader();
    const base = `${import.meta.env.BASE_URL}labs/character-3d/`;

    Promise.all([
      loader.loadAsync(`${base}human-jay.glb`),
      loader.loadAsync(`${base}human-base-animations.glb`),
      loader.loadAsync(`${base}human-addon-animations.glb`),
    ]).then(([modelAsset, baseAnimations, addonAnimations]) => {
      if (disposed) return;
      character = modelAsset.scene;
      const slotMaterials: Record<"hat" | "pants" | "shoes" | "top", THREE.MeshStandardMaterial[]> = { hat: [], pants: [], shoes: [], top: [] };
      const originalColors = new Map<string, THREE.Color>();
      character.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = true;
        object.receiveShadow = true;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((sourceMaterial, materialIndex) => {
          if (sourceMaterial instanceof THREE.MeshStandardMaterial) {
            const material = sourceMaterial.clone();
            if (Array.isArray(object.material)) {
              object.material = object.material.map((item, index) => index === materialIndex ? material : item);
            } else {
              object.material = material;
            }
            material.roughness = 0.72;
            material.metalness = 0.02;
            originalColors.set(material.uuid, material.color.clone());
            const name = material.name.toLowerCase();
            if (name.includes("hat")) slotMaterials.hat.push(material);
            if (name.includes("jacket") || name.includes("chain")) slotMaterials.top.push(material);
            if (name.includes("shorts")) slotMaterials.pants.push(material);
            if (name.includes("shoes")) slotMaterials.shoes.push(material);
          }
        });
      });

      const headBone = character.getObjectByName("head");
      const orbitHat = new THREE.Group();
      const orbitOuter = new THREE.Mesh(
        new THREE.TorusGeometry(0.23, 0.025, 12, 64),
        new THREE.MeshStandardMaterial({ color: 0xffcc4e, emissive: 0x5b3600, emissiveIntensity: 0.18, roughness: 0.42 }),
      );
      const orbitInner = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.012, 10, 48),
        new THREE.MeshStandardMaterial({ color: 0xfff5c7, emissive: 0xc2831f, emissiveIntensity: 0.3, roughness: 0.3 }),
      );
      orbitHat.add(orbitOuter, orbitInner);
      orbitHat.rotation.x = Math.PI / 2;
      orbitHat.position.set(0, 0.68, 0);
      headBone?.add(orbitHat);

      const spineBone = character.getObjectByName("spine_03");
      const makeCape = (length: number, color: number) => {
        const geometry = new THREE.CylinderGeometry(0.22, 0.4, length, 32, 8, true, Math.PI / 2, Math.PI);
        const cape = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({ color, roughness: 0.68, side: THREE.DoubleSide }),
        );
        cape.position.set(0, -length / 2 + 0.08, -0.06);
        cape.rotation.x = -0.18;
        cape.castShadow = true;
        return cape;
      };
      const capes = [makeCape(0.48, 0xffb23f), makeCape(0.74, 0x183a68)];
      capes.forEach((cape) => spineBone?.add(cape));

      const setSlotColor = (slot: "pants" | "shoes" | "top", variant: Variant) => {
        const palettes: Record<typeof slot, number[]> = {
          top: [0xef4338, 0x25b79b],
          pants: [0xe84036, 0x243d74],
          shoes: [0x292534, 0xe8edf5],
        };
        slotMaterials[slot].forEach((material) => {
          const original = originalColors.get(material.uuid);
          if (variant === 0 && original) material.color.copy(original);
          else material.color.setHex(palettes[slot][variant]);
        });
      };

      const applyOutfit = (nextOutfit: OutfitOptions) => {
        const signature = JSON.stringify(nextOutfit);
        if (signature === appliedOutfit) return;
        appliedOutfit = signature;
        slotMaterials.hat.forEach((material) => { material.visible = nextOutfit.hat === 0; });
        orbitHat.visible = nextOutfit.hat === 1;
        setSlotColor("top", nextOutfit.top);
        setSlotColor("pants", nextOutfit.pants);
        setSlotColor("shoes", nextOutfit.shoes);
        capes.forEach((cape, index) => { cape.visible = index === nextOutfit.cape; });
      };

      const bounds = new THREE.Box3().setFromObject(character);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = 2.75 / Math.max(size.y, 0.01);
      character.scale.setScalar(scale);
      character.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      scene.add(character);

      const animations = [...baseAnimations.animations, ...addonAnimations.animations];
      const animationByName = new Map(animations.map((clip) => [clip.name, clip]));
      mixer = new THREE.AnimationMixer(character);

      const setMotion = (nextMotion: Motion) => {
        if (!mixer || activeMotion === nextMotion) return;
        const clipName = nextMotion === "wave" ? "Greeting" : "Walk_Backwards";
        const clip = animationByName.get(clipName);
        if (!clip) throw new Error(`Missing animation: ${clipName}`);
        const nextAction = mixer.clipAction(clip);
        nextAction.reset().setLoop(THREE.LoopRepeat, Infinity).play();
        nextAction.timeScale = nextMotion === "moonwalk" ? 0.82 : 0.92;
        if (activeAction) nextAction.crossFadeFrom(activeAction, 0.36, true);
        activeAction = nextAction;
        activeMotion = nextMotion;
      };

      setMotion(motionRef.current);
      applyOutfit(outfitRef.current);
      onStateChange("ready");

      const clock = new THREE.Clock();
      const render = () => {
        if (disposed) return;
        const delta = Math.min(clock.getDelta(), 0.05);
        setMotion(motionRef.current);
        applyOutfit(outfitRef.current);
        mixer?.update(delta);
        if (orbitHat.visible) orbitHat.rotation.z += delta * 0.24;
        capes.forEach((cape, index) => {
          if (cape.visible) cape.rotation.x = -0.18 + Math.sin(clock.elapsedTime * 1.7 + index) * 0.025;
        });
        if (character) {
          const targetY = motionRef.current === "moonwalk" ? -Math.PI / 2 : 0;
          character.rotation.y += (targetY - character.rotation.y) * (1 - Math.exp(-delta * 6.5));
        }
        renderer.render(scene, camera);
        frame = requestAnimationFrame(render);
      };
      render();
    }).catch((error) => {
      console.error("[character-rig-lab] failed to load 3D master", error);
      if (!disposed) onStateChange("error");
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      mixer?.stopAllAction();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onStateChange]);

  return <div className="character-3d-canvas" ref={hostRef} />;
}

export default function CharacterRigLabPage() {
  const [motion, setMotion] = useState<Motion>("moonwalk");
  const [outfit, setOutfit] = useState<OutfitOptions>(INITIAL_OUTFIT);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const handleLoadState = useCallback((state: LoadState) => setLoadState(state), []);

  return (
    <main className="character-lab-page">
      <header className="character-lab-header">
        <div><span>SERMO MOTION LAB · 3D MASTER</span><h1>让动作决定视角</h1><p>同一套骨骼，正面招呼，侧面滑步。</p></div>
        <Link to="/app/square">返回广场</Link>
      </header>

      <section className="character-lab-workbench">
        <div className="character-lab-stage">
          <div className="character-stage-meta"><span>LIVE SKELETON</span><i>{MOTIONS.find((item) => item.key === motion)?.view}</i></div>
          <CharacterStage motion={motion} outfit={outfit} onStateChange={handleLoadState} />
          {loadState !== "ready" && <div className={`character-stage-status is-${loadState}`}><span />{loadState === "loading" ? "正在装配三维人物" : "三维人物加载失败"}</div>}
          <div className="character-stage-ground" aria-hidden="true" />
          <div className="character-stage-now"><span />正在播放 <b>{motion === "moonwalk" ? "太空漫步" : "挥手"}</b></div>
        </div>

        <aside className="character-lab-panel">
          <div className="character-panel-heading"><span>MODULAR WARDROBE</span><h2>骨骼不动，只换部件</h2><p>服饰插槽独立切换，动作持续播放。</p></div>
          <div className="character-motion-options">
            {MOTIONS.map((item) => (
              <button className={motion === item.key ? "is-active" : ""} key={item.key} onClick={() => setMotion(item.key)} type="button">
                <span>{item.view}</span><b>{item.label}</b><i>{item.note}</i>
              </button>
            ))}
          </div>
          <div className="character-wardrobe">
            {WARDROBE.map((slot) => (
              <div className="character-wardrobe-row" key={slot.key}>
                <span>{slot.label}</span>
                <div>
                  {slot.options.map((label, index) => (
                    <button
                      className={outfit[slot.key] === index ? "is-active" : ""}
                      key={label}
                      onClick={() => setOutfit((current) => ({ ...current, [slot.key]: index as Variant }))}
                      type="button"
                    >
                      <i />{label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="character-rig-facts">
            <div><span>骨骼</span><b>共享</b></div><div><span>插槽</span><b>5 个独立部件</b></div><div><span>组合</span><b>32 套</b></div>
          </div>
          <p className="character-source-note">开源技术验证 · Three.js / glTF / Mesh2Motion CC0 动作</p>
        </aside>
      </section>
    </main>
  );
}
