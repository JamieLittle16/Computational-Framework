function hsvToRgb(h, s, v) {
    h /= 360;
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    i %= 6;
    return [
        [v, q, p, p, t, v][i] * 255,
        [t, v, v, q, p, p][i] * 255,
        [p, p, t, v, v, q][i] * 255,
    ];
}

export default hsvToRgb;
