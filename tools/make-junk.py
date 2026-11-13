"""Makes docs/junk.bin, the tracked objects round the Earth for the Earth up close's "Space junk" layer.

Reads CelesTrak's public data (https://celestrak.org), downloaded into one folder:
  satcat.csv                 https://celestrak.org/pub/satcat.csv (every catalogued object)
  gp-<group>.json            https://celestrak.org/NORAD/elements/gp.php?GROUP=<group>&FORMAT=json for the groups
                             active, analyst, fengyun-1c-debris, iridium-33-debris and cosmos-2251-debris
                             (orbital elements, "TLEs", for those objects)

It keeps every object still in orbit round the Earth. Those with published elements get them as they are, so
they can be put at their true places; the rest (most debris, rocket bodies and dead satellites) get their true
period, inclination and orbit shape from the catalogue, with a made-up orientation and place along the orbit
(seeded, so every run gives the same). Working satellites are those in the "active" group. The ISS and the
modules docked to it are left out: the page draws the ISS itself.

Layout, little-endian. A 24-byte header: epoch (float64, Unix milliseconds: the median epoch of the working
satellites' elements, which the offsets below count from), then four uint32 counts: all objects, working
satellites, other objects with elements, other objects modelled. Then 18 bytes per object in that order:
mean motion (float32, revolutions a day), epoch offset (float32, days), then as uint16 fractions of their range
eccentricity (0..1), inclination (0..180 degrees), right ascension of the ascending node, argument of perigee and
mean anomaly at the epoch (each 0..360 degrees).

    python3 -I tools/make-junk.py <download folder> docs/junk.bin
"""
import csv
import datetime
import json
import random
import struct
import sys

EARTH_KM = 6378.137
GROUPS = ['active', 'analyst', 'fengyun-1c-debris', 'iridium-33-debris', 'cosmos-2251-debris']
ISS = 25544


def frac(value, top):
    return max(0, min(65535, round(value / top * 65535)))


def epoch_ms(text):
    return datetime.datetime.fromisoformat(text).replace(tzinfo=datetime.timezone.utc).timestamp() * 1000


def main(src, dst):
    satcat = {}
    with open(f'{src}/satcat.csv', newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            satcat[int(r['NORAD_CAT_ID'])] = r
    docked = {n for n, r in satcat.items() if r['ORBIT_TYPE'] == 'DOC' or n == ISS}
    elements, working = {}, set()
    for g in GROUPS:
        with open(f'{src}/gp-{g}.json', encoding='utf-8') as f:
            for o in json.load(f):
                n = int(o['NORAD_CAT_ID'])
                if n in docked or (n in satcat and satcat[n]['DECAY_DATE']):
                    continue
                elements.setdefault(n, o)
                if g == 'active':
                    working.add(n)
    epochs = sorted(epoch_ms(elements[n]['EPOCH']) for n in working)
    epoch = round(epochs[len(epochs) // 2] / 60000) * 60000

    def exact(o):
        return (float(o['MEAN_MOTION']), (epoch_ms(o['EPOCH']) - epoch) / 86400000, float(o['ECCENTRICITY']),
                float(o['INCLINATION']), float(o['RA_OF_ASC_NODE']), float(o['ARG_OF_PERICENTER']),
                float(o['MEAN_ANOMALY']))

    rand = random.Random(20261113)
    modelled = []
    for n, r in sorted(satcat.items()):
        if (n in elements or n in docked or r['DECAY_DATE'] or r['ORBIT_CENTER'] != 'EA' or r['ORBIT_TYPE'] != 'ORB'
                or not (r['PERIOD'] and r['APOGEE'] and r['PERIGEE'] and r['INCLINATION'])):
            continue
        apo, peri = float(r['APOGEE']), float(r['PERIGEE'])
        a = (apo + peri) / 2 + EARTH_KM
        e = max(0.0, (apo - peri) / (2 * a))
        modelled.append((1440 / float(r['PERIOD']), 0.0, e, float(r['INCLINATION']),
                         rand.uniform(0, 360), rand.uniform(0, 360), rand.uniform(0, 360)))
    groups = [[exact(elements[n]) for n in sorted(working)],
              [exact(elements[n]) for n in sorted(elements) if n not in working],
              modelled]
    out = bytearray(struct.pack('<d4I', epoch, sum(map(len, groups)), *map(len, groups)))
    for g in groups:
        for mm, dt, e, inc, node, argp, ma in g:
            out += struct.pack('<ff5H', mm, dt, frac(min(e, 0.9999), 1), frac(inc, 180), frac(node % 360, 360),
                               frac(argp % 360, 360), frac(ma % 360, 360))
    with open(dst, 'wb') as f:
        f.write(out)
    when = datetime.datetime.fromtimestamp(epoch / 1000, datetime.timezone.utc)
    print(f'{when:%Y-%m-%d %H:%M} UTC: {len(groups[0])} working, {len(groups[1])} other with elements, '
          f'{len(groups[2])} modelled; {len(out)} bytes')


if __name__ == '__main__':
    main(*sys.argv[1:3])
