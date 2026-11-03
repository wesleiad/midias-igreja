import { useEffect, useState } from "react";
import { PRESETS, retanguloMarca } from "@core/index.js";
import { urlFoto } from "../motor.js";
import { RIGOR } from "../config.js";
import { Controle, SeletorPosicao } from "./componentes.jsx";

// Converte qualquer imagem (inclusive SVG) em PNG de até 1200px, preservando a transparência.
async function paraPng(caminho) {
  const img = new Image();
  img.src = urlFoto(caminho);
  await img.decode();
  const w0 = img.naturalWidth || 1000;
  const h0 = img.naturalHeight || 1000;
  const esc = Math.min(1, 1200 / Math.max(w0, h0)) || 1;
  const cv = document.createElement("canvas");
  cv.width = Math.round(w0 * esc);
  cv.height = Math.round(h0 * esc);
  cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

function PreviaMarca({ fundo, logoUrl, marca }) {
  const [tam, setTam] = useState(null);
  useEffect(() => {
    if (!logoUrl) return;
    const i = new Image();
    i.onload = () => setTam({ w: i.naturalWidth, h: i.naturalHeight });
    i.src = logoUrl;
  }, [logoUrl]);
  const W = 1600;
  const H = 1067;
  const r = tam && retanguloMarca(W, H, tam.w, tam.h, marca);
  return (
    <div className="previa-marca" style={fundo ? { backgroundImage: `url(${fundo})` } : null}>
      {r && (
        <img
          src={logoUrl}
          alt="Logo"
          style={{
            left: (r.x / W) * 100 + "%",
            top: (r.y / H) * 100 + "%",
            width: (r.w / W) * 100 + "%",
            opacity: marca.opacidade / 100,
          }}
        />
      )}
    </div>
  );
}

export default function Configuracoes({ cfg, mudarCfg, fotos, logoUrl, recarregarLogo, irPara }) {
  const marca = cfg.marca;
  const setMarca = (p) => mudarCfg({ marca: { ...marca, ...p } });
  const [erro, setErro] = useState(null);
  const [versao, setVersao] = useState("");
  useEffect(() => {
    window.api.versao().then(setVersao);
  }, []);
  const fundo = fotos.find((f) => f.categoria === "boa" && f.largura > f.altura)?.miniatura;
  const preset = PRESETS.find((p) => p.id === cfg.filtroPadrao.presetId);

  async function trocarLogo() {
    setErro(null);
    const caminho = await window.api.escolherLogo();
    if (!caminho) return;
    try {
      await window.api.salvarLogo(await paraPng(caminho));
      await recarregarLogo();
      setMarca({ ativa: true });
    } catch {
      setErro("Não consegui abrir essa imagem. Tente um PNG ou JPG.");
    }
  }
  async function removerLogo() {
    await window.api.removerLogo();
    await recarregarLogo();
    setMarca({ ativa: false });
  }

  return (
    <section className="tela config">
      <div className="cartao">
        <h2>Marca d'água da igreja</h2>
        <div className="config-marca">
          <PreviaMarca fundo={fundo} logoUrl={logoUrl} marca={marca} />
          <div className="config-marca-opcoes">
            <div className="linha-acoes">
              <button className="btn primario" onClick={trocarLogo}>
                {logoUrl ? "Trocar logo" : "Escolher logo"}
              </button>
              {logoUrl && (
                <button className="btn" onClick={removerLogo}>
                  Remover
                </button>
              )}
            </div>
            {erro && <p className="erro">{erro}</p>}
            <small className="dica">Dica: PNG com fundo transparente (logo branco fica ótimo em fotos de culto).</small>
            {logoUrl && (
              <>
                <label className="check">
                  <input type="checkbox" checked={marca.ativa} onChange={(e) => setMarca({ ativa: e.target.checked })} />
                  Colocar em todas as fotos melhoradas
                </label>
                <div className="marca-rapida">
                  <div>
                    <span className="rotulo">Onde</span>
                    <SeletorPosicao valor={marca.posicao} onChange={(posicao) => setMarca({ posicao })} />
                  </div>
                  <div className="flex1">
                    <Controle rotulo="Tamanho" valor={marca.tamanho} min={5} max={40} sufixo="%" onChange={(tamanho) => setMarca({ tamanho })} />
                    <Controle rotulo="Opacidade" valor={marca.opacidade} min={20} max={100} sufixo="%" onChange={(opacidade) => setMarca({ opacidade })} />
                    <Controle rotulo="Distância da borda" valor={marca.margem} min={0} max={10} sufixo="%" onChange={(margem) => setMarca({ margem })} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="cartao">
        <h2>Filtro padrão</h2>
        <p>
          Usado sempre que você abre Revelar: <b>{preset ? preset.nome : "Personalizado"}</b>
        </p>
        <button className="btn" onClick={() => irPara("melhorar")}>
          Ajustar em Revelar
        </button>
      </div>

      <div className="cartao">
        <h2>Análise</h2>
        <label className="campo">
          <span>Rigor com fotos desfocadas</span>
          <select value={cfg.rigor} onChange={(e) => mudarCfg({ rigor: e.target.value })}>
            {Object.entries(RIGOR).map(([id, r]) => (
              <option key={id} value={id}>
                {r.nome}
              </option>
            ))}
          </select>
        </label>
        <small className="dica">Mudar o rigor reclassifica na hora, sem escanear de novo.</small>
        <Controle
          rotulo="Qualidade do JPG salvo"
          valor={cfg.qualidadeJpeg}
          min={70}
          max={100}
          sufixo="%"
          onChange={(qualidadeJpeg) => mudarCfg({ qualidadeJpeg })}
        />
      </div>
      <p className="dica centro" style={{ padding: ".5rem 0 1rem" }}>
        Mídias - Igreja · versão {versao} · atualiza sozinho
      </p>
    </section>
  );
}
