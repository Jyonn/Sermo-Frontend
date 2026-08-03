import { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics } from "pixi.js";
import * as THREE from "three";
import { Link } from "react-router-dom";

type Variant = 0 | 1;
type Motion = "walk" | "wave";

interface CharacterOptions {
  cape: Variant;
  hat: Variant;
  motion: Motion;
  pants: Variant;
  shoes: Variant;
  top: Variant;
}

const INITIAL_OPTIONS: CharacterOptions = {
  cape: 0,
  hat: 0,
  motion: "walk",
  pants: 0,
  shoes: 0,
  top: 0,
};

const OPTION_GROUPS: Array<{
  key: keyof Omit<CharacterOptions, "motion">;
  label: string;
  values: [string, string];
}> = [
  { key: "hat", label: "头饰", values: ["贝雷帽", "星环"] },
  { key: "top", label: "上衣", values: ["短夹克", "水手衫"] },
  { key: "pants", label: "裤子", values: ["束脚裤", "运动裤"] },
  { key: "shoes", label: "鞋子", values: ["短靴", "球鞋"] },
  { key: "cape", label: "披风", values: ["长披风", "短斗篷"] },
];

const COLORS = {
  cape: [0xe14c43, 0xf2a93b],
  hat: [0x243447, 0xf2c84b],
  pants: [0x2878d0, 0x35326f],
  shoes: [0x17212b, 0xf4efe3],
  skin: 0x553044,
  top: [0x39a9ee, 0x26b78f],
} as const;

function Choice({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button className={`rig-lab-choice${active ? " is-active" : ""}`} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function OutfitControls({ options, setOptions }: { options: CharacterOptions; setOptions: React.Dispatch<React.SetStateAction<CharacterOptions>> }) {
  return (
    <div className="rig-lab-controls">
      <div className="rig-lab-control-group is-motion">
        <span>动作</span>
        <div>
          <Choice active={options.motion === "walk"} onClick={() => setOptions((value) => ({ ...value, motion: "walk" }))}>原地行走</Choice>
          <Choice active={options.motion === "wave"} onClick={() => setOptions((value) => ({ ...value, motion: "wave" }))}>挥手</Choice>
        </div>
      </div>
      {OPTION_GROUPS.map((group) => (
        <div className="rig-lab-control-group" key={group.key}>
          <span>{group.label}</span>
          <div>
            {group.values.map((label, index) => (
              <Choice
                active={options[group.key] === index}
                key={label}
                onClick={() => setOptions((value) => ({ ...value, [group.key]: index as Variant }))}
              >
                {label}
              </Choice>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SvgCharacter({ options }: { options: CharacterOptions }) {
  return (
    <svg className={`rig-svg-character motion-${options.motion}`} viewBox="0 0 240 300" role="img" aria-label="SVG 骨骼人物">
      <ellipse className="rig-shadow" cx="120" cy="272" rx="47" ry="9" />
      <g className="rig-svg-body">
        <path className={`rig-cape cape-${options.cape}`} d={options.cape ? "M91 109 Q55 143 67 226 Q96 213 113 178 L110 111Z" : "M91 108 Q46 157 57 247 Q94 229 116 180 L111 110Z"} />
        <g className="rig-leg is-back">
          <path className={`rig-pants pants-${options.pants}`} d="M112 185 L102 237" />
          <path className={`rig-shoe shoes-${options.shoes}`} d={options.shoes ? "M103 233 q-13 9-22 2 q-3 9 5 13 h22z" : "M104 233 q-8 11-20 7 q-3 9 7 12 h18z"} />
        </g>
        <g className="rig-leg is-front">
          <path className={`rig-pants pants-${options.pants}`} d="M128 185 L139 238" />
          <path className={`rig-shoe shoes-${options.shoes}`} d={options.shoes ? "M137 234 q14 8 22 2 q4 9-4 13 h-22z" : "M137 234 q9 11 21 7 q3 9-7 12 h-18z"} />
        </g>
        <g className="rig-arm is-back">
          <path className={`rig-sleeve top-${options.top}`} d="M99 119 Q82 141 76 174" />
          <circle className="rig-hand" cx="76" cy="176" r="8" />
        </g>
        <path className={`rig-torso top-${options.top}`} d={options.top ? "M97 111 Q120 101 143 113 L151 184 Q121 198 89 183Z" : "M98 110 Q120 102 142 112 L149 181 Q121 191 91 181Z"} />
        {options.top ? <path className="rig-top-detail" d="M105 115 L137 177 M136 113 L103 176" /> : <path className="rig-top-detail" d="M106 115 L120 130 L136 114" />}
        <g className="rig-arm is-front">
          <path className={`rig-sleeve top-${options.top}`} d="M140 120 Q158 142 164 174" />
          <circle className="rig-hand" cx="164" cy="176" r="8" />
        </g>
        <circle className="rig-head" cx="120" cy="82" r="29" />
        {options.hat ? (
          <g className="rig-hat-star"><ellipse cx="120" cy="48" rx="34" ry="9" /><ellipse cx="120" cy="48" rx="22" ry="5" /></g>
        ) : (
          <path className="rig-hat-beret" d="M91 67 Q94 36 126 38 Q151 40 153 59 Q124 53 91 67Z" />
        )}
      </g>
    </svg>
  );
}

function roundedRect(graphics: Graphics, x: number, y: number, width: number, height: number, radius: number, color: number) {
  return graphics.roundRect(x, y, width, height, radius).fill(color);
}

function buildPixiCharacter(options: CharacterOptions, dataDriven = false) {
  const root = new Container();
  root.position.set(120, 260);

  const shadow = new Graphics().ellipse(0, 4, 44, 8).fill({ color: 0x153b38, alpha: 0.16 });
  root.addChild(shadow);

  const body = new Container();
  body.position.y = -72;
  root.addChild(body);

  const cape = new Graphics();
  if (options.cape === 0) cape.moveTo(-22, -72).bezierCurveTo(-78, -18, -65, 65, -15, 80).lineTo(12, -20).closePath().fill(COLORS.cape[0]);
  else cape.moveTo(-21, -70).bezierCurveTo(-62, -27, -45, 42, -10, 52).lineTo(12, -20).closePath().fill(COLORS.cape[1]);
  body.addChild(cape);

  const makeLeg = (side: -1 | 1) => {
    const leg = new Container();
    leg.position.set(side * 10, 24);
    const lower = roundedRect(new Graphics(), -7, 0, 14, options.pants ? 58 : 52, 7, COLORS.pants[options.pants]);
    const shoe = roundedRect(new Graphics(), side < 0 ? -18 : -4, 47, options.shoes ? 24 : 22, options.shoes ? 12 : 17, 6, COLORS.shoes[options.shoes]);
    leg.addChild(lower, shoe);
    body.addChild(leg);
    return leg;
  };
  const backLeg = makeLeg(-1);
  const frontLeg = makeLeg(1);

  const torso = new Graphics();
  roundedRect(torso, -31, -65, 62, 88, options.top ? 18 : 11, COLORS.top[options.top]);
  if (options.top === 0) torso.moveTo(-13, -61).lineTo(0, -47).lineTo(13, -61).stroke({ color: 0xdaf4ff, width: 4 });
  else {
    torso.moveTo(-18, -54).lineTo(19, 13).stroke({ color: 0xf7f0d6, width: 5 });
    torso.moveTo(18, -54).lineTo(-19, 13).stroke({ color: 0xf7f0d6, width: 5 });
  }
  body.addChild(torso);

  const makeArm = (side: -1 | 1) => {
    const arm = new Container();
    arm.position.set(side * 27, -53);
    const sleeve = roundedRect(new Graphics(), -7, 0, 14, 54, 7, COLORS.top[options.top]);
    const hand = new Graphics().circle(0, 56, 8).fill(COLORS.skin);
    arm.addChild(sleeve, hand);
    body.addChild(arm);
    return arm;
  };
  const backArm = makeArm(-1);
  const frontArm = makeArm(1);

  const head = new Graphics().circle(0, -96, 29).fill(COLORS.skin);
  body.addChild(head);
  if (options.hat === 0) {
    body.addChild(new Graphics().moveTo(-30, -108).bezierCurveTo(-26, -139, 24, -143, 34, -116).bezierCurveTo(6, -123, -12, -119, -30, -108).fill(COLORS.hat[0]));
  } else {
    body.addChild(new Graphics().ellipse(0, -129, 37, 10).stroke({ color: COLORS.hat[1], width: 6 }).ellipse(0, -129, 23, 5).stroke({ color: 0xfff1a8, width: 2 }));
  }

  root.onRender = () => {
    const time = performance.now() / 1000;
    const phase = Math.sin(time * (dataDriven ? 4.5 : 5.2));
    if (options.motion === "walk") {
      body.y = -72 + Math.abs(Math.sin(time * 5.2)) * 4;
      frontLeg.rotation = phase * 0.42;
      backLeg.rotation = -phase * 0.42;
      frontArm.rotation = -phase * 0.38;
      backArm.rotation = phase * 0.38;
      cape.skew.x = phase * 0.025;
    } else {
      body.y = -72 + Math.sin(time * 2.4) * 2;
      frontArm.rotation = -2.45 + Math.sin(time * 6) * 0.22;
      backArm.rotation = 0.1;
      frontLeg.rotation = 0.05;
      backLeg.rotation = -0.05;
      cape.skew.x = Math.sin(time * 2.4) * 0.025;
    }
  };
  return root;
}

function PixiCharacter({ dataDriven = false, options }: { dataDriven?: boolean; options: CharacterOptions }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let initialized = false;
    const app = new Application();
    void app.init({ antialias: true, backgroundAlpha: 0, height: 300, preference: "webgl", resolution: Math.min(devicePixelRatio, 2), width: 240 }).then(() => {
      initialized = true;
      if (cancelled) {
        app.destroy(true);
        return;
      }
      app.canvas.setAttribute("aria-label", dataDriven ? "数据驱动骨骼人物" : "PixiJS 骨骼人物");
      host.replaceChildren(app.canvas);
      app.stage.addChild(buildPixiCharacter(options, dataDriven));
    });
    return () => {
      cancelled = true;
      if (initialized) app.destroy(true, { children: true });
    };
  }, [dataDriven, options]);

  return <div className="rig-canvas-host" ref={hostRef} />;
}

function makeThreeMaterial(color: number) {
  return new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
}

function ThreeCharacter({ options }: { options: CharacterOptions }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1.2, 1.2, 1.5, -1.5, 0.1, 20);
    camera.position.z = 8;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(240, 300, false);
    host.replaceChildren(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);
    const body = new THREE.Group();
    body.position.y = 0.1;
    root.add(body);
    const plane = (width: number, height: number, color: number, radius = 0) => {
      const geometry = radius ? new THREE.CircleGeometry(width / 2, 36) : new THREE.PlaneGeometry(width, height);
      const mesh = new THREE.Mesh(geometry, makeThreeMaterial(color));
      if (radius) mesh.scale.y = height / width;
      return mesh;
    };
    const cape = plane(options.cape ? 0.72 : 0.9, options.cape ? 1.05 : 1.35, COLORS.cape[options.cape]);
    cape.position.set(-0.22, -0.08, -0.5);
    cape.rotation.z = options.cape ? -0.12 : -0.18;
    body.add(cape);
    const torso = plane(0.66, 0.9, COLORS.top[options.top], 1);
    torso.position.z = 0.1;
    body.add(torso);
    const limb = (x: number, y: number, color: number, width: number, height: number, z: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);
      const mesh = plane(width, height, color, 1);
      mesh.position.y = -height / 2;
      pivot.add(mesh);
      body.add(pivot);
      return pivot;
    };
    const backArm = limb(-0.34, 0.32, COLORS.top[options.top], 0.16, 0.78, -0.1);
    const frontArm = limb(0.34, 0.32, COLORS.top[options.top], 0.16, 0.78, 0.3);
    const backLeg = limb(-0.16, -0.37, COLORS.pants[options.pants], 0.19, 0.82, -0.2);
    const frontLeg = limb(0.16, -0.37, COLORS.pants[options.pants], 0.19, 0.82, 0.2);
    [backLeg, frontLeg].forEach((leg, index) => {
      const shoe = plane(options.shoes ? 0.28 : 0.25, options.shoes ? 0.14 : 0.2, COLORS.shoes[options.shoes], 1);
      shoe.position.set(index ? 0.05 : -0.05, -0.82, 0.1);
      leg.add(shoe);
    });
    const head = plane(0.58, 0.58, COLORS.skin, 1);
    head.position.set(0, 0.78, 0.4);
    body.add(head);
    const hat = options.hat === 0 ? plane(0.65, 0.24, COLORS.hat[0], 1) : new THREE.Mesh(new THREE.RingGeometry(0.25, 0.35, 48), makeThreeMaterial(COLORS.hat[1]));
    hat.position.set(0, options.hat ? 1.12 : 1.04, 0.5);
    if (!options.hat) hat.rotation.z = -0.12;
    body.add(hat);

    let frame = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      const phase = Math.sin(time * 5);
      if (options.motion === "walk") {
        body.position.y = 0.08 + Math.abs(Math.sin(time * 5)) * 0.05;
        frontLeg.rotation.z = phase * 0.42;
        backLeg.rotation.z = -phase * 0.42;
        frontArm.rotation.z = -phase * 0.38;
        backArm.rotation.z = phase * 0.38;
      } else {
        body.position.y = 0.1 + Math.sin(time * 2.2) * 0.025;
        frontArm.rotation.z = -2.5 + Math.sin(time * 6) * 0.2;
        backArm.rotation.z = 0.1;
        frontLeg.rotation.z = 0.05;
        backLeg.rotation.z = -0.05;
      }
      cape.rotation.z = (options.cape ? -0.12 : -0.18) + Math.sin(time * 2.8) * 0.035;
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      renderer.dispose();
    };
  }, [options]);

  return <div className="rig-canvas-host" ref={hostRef} />;
}

const DEMOS = [
  { id: "svg", index: "01", title: "原生 SVG", subtitle: "零运行时依赖", note: "最轻，React 与样式控制直接；复杂蒙皮需要自研。" },
  { id: "pixi", index: "02", title: "PixiJS", subtitle: "层级关节容器", note: "多人广场性能最好，换装和特效都容易扩展。" },
  { id: "bones", index: "03", title: "数据骨骼", subtitle: "DragonBones / SkelForm 思路", note: "动作与皮肤彻底分离，但资产管线依赖专用编辑器。" },
  { id: "three", index: "04", title: "Three.js", subtitle: "2.5D 骨骼舞台", note: "空间感和镜头能力强，对当前扁平人物略显过重。" },
] as const;

export default function CharacterRigLabPage() {
  const [options, setOptions] = useState<CharacterOptions>(INITIAL_OPTIONS);

  return (
    <main className="rig-lab-page">
      <header className="rig-lab-header">
        <div>
          <span className="rig-lab-kicker">SERMO MOTION LAB · 01</span>
          <h1>同一个人物，四种骨骼路线</h1>
          <p>统一动作、统一换装，只比较渲染与资产结构。</p>
        </div>
        <Link to="/app/square">返回广场</Link>
      </header>

      <section className="rig-lab-console" aria-label="人物控制台">
        <OutfitControls options={options} setOptions={setOptions} />
      </section>

      <section className="rig-lab-grid">
        {DEMOS.map((demo) => (
          <article className={`rig-lab-demo is-${demo.id}`} key={demo.id}>
            <header>
              <span>{demo.index}</span>
              <div><h2>{demo.title}</h2><p>{demo.subtitle}</p></div>
              <i className="rig-lab-live">LIVE</i>
            </header>
            <div className="rig-lab-stage">
              <span className="rig-lab-stage-grid" aria-hidden="true" />
              {demo.id === "svg" ? <SvgCharacter options={options} /> : null}
              {demo.id === "pixi" ? <PixiCharacter options={options} /> : null}
              {demo.id === "bones" ? <PixiCharacter dataDriven options={options} /> : null}
              {demo.id === "three" ? <ThreeCharacter options={options} /> : null}
              <span className="rig-lab-floor" aria-hidden="true" />
            </div>
            <footer><p>{demo.note}</p><span>{demo.id === "svg" ? "~4 KB" : demo.id === "pixi" ? "WebGL 2D" : demo.id === "bones" ? "JSON + ATLAS" : "WebGL 3D"}</span></footer>
          </article>
        ))}
      </section>
    </main>
  );
}
