import { Fragment } from 'react';

const TOKEN = /(_\{[^}]*\}|\^\{[^}]*\}|_[A-Za-z0-9]|\^[A-Za-z0-9+\-−])/;

/** Text in which `_s` / `_{xyz}` become subscripts and `^2` / `^{xyz}` superscripts, flowing like ordinary prose. */
export function Rich({ children }: { children: string }) {
  return (
    <>
      {children.split(TOKEN).map((part, i) => {
        if (part.startsWith('_')) return <sub key={i}>{part.slice(1).replace(/[{}]/g, '')}</sub>;
        if (part.startsWith('^')) return <sup key={i}>{part.slice(1).replace(/[{}]/g, '')}</sup>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

/** Tiny formula renderer: `N_s = 120 f / P`, `T_{load}`, `V^2` become subscripts / superscripts. */
export function Eq({ children, block = false }: { children: string; block?: boolean }) {
  return (
    <span className={block ? 'math math-block' : 'math'}>
      <Rich>{children}</Rich>
    </span>
  );
}
