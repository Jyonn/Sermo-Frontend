import { useState } from "react";
import { BaxianBubbleRunner } from "../components/BaxianBubbleRunner";

type Character = "lv" | "zhongli" | "he";
type Direction = "inset" | "watermark";

const characters: Array<{ key: Character; name: string; style: string }> = [
  { key: "lv", name: "吕洞宾", style: "baxian-lv" },
  { key: "zhongli", name: "钟离权", style: "baxian-zhongli" },
  { key: "he", name: "何仙姑", style: "baxian-he" },
];

const directions: Array<{ key: Direction; number: "01" | "04"; name: string; label: string; note: string; recommended?: boolean }> = [
  { key: "inset", number: "01", name: "内嵌题签", label: "清晰落款", note: "每个真实气泡都有印章：他方贴左内缘，己方贴右内缘；多行消息与最后一行文字对齐。", recommended: true },
  { key: "watermark", number: "04", name: "暗纹水印", label: "轻量留痕", note: "每个真实气泡都留下低对比暗纹，并跟随最后一行文字；表情包等无气泡内容保持纯净。" },
];

function Seal({ character }: { character: Character }) {
  const asset = character === "lv" ? "lv-dongbin-blue-seal.png" : character === "he" ? "he-xiangu-pink-seal.png" : "zhongli-quan-red-seal.png";
  return <img alt="" aria-hidden="true" className="baxian-lab-seal" src={`/assets/baxian/${asset}`} />;
}

function Hero({ character }: { character: Character }) {
  const style = character === "lv" ? "baxian-lv" : character === "he" ? "baxian-he" : "baxian-zhongli";
  return <BaxianBubbleRunner style={style} />;
}

function Bubble({ character, direction, self, text, grouped }: { character: Character; direction: Direction; self?: boolean; text: string; grouped?: "start" | "middle" | "end" }) {
  return (
    <div className={`baxian-lab-row ${self ? "is-self" : "is-other"}`}>
      <div className={`baxian-lab-bubble direction-${direction} ${grouped ? `group-${grouped}` : "is-single"}`}>
        {grouped === "start" || !grouped ? <Hero character={character} /> : null}
        <span className="baxian-lab-copy">{text}</span>
        <Seal character={character} />
      </div>
    </div>
  );
}

function Sticker() {
  return (
    <div className="baxian-lab-row is-self baxian-lab-sticker-row" aria-label="无气泡表情包示例">
      <img alt="挥手的小猫表情包" className="baxian-lab-sticker" src="/assets/niko/niko-greeting.webp" />
    </div>
  );
}

export default function BaxianBubbleLabPage() {
  const [direction, setDirection] = useState<Direction>("inset");
  const [character, setCharacter] = useState<Character>("lv");
  const current = directions.find((item) => item.key === direction) ?? directions[0];
  const currentCharacter = characters.find((item) => item.key === character) ?? characters[0];

  return (
    <main className={`baxian-lab-page theme-${currentCharacter.style}`}>
      <header className="baxian-lab-header">
        <div>
          <span>BAXIAN / BUBBLE STUDY</span>
          <h1>把印章收进气泡里</h1>
          <p>两套候选同时验证单行、多行、双方视角、连续消息与无气泡内容；每个真实气泡独立落款。</p>
        </div>
        <div className="baxian-lab-character-switcher" aria-label="切换角色">
          {characters.map((item) => <button className={character === item.key ? "is-active" : ""} key={item.key} onClick={() => setCharacter(item.key)} type="button">{item.name}</button>)}
        </div>
      </header>

      <nav className="baxian-lab-directions" aria-label="切换设计方案">
        {directions.map((item) => (
          <button className={direction === item.key ? "is-active" : ""} key={item.key} onClick={() => setDirection(item.key)} type="button">
            <span>{item.number}</span><strong>{item.name}</strong><small>{item.label}</small>
          </button>
        ))}
      </nav>

      <section className="baxian-lab-stage">
        <header className="baxian-lab-stage-copy">
          <div><span>{current.number} / 04</span>{current.recommended ? <b>推荐</b> : null}</div>
          <h2>{current.name}</h2><p>{current.note}</p>
        </header>
        <div className="baxian-lab-phone">
          <div className="baxian-lab-chat-head"><span>八仙主题预览</span><small>{currentCharacter.name} · 双方视角</small></div>
          <div className="baxian-lab-chat-flow">
            <time>20:26</time>
            <Bubble character={character} direction={direction} text="今晚见。" />
            <Bubble character={character} direction={direction} self text="云开之后，从桥边一路走到灯影尽头。" />
            <div className="baxian-lab-group">
              <Bubble character={character} direction={direction} grouped="start" text="剑已收好。" />
              <Bubble character={character} direction={direction} grouped="middle" text="茶也温着。" />
              <Bubble character={character} direction={direction} grouped="end" text="等你来，再慢慢讲这一程。" />
            </div>
            <div className="baxian-lab-group is-self-group">
              <Bubble character={character} direction={direction} grouped="start" self text="好。" />
              <Bubble character={character} direction={direction} grouped="end" self text="不见不散。" />
            </div>
            <Sticker />
          </div>
        </div>
      </section>

      <section className="baxian-lab-rationale">
        <article><span>01</span><strong>单行</strong><p>印章不应把短句撑高，也不能与字面争抢视线。</p></article>
        <article><span>02</span><strong>多行</strong><p>印章与最后一行对齐，文字换行后仍保留稳定的阅读边界。</p></article>
        <article><span>03</span><strong>边界</strong><p>连续消息逐条落款；表情包等无气泡内容不展示印章。</p></article>
      </section>
    </main>
  );
}
