import { useEffect, useRef, useState } from "react";
import { POSICOES } from "@core/index.js";

/** Slider fino estilo editor: rótulo à esquerda, valor à direita, duplo clique zera. */
export function Controle({ rotulo, valor, min = -100, max = 100, onChange, sufixo = "", trilho }) {
  const pct = ((valor - min) / (max - min)) * 100;
  const zero = min < 0 ? 0 : min;
  return (
    <label className={"controle" + (trilho ? " trilho-" + trilho : "")} onDoubleClick={() => onChange(zero)} title="Duplo clique para zerar">
      <span className="controle-rot">{rotulo}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={valor}
        style={{ "--pct": pct + "%" }}
        onChange={(e) => onChange(+e.target.value)}
      />
      <span className="controle-val">
        {valor > 0 && min < 0 ? "+" : ""}
        {valor}
        {sufixo}
      </span>
    </label>
  );
}

/** Seção recolhível do painel (▾ Título). */
export function Secao({ titulo, children, aberta: inicial = true, extra }) {
  const [aberta, setAberta] = useState(inicial);
  return (
    <section className={"secao" + (aberta ? " aberta" : "")}>
      <header onClick={() => setAberta(!aberta)}>
        <span className="tri">▾</span>
        <span>{titulo}</span>
        {extra && (
          <span className="extra" onClick={(e) => e.stopPropagation()}>
            {extra}
          </span>
        )}
      </header>
      {aberta && <div className="secao-corpo">{children}</div>}
    </section>
  );
}

/** Histograma RGB da imagem (calculado de uma versão pequena). */
export function Histograma({ url, info }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!url) return;
    let vivo = true;
    const img = new Image();
    img.onload = () => {
      if (!vivo || !ref.current) return;
      const esc = Math.min(1, 320 / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * esc));
      const h = Math.max(1, Math.round(img.height * esc));
      const tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      const t = tmp.getContext("2d", { willReadFrequently: true });
      t.drawImage(img, 0, 0, w, h);
      const d = t.getImageData(0, 0, w, h).data;
      const hs = [new Float32Array(256), new Float32Array(256), new Float32Array(256)];
      for (let p = 0; p < d.length; p += 4) {
        hs[0][d[p]]++;
        hs[1][d[p + 1]]++;
        hs[2][d[p + 2]]++;
      }
      // ignora os extremos ao escalar, pra um pico de preto/branco não achatar o resto
      const max = Math.max(...hs.map((x) => Math.max(...x.slice(2, 254)))) || 1;
      const cv = ref.current;
      const W = (cv.width = cv.clientWidth * devicePixelRatio);
      const H = (cv.height = cv.clientHeight * devicePixelRatio);
      const c = cv.getContext("2d");
      c.clearRect(0, 0, W, H);
      c.globalCompositeOperation = "lighter";
      ["rgba(225,70,70,.45)", "rgba(70,200,90,.42)", "rgba(80,120,240,.5)"].forEach((cor, k) => {
        c.fillStyle = cor;
        c.beginPath();
        c.moveTo(0, H);
        for (let i = 0; i < 256; i++) c.lineTo((i / 255) * W, H - Math.min(1, Math.sqrt(hs[k][i] / max)) * H * 0.95);
        c.lineTo(W, H);
        c.closePath();
        c.fill();
      });
    };
    img.src = url;
    return () => {
      vivo = false;
    };
  }, [url]);
  return (
    <div className="histograma">
      <canvas ref={ref} />
      {info && <div className="hist-info">{info}</div>}
    </div>
  );
}

/** Grade 3x3 pra escolher o canto da marca d'água. */
export function SeletorPosicao({ valor, onChange }) {
  return (
    <div className="seletor-posicao" role="radiogroup" aria-label="Posição da marca d'água">
      {POSICOES.map((p) => (
        <button key={p.id} title={p.nome} aria-label={p.nome} className={valor === p.id ? "ativo" : ""} onClick={() => onChange(p.id)} />
      ))}
    </div>
  );
}
