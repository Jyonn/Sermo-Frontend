import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type Motion = "moonwalk" | "wave";
type LoadState = "loading" | "ready" | "error";

const MOTIONS: Array<{ key: Motion; label: string; note: string; view: string }> = [
  { key: "moonwalk", label: "太空漫步", note: "侧面 · 倒放步态", view: "PROFILE" },
  { key: "wave", label: "挥手", note: "正面 · 全身招呼", view: "FRONT" },
];

function CharacterStage({ motion, onStateChange }: { motion: Motion; onStateChange: (state: LoadState) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef(motion);

  useEffect(() => {
    motionRef.current = motion;
  }, [motion]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let frame = 0;
    let mixer: THREE.AnimationMixer | null = null;
    let character: THREE.Group | null = null;
    let activeAction: THREE.AnimationAction | null = null;
    let activeMotion: Motion | null = null;

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
      character.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = true;
        object.receiveShadow = true;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (material instanceof THREE.MeshStandardMaterial) {
            material.roughness = 0.72;
            material.metalness = 0.02;
          }
        });
      });

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
      onStateChange("ready");

      const clock = new THREE.Clock();
      const render = () => {
        if (disposed) return;
        const delta = Math.min(clock.getDelta(), 0.05);
        setMotion(motionRef.current);
        mixer?.update(delta);
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
          <CharacterStage motion={motion} onStateChange={handleLoadState} />
          {loadState !== "ready" && <div className={`character-stage-status is-${loadState}`}><span />{loadState === "loading" ? "正在装配三维人物" : "三维人物加载失败"}</div>}
          <div className="character-stage-ground" aria-hidden="true" />
          <div className="character-stage-now"><span />正在播放 <b>{motion === "moonwalk" ? "太空漫步" : "挥手"}</b></div>
        </div>

        <aside className="character-lab-panel">
          <div className="character-panel-heading"><span>MOTION TEST</span><h2>同一人物，不同机位</h2><p>动作切换时，骨骼、身体朝向与镜头关系一起过渡。</p></div>
          <div className="character-motion-options">
            {MOTIONS.map((item) => (
              <button className={motion === item.key ? "is-active" : ""} key={item.key} onClick={() => setMotion(item.key)} type="button">
                <span>{item.view}</span><b>{item.label}</b><i>{item.note}</i>
              </button>
            ))}
          </div>
          <div className="character-rig-facts">
            <div><span>骨骼</span><b>共享</b></div><div><span>视角</span><b>动作驱动</b></div><div><span>服装</span><b>下一阶段拆件</b></div>
          </div>
          <p className="character-source-note">开源技术验证 · Three.js / glTF / Mesh2Motion CC0 动作</p>
        </aside>
      </section>
    </main>
  );
}
