/**
 * Convert HSV colour values to an RGB tuple.
 * @param h - Hue in degrees [0, 360]
 * @param s - Saturation [0, 1]
 * @param v - Value/brightness [0, 1]
 * @returns [r, g, b] each in [0, 255]
 */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    const hNorm = h / 360;
    const i = Math.floor(hNorm * 6);
    const f = hNorm * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    const sector = i % 6;
    return [
        [v, q, p, p, t, v][sector] * 255,
        [t, v, v, q, p, p][sector] * 255,
        [p, p, t, v, v, q][sector] * 255,
    ];
}

export default hsvToRgb;
