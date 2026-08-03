import { useState } from "react";
import { Link } from "react-router-dom";

type Variant = 0 | 1;
type Motion = "moonwalk" | "wave";

interface CharacterOptions {
  cape: Variant;
  hat: Variant;
  motion: Motion;
  pants: Variant;
  shoes: Variant;
  top: Variant;
}

const INITIAL_OPTIONS: CharacterOptions = { cape: 0, hat: 0, motion: "moonwalk", pants: 0, shoes: 0, top: 0 };

const OUTFIT_GROUPS: Array<{
  key: keyof Omit<CharacterOptions, "motion">;
  label: string;
  values: [string, string];
}> = [
  { key: "hat", label: "头饰", values: ["火焰盔", "星环帽"] },
  { key: "top", label: "上衣", values: ["巡游服", "夜航夹克"] },
  { key: "pants", label: "裤子", values: ["白色长裤", "靛蓝束裤"] },
  { key: "shoes", label: "鞋子", values: ["圆头靴", "月面鞋"] },
  { key: "cape", label: "披风", values: ["长披风", "短斗篷"] },
];

function SegmentedControl({
  active,
  labels,
  onChange,
}: {
  active: number;
  labels: readonly [string, string];
  onChange: (value: Variant) => void;
}) {
  return (
    <div className="motion-studio-segmented">
      {labels.map((label, index) => (
        <button className={active === index ? "is-active" : ""} key={label} onClick={() => onChange(index as Variant)} type="button">
          {label}
        </button>
      ))}
    </div>
  );
}

function MasterCharacter({ options }: { options: CharacterOptions }) {
  return (
    <svg
      className={`motion-master-character motion-${options.motion} hat-${options.hat} top-${options.top} pants-${options.pants} shoes-${options.shoes} cape-${options.cape}`}
      viewBox="0 0 360 430"
      role="img"
      aria-label="侧面太空漫步人物母版"
    >
      <defs>
        <linearGradient id="studio-cape" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ff4f7d" />
          <stop offset="1" stopColor="#e32058" />
        </linearGradient>
        <linearGradient id="studio-cape-alt" x1="0" x2="1">
          <stop offset="0" stopColor="#ffbd3f" />
          <stop offset="1" stopColor="#f37640" />
        </linearGradient>
        <filter id="studio-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <ellipse className="motion-character-shadow" cx="182" cy="385" rx="70" ry="13" filter="url(#studio-shadow)" />

      <g className="motion-character-rig">
        <g className="motion-cape-bone">
          <path className="motion-cape-shape" d={options.cape ? "M146 157 C102 173 79 218 91 287 C113 277 132 258 151 230 L166 169Z" : "M145 151 C83 176 51 241 62 339 C103 324 136 283 159 228 L168 164Z"} />
          <path className="motion-cape-highlight" d={options.cape ? "M137 171 C108 190 101 223 105 258" : "M134 170 C91 201 79 260 83 308"} />
        </g>

        <g className="motion-arm is-back">
          <g className="motion-upper-arm"><path d="M148 174 C127 194 122 222 119 245" /></g>
          <g className="motion-lower-arm"><path d="M119 244 C116 263 121 279 132 287" /><circle cx="133" cy="288" r="13" /></g>
        </g>

        <g className="motion-leg is-back">
          <g className="motion-thigh"><path d="M165 278 C150 309 143 333 137 354" /></g>
          <g className="motion-calf"><path d="M137 351 C129 369 126 377 126 384" /><path className="motion-shoe" d="M126 371 C111 376 98 388 104 398 C116 406 141 403 150 392 L148 379Z" /></g>
        </g>

        <path className="motion-torso" d="M151 154 C180 137 218 147 235 174 C247 198 244 245 226 284 C205 299 171 297 150 277 C141 239 139 190 151 154Z" />
        <path className="motion-jacket-panel" d="M180 154 C194 171 205 196 214 224" />
        <path className="motion-belt" d="M151 258 C175 269 203 270 231 258" />
        <circle className="motion-button is-one" cx="205" cy="184" r="6" />
        <circle className="motion-button is-two" cx="216" cy="211" r="6" />
        <circle className="motion-button is-three" cx="220" cy="240" r="6" />

        <g className="motion-leg is-front">
          <g className="motion-thigh"><path d="M207 281 C219 312 231 332 242 351" /></g>
          <g className="motion-calf"><path d="M242 349 C252 365 256 375 255 384" /><path className="motion-shoe" d="M246 372 C253 368 266 373 280 388 C279 400 264 406 248 400 C238 393 236 383 246 372Z" /></g>
        </g>

        <g className="motion-arm is-front">
          <g className="motion-upper-arm"><path d="M219 171 C239 186 254 205 265 224" /></g>
          <g className="motion-lower-arm"><path d="M264 223 C275 239 278 252 277 266" /><circle cx="277" cy="270" r="13" /></g>
        </g>

        <path className="motion-neck" d="M169 151 C174 137 187 130 201 137 L210 154 C198 166 179 167 169 151Z" />
        <path className="motion-head" d="M156 111 C154 77 179 54 208 59 C231 64 242 83 239 104 C237 119 226 131 210 139 C197 146 176 142 165 130 C159 124 156 117 156 111Z" />
        <path className="motion-profile" d="M236 88 C248 92 254 99 244 105 C251 109 248 117 236 118Z" />

        {options.hat === 0 ? (
          <path className="motion-hat-flame" d="M158 108 C137 100 132 84 144 65 C158 43 151 20 180 15 C215 37 218 65 200 86 C186 102 173 109 158 108Z" />
        ) : (
          <g className="motion-hat-orbit"><ellipse cx="195" cy="62" rx="54" ry="14" /><ellipse cx="195" cy="62" rx="35" ry="8" /></g>
        )}
      </g>
    </svg>
  );
}

const PIPELINE = [
  { index: "01", title: "视觉母版", state: "正在验收", copy: "轮廓、关节、服装裁片与动作节奏先形成唯一标准。" },
  { index: "02", title: "PixiJS 移植", state: "下一步", copy: "保持相同矢量外观，验证多人同屏、换装和移动端帧率。" },
  { index: "03", title: "数据骨骼移植", state: "待开始", copy: "接入蒙皮、IK 与动作混合，评估资产制作工作量。" },
] as const;

export default function CharacterRigLabPage() {
  const [options, setOptions] = useState<CharacterOptions>(INITIAL_OPTIONS);

  return (
    <main className="motion-studio-page">
      <header className="motion-studio-header">
        <div><span>SERMO CHARACTER STUDIO · PHASE 01</span><h1>先把一个人物做好</h1><p>母版没有通过，就不复制四份问题。</p></div>
        <Link to="/app/square">返回广场</Link>
      </header>

      <section className="motion-studio-workbench">
        <div className="motion-studio-stage">
          <div className="motion-studio-stage-label"><span>MASTER RIG</span><i>侧面 · 12 关节</i></div>
          <MasterCharacter options={options} />
          <div className="motion-studio-floor" aria-hidden="true" />
          <div className="motion-studio-playback"><span /><b>{options.motion === "moonwalk" ? "太空漫步" : "挥手"}</b><i>2.4s LOOP</i></div>
        </div>

        <aside className="motion-studio-inspector">
          <div className="motion-studio-inspector-head"><span>LOOK 01</span><h2>巡游者</h2><p>服装只是附件，动作属于骨架。</p></div>
          <div className="motion-studio-field is-motion">
            <label>动作</label>
            <SegmentedControl
              active={options.motion === "moonwalk" ? 0 : 1}
              labels={["太空漫步", "挥手"]}
              onChange={(value) => setOptions((current) => ({ ...current, motion: value ? "wave" : "moonwalk" }))}
            />
          </div>
          {OUTFIT_GROUPS.map((group) => (
            <div className="motion-studio-field" key={group.key}>
              <label>{group.label}</label>
              <SegmentedControl
                active={options[group.key]}
                labels={group.values}
                onChange={(value) => setOptions((current) => ({ ...current, [group.key]: value }))}
              />
            </div>
          ))}
        </aside>
      </section>

      <section className="motion-studio-pipeline">
        {PIPELINE.map((step) => <article key={step.index}><span>{step.index}</span><div><h2>{step.title}</h2><p>{step.copy}</p></div><i>{step.state}</i></article>)}
      </section>
    </main>
  );
}
