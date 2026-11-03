import { POSICOES } from "@core/index.js";

export function Controle({ rotulo, valor, min = -100, max = 100, onChange, sufixo = "" }) {
  return (
    <label className="controle">
      <span>
        {rotulo} <b>{valor > 0 && min < 0 ? "+" : ""}{valor}{sufixo}</b>
      </span>
      <input type="range" min={min} max={max} value={valor} onChange={(e) => onChange(+e.target.value)} onDoubleClick={() => onChange(min < 0 ? 0 : min)} />
    </label>
  );
}

/** Grade 3x3 pra escolher o canto da marca d'água. */
export function SeletorPosicao({ valor, onChange }) {
  return (
    <div className="seletor-posicao" role="radiogroup" aria-label="Posição da marca d'água">
      {POSICOES.map((p) => (
        <button
          key={p.id}
          title={p.nome}
          aria-label={p.nome}
          className={valor === p.id ? "ativo" : ""}
          onClick={() => onChange(p.id)}
        />
      ))}
    </div>
  );
}
