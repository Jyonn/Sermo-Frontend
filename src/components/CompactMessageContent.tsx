import "./CompactMessageContent.css";
export function CompactMessageContent({ name, preview }: { name: string; preview: string }) {
  return <><strong>{name}：</strong><span>{preview}</span></>;
}
