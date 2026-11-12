// Makes docs/assets/img/earth-day.webp, earth-night.webp, earth-clouds.webp and moon.webp from NASA's public-domain
// maps, in a headless browser's canvas (no image library needed). Download these into one folder first:
//   c1.jpg  Blue Marble 2002 with clouds: Wikimedia Commons "File:Land ocean ice cloud hires.jpg"
//   c2.jpg  Black Marble city lights:      Wikimedia Commons "File:The earth at night.jpg"
//   c3.jpg  Blue Marble 2002, clear:       Wikimedia Commons "File:Whole world - land and oceans.jpg"
//   lroc_color_poles_1k.jpg  the Moon:     NASA SVS CGI Moon Kit, https://svs.gsfc.nasa.gov/4720
// (Commons serves 3840 px versions through its API's iiurlwidth.) Then, with Playwright installed:
//   node tools/make-earth-images.js <download folder> <output folder>
// The Earth maps become 2048x1024, the Moon 1024x512. The cloud layer is the cloudy map minus the clear one, left
// out where the clear map is already ice and with faint differences (noise) dropped.
const { chromium } = require('playwright');
const fs = require('fs');
const [src, out] = process.argv.slice(2);
const data = (f) => 'data:image/jpeg;base64,' + fs.readFileSync(`${src}/${f}`).toString('base64');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const res = await p.evaluate(async ([cloudy, night, day, moon]) => {
    const load = (s) => new Promise((r, e) => { const i = new Image(); i.onload = () => r(i); i.onerror = e; i.src = s; });
    const W = 2048, H = 1024;
    const draw = async (s, w = W, h = H) => { const c = new OffscreenCanvas(w, h), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(await load(s), 0, 0, w, h); return [c, x]; };
    const jpeg = async (c, q) => { const bl = await c.convertToBlob({ type: 'image/webp', quality: q }); const r = new FileReader(); return new Promise(ok => { r.onload = () => ok(r.result); r.readAsDataURL(bl); }); };
    const [dc, dx] = await draw(day), [cc, cx] = await draw(cloudy), [nc] = await draw(night);
    const d = dx.getImageData(0, 0, W, H), k = cx.getImageData(0, 0, W, H), out = new ImageData(W, H);
    let sum = 0, landDiff = 0;
    for (let i = 0; i < d.data.length; i += 4) {
      const L3 = 0.3 * d.data[i] + 0.59 * d.data[i + 1] + 0.11 * d.data[i + 2];
      const L1 = 0.3 * k.data[i] + 0.59 * k.data[i + 1] + 0.11 * k.data[i + 2];
      // Where the clear map is already ice-bright, clouds wouldn't show: none. Faint differences are noise: dropped.
      const ice = Math.max(0, Math.min(1, (L3 - 150) / 40));
      const a = Math.max(0, Math.min(1, (L1 - L3) / Math.max(255 - L3, 70))) * (1 - ice);
      const v = Math.round(255 * Math.min(1, Math.max(0, (a - 0.1) / 0.85)));
      out.data[i] = out.data[i + 1] = out.data[i + 2] = v; out.data[i + 3] = 255; sum += v;
      if (L1 < L3 - 20) landDiff++; // the clear map brighter than the cloudy one: the two don't line up
    }
    const oc = new OffscreenCanvas(W, H); oc.getContext('2d').putImageData(out, 0, 0);
    const [mc] = await draw(moon, 1024, 512);
    return { day: await jpeg(dc, 0.86), night: await jpeg(nc, 0.86), clouds: await jpeg(oc, 0.7), moon: await jpeg(mc, 0.86),
             cloudMean: sum / (W * H) / 255, mismatch: landDiff / (W * H) };
  }, [data('c1.jpg'), data('c2.jpg'), data('c3.jpg'), data('lroc_color_poles_1k.jpg')]);
  for (const k of ['day', 'night', 'clouds', 'moon']) fs.writeFileSync(`${out}/${k}.webp`, Buffer.from(res[k].split(',')[1], 'base64'));
  console.log('cloud cover', res.cloudMean.toFixed(3), 'mismatch', res.mismatch.toFixed(4));
  await b.close();
})();
