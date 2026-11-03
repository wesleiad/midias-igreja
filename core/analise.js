// Análise de qualidade e duplicadas. Trabalha com pixels RGBA puros
// ({ data, width, height }), então roda igual no PC (canvas) e no celular (jpeg-js).

export const LIMITES_PADRAO = {
  nitidezRuim: 20, // abaixo disso: tremida/desfocada
  nitidezDuvida: 30,
  brilhoMuitoEscuro: 35,
  brilhoMuitoClaro: 225,
  ladoMinimo: 480, // menor lado em pixels (foto original)
  distanciaDuplicada: 6, // diferença máxima entre "impressões digitais" (0-64)
};

// Tamanho em que a análise é feita (lado maior). Os limites acima foram calibrados nele.
export const LADO_ANALISE = 1024;

export function paraCinza({ data, width, height }) {
  const g = new Float32Array(width * height);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) {
    g[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  return g;
}

// Redução por média de área (evita serrilhado no hash).
export function reduzirCinza(g, w, h, nw, nh) {
  const out = new Float32Array(nw * nh);
  const sx = w / nw;
  const sy = h / nh;
  for (let y = 0; y < nh; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let s = 0;
      for (let yy = y0; yy < y1; yy++) {
        const row = yy * w;
        for (let xx = x0; xx < x1; xx++) s += g[row + xx];
      }
      out[y * nw + x] = s / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

// Nitidez independente da luz/contraste da cena: razão entre detalhe fino (Laplaciano) e
// detalhe médio (gradiente) nos blocos com mais textura. Borrão mata o fino primeiro.
// Devolve ~37-140 em fotos nítidas e ~10-26 em desfocadas/tremidas (medido em LADO_ANALISE).
export function nitidez(g, w, h) {
  const B = 32;
  const blocos = [];
  for (let by = 1; by < h - 1; by += B) {
    for (let bx = 1; bx < w - 1; bx += B) {
      let s = 0;
      let s2 = 0;
      let m = 0;
      let m2 = 0;
      let gs = 0;
      let n = 0;
      const ey = Math.min(by + B, h - 1);
      const ex = Math.min(bx + B, w - 1);
      for (let y = by; y < ey; y++) {
        const r = y * w;
        for (let x = bx; x < ex; x++) {
          const i = r + x;
          const v = g[i];
          const l = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * v;
          const gx = g[i + 1] - g[i - 1];
          const gy = g[i + w] - g[i - w];
          s += l;
          s2 += l * l;
          m += v;
          m2 += v * v;
          gs += gx * gx + gy * gy;
          n++;
        }
      }
      if (n > 16) blocos.push({ textura: m2 / n - (m / n) ** 2, razao: (s2 / n - (s / n) ** 2) / (gs / n + 1) });
    }
  }
  if (!blocos.length) return 0;
  blocos.sort((a, b) => b.textura - a.textura);
  const top = blocos.slice(0, Math.max(1, Math.ceil(blocos.length / 3)));
  return (100 * top.reduce((a, b) => a + b.razao, 0)) / top.length;
}

function percentil(hist, total, p) {
  const alvo = total * p;
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= alvo) return i;
  }
  return 255;
}

// Brilho médio, % de áreas pretas/estouradas e níveis por canal (usados no ajuste automático).
export function exposicao({ data }) {
  const hr = new Uint32Array(256);
  const hg = new Uint32Array(256);
  const hb = new Uint32Array(256);
  const hl = new Uint32Array(256);
  const n = data.length / 4;
  let soma = 0;
  for (let p = 0; p < data.length; p += 4) {
    const r = data[p];
    const gg = data[p + 1];
    const b = data[p + 2];
    const l = (0.299 * r + 0.587 * gg + 0.114 * b) | 0;
    hr[r]++;
    hg[gg]++;
    hb[b]++;
    hl[l]++;
    soma += l;
  }
  let escuros = 0;
  let claros = 0;
  for (let i = 0; i < 18; i++) escuros += hl[i];
  for (let i = 245; i < 256; i++) claros += hl[i];
  const niveis = [hr, hg, hb].map((h) => [percentil(h, n, 0.005), percentil(h, n, 0.995)]);
  return { brilho: soma / n, escuros: escuros / n, claros: claros / n, niveis };
}

// "Impressão digital" da foto (dHash 64 bits) em 16 caracteres hex.
export function dhash(g, w, h) {
  const p = reduzirCinza(g, w, h, 9, 8);
  let hex = "";
  for (let y = 0; y < 8; y++) {
    let byte = 0;
    for (let x = 0; x < 8; x++) byte = (byte << 1) | (p[y * 9 + x] > p[y * 9 + x + 1] ? 1 : 0);
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

const BITS = new Uint8Array(16).map((_, i) => (i & 1) + ((i >> 1) & 1) + ((i >> 2) & 1) + ((i >> 3) & 1));
export function distanciaHash(a, b) {
  let d = 0;
  for (let i = 0; i < 16; i++) d += BITS[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return d;
}

const limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/**
 * Mede uma foto já reduzida (lado maior ~LADO_ANALISE).
 * original = { largura, altura } da foto de verdade. Não julga: quem julga é avaliar().
 */
export function analisarImagem(img, original) {
  const g = paraCinza(img);
  const nit = nitidez(g, img.width, img.height);
  const exp = exposicao(img);
  const ladoMenor = Math.min(original.largura, original.altura);
  // Nota 0-100: nitidez (escala log) pesa mais, exposição e resolução completam.
  const notaNit = limitar((nit - 12) / (60 - 12));
  const notaExp = 1 - limitar(Math.abs(exp.brilho - 120) / 110) ** 2;
  const notaRes = limitar(ladoMenor / 1500);
  return {
    nitidez: Math.round(nit),
    brilho: Math.round(exp.brilho),
    escuros: +exp.escuros.toFixed(3),
    claros: +exp.claros.toFixed(3),
    ladoMenor,
    niveis: exp.niveis,
    hash: dhash(g, img.width, img.height),
    nota: Math.round(100 * (0.6 * notaNit + 0.25 * notaExp + 0.15 * notaRes)),
  };
}

/** Julga as medidas: { veredito: "boa" | "duvida" | "ruim", problemas: [...] }. */
export function avaliar(m, limites = LIMITES_PADRAO) {
  const problemas = [];
  let ruim = false;
  let duvida = false;
  if (m.nitidez < limites.nitidezRuim) {
    problemas.push("Desfocada ou tremida");
    ruim = true;
  } else if (m.nitidez < limites.nitidezDuvida) {
    problemas.push("Pouco nítida");
    duvida = true;
  }
  if (m.brilho < limites.brilhoMuitoEscuro && m.escuros > 0.55) {
    problemas.push("Muito escura");
    ruim = true;
  } else if (m.brilho < 60) {
    problemas.push("Escura");
    duvida = true;
  }
  // Muito branca mas cheia de detalhe costuma ser arte/print, não foto estourada.
  if (m.brilho > limites.brilhoMuitoClaro && m.claros > 0.5 && m.nitidez < 60) {
    problemas.push("Estourada (muito clara)");
    ruim = true;
  } else if (m.brilho > 205) {
    problemas.push("Clara demais");
    duvida = true;
  }
  if (m.ladoMenor < limites.ladoMinimo) {
    problemas.push("Resolução baixa");
    ruim = true;
  }
  return { problemas, veredito: ruim ? "ruim" : duvida ? "duvida" : "boa" };
}

/**
 * Agrupa fotos parecidas. itens = [{ id, hash, nota }].
 * Devolve grupos (2+ fotos), cada um ordenado da melhor pra pior: a 1ª fica, o resto é duplicada.
 */
export function agruparDuplicadas(itens, limite = LIMITES_PADRAO.distanciaDuplicada) {
  const pai = itens.map((_, i) => i);
  const raiz = (i) => (pai[i] === i ? i : (pai[i] = raiz(pai[i])));
  // Hash em 2 inteiros de 32 bits: comparar milhares de fotos fica rápido.
  const hi = Uint32Array.from(itens, (it) => parseInt(it.hash.slice(0, 8), 16));
  const lo = Uint32Array.from(itens, (it) => parseInt(it.hash.slice(8), 16));
  const pop = (v) => {
    v -= (v >>> 1) & 0x55555555;
    v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
    return Math.imul((v + (v >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
  };
  for (let i = 0; i < itens.length; i++) {
    for (let j = i + 1; j < itens.length; j++) {
      if (pop(hi[i] ^ hi[j]) + pop(lo[i] ^ lo[j]) <= limite) pai[raiz(i)] = raiz(j);
    }
  }
  const mapa = new Map();
  itens.forEach((it, i) => {
    const r = raiz(i);
    if (!mapa.has(r)) mapa.set(r, []);
    mapa.get(r).push(it);
  });
  return [...mapa.values()].filter((g) => g.length > 1).map((g) => g.sort((a, b) => b.nota - a.nota));
}
