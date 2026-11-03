// Aplica filtro + marca d'água com Skia (nativo, rápido). Mesma matemática do PC (core).
import { Skia, TileMode, ImageFormat } from "@shopify/react-native-skia";
import { montarMatriz, matrizParaSkia, completarAjuste, retanguloMarca } from "../../core/index.js";

/** Devolve uma SkImage tratada, com lado maior <= maxLado. */
export function renderizar(img, { maxLado = 4096, ajuste, niveis, marca, logo }) {
  const esc = Math.min(1, maxLado / Math.max(img.width(), img.height()));
  const w = Math.max(1, Math.round(img.width() * esc));
  const h = Math.max(1, Math.round(img.height() * esc));
  const surf = Skia.Surface.Make(w, h);
  if (!surf) throw new Error("Sem memória para essa foto");
  const c = surf.getCanvas();
  const a = completarAjuste(ajuste);

  const p = Skia.Paint();
  p.setAntiAlias(true);
  if (ajuste) {
    p.setColorFilter(Skia.ColorFilter.MakeMatrix(matrizParaSkia(montarMatriz(a, niveis))));
    if (a.nitidez > 0) {
      // Máscara de nitidez 3x3: centro reforçado, vizinhos subtraídos.
      const k = (a.nitidez / 100) * 1.4;
      const kernel = Array(9).fill(-k / 9);
      kernel[4] = 1 + (8 * k) / 9;
      p.setImageFilter(Skia.ImageFilter.MakeMatrixConvolution(3, 3, kernel, 1, 0, 1, 1, TileMode.Clamp, false, null, null));
    }
  }
  c.drawImageRect(img, Skia.XYWHRect(0, 0, img.width(), img.height()), Skia.XYWHRect(0, 0, w, h), p);

  if (ajuste && a.vinheta > 0) {
    const v = Skia.Paint();
    const raio = Math.hypot(w / 2, h / 2);
    v.setShader(
      Skia.Shader.MakeRadialGradient(
        { x: w / 2, y: h / 2 },
        raio,
        [Skia.Color("rgba(0,0,0,0)"), Skia.Color("rgba(0,0,0,0)"), Skia.Color(`rgba(0,0,0,${(a.vinheta / 100) * 0.55})`)],
        [0, 0.45, 1],
        TileMode.Clamp,
      ),
    );
    c.drawRect(Skia.XYWHRect(0, 0, w, h), v);
  }

  if (marca?.ativa && logo) {
    const r = retanguloMarca(w, h, logo.width(), logo.height(), marca);
    const lp = Skia.Paint();
    lp.setAntiAlias(true);
    lp.setAlphaf((marca.opacidade ?? 85) / 100);
    c.drawImageRect(logo, Skia.XYWHRect(0, 0, logo.width(), logo.height()), Skia.XYWHRect(r.x, r.y, r.w, r.h), lp);
  }
  surf.flush();
  return surf.makeImageSnapshot();
}

export const paraJpeg = (img, qualidade = 92) => img.encodeToBytes(ImageFormat.JPEG, qualidade);
