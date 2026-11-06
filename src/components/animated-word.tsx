import type { CSSProperties } from "react";
/** Text stays a single accessible phrase; individual letters are decorative. */
export function AnimatedWord({ text }: { text: string }) {
  return <span aria-hidden="true" className="animated-word">{Array.from(text).map((letter,index) => <span key={index} style={{ "--letter": index } as CSSProperties}><span className="letter-ink">{letter}</span></span>)}</span>;
}
