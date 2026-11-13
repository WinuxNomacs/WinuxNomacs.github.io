"""Makes docs/asteroids.bin, the asteroid belt and Jupiter's Trojans for the tour's solar system.

Reads two downloads from NASA JPL's Small-Body Database Query API (https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html),
the brightest asteroids (smallest absolute magnitude H) with their orbits, in one folder:
  belt.json     ...sbdb_query.api?sb-kind=a&sb-class=IMB,MBA,OMB&fields=pdes,name,class,H,epoch,a,e,i,om,w,ma
                   &sort=H&full-prec=true&limit=18000&sb-cdata={"AND":["H|DF"]}
  trojans.json  the same with sb-class=TJN&limit=2000
(the main belt's inner, middle and outer parts, and Jupiter's Trojans; H|DF keeps only those with a known H).

It keeps those whose osculating elements share the most common epoch (all but a handful of long-lost ones), so
one epoch serves all. Ceres, Pallas and Vesta come first, as the page names them; then the rest of the belt and
the Trojans, each brightest first.

Layout, little-endian. A 16-byte header: the epoch (float64, Julian day), then two uint32 counts: belt
asteroids (the three named ones included), Trojans. Then 14 bytes per asteroid: semi-major axis (float32, AU),
then as uint16 fractions of their range eccentricity (0..1), inclination (0..180 degrees), longitude of the
ascending node, argument of perihelion and mean anomaly at the epoch (each 0..360 degrees). Angles are referred
to the ecliptic and equinox of J2000, as JPL gives them.

    python3 -I tools/make-asteroids.py <download folder> docs/asteroids.bin
"""
import collections
import json
import struct
import sys

NAMED = ['1', '2', '4']  # Ceres, Pallas, Vesta


def frac(value, top):
    return max(0, min(65535, round(value / top * 65535)))


def main(src, dst):
    groups = []
    for name in ('belt', 'trojans'):
        with open(f'{src}/{name}.json', encoding='utf-8') as f:
            d = json.load(f)
        groups.append([dict(zip(d['fields'], r)) for r in d['data']])
    epoch = collections.Counter(r['epoch'] for g in groups for r in g).most_common(1)[0][0]
    kept = [[r for r in g if r['epoch'] == epoch] for g in groups]
    dropped = sum(map(len, groups)) - sum(map(len, kept))
    belt, trojans = kept
    named = [next(r for r in belt if r['pdes'] == p) for p in NAMED]
    belt = named + [r for r in belt if r['pdes'] not in NAMED]
    out = bytearray(struct.pack('<d2I', float(epoch), len(belt), len(trojans)))
    for r in belt + trojans:
        out += struct.pack('<f5H', float(r['a']), frac(float(r['e']), 1), frac(float(r['i']), 180),
                           frac(float(r['om']) % 360, 360), frac(float(r['w']) % 360, 360),
                           frac(float(r['ma']) % 360, 360))
    with open(dst, 'wb') as f:
        f.write(out)
    print(f'epoch JD {epoch}: {len(belt)} belt (first {", ".join(r["name"] for r in named)}), '
          f'{len(trojans)} Trojans, {dropped} dropped for another epoch; {len(out)} bytes')


if __name__ == '__main__':
    main(*sys.argv[1:3])
