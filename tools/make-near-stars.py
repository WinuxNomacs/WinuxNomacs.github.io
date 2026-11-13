"""Makes docs/near-stars.json, the nearest stars for the tour's stage between the galaxy and the solar system.

Reads the HYG Database (v4.1, hygdata_v41.csv, by David Nash / astronexus, CC BY-SA 4.0:
https://github.com/astronexus/HYG-Database) and keeps the stars within 20 light-years that have a Gliese
catalogue number (the catalogue of nearby stars). That leaves out a handful of stars whose Hipparcos parallaxes
put them far too close (an F0 supergiant "at 18 light-years"), and the Sun. The output is under CC BY-SA 4.0
too, as a work adapted from HYG.

The JSON holds {"stars": [[x, y, z, absmag, bv], ...], "names": {"index": "name", ...}}: positions in
light-years from the Sun in galactic coordinates (x towards the galactic centre, y in the direction the Sun
moves round it, z to the galactic north pole), absolute visual magnitude and colour index B-V (estimated from
the spectral class where HYG has none: white dwarfs 0.0, the rest, all red dwarfs, 1.8). The few stars in
NAMES get names, which the tour shows with their distance.

    python3 -I tools/make-near-stars.py hygdata_v41.csv docs/near-stars.json
"""
import csv
import json
import math
import sys

LY_PER_PC = 3.26156
REACH_LY = 20
# The standard (Hipparcos) rotation from equatorial (J2000) to galactic coordinates, as in docs/main.js.
GALACTIC = [[-0.0548755604, -0.8734370902, -0.4838350155],
            [0.4941094279, -0.4448296300, 0.7469822445],
            [-0.8676661490, -0.1980763734, 0.4559837762]]
# Gliese numbers of the stars the tour names, and their names.
NAMES = {'Gl 559A': 'Alpha Centauri', 'Gl 699': "Barnard's Star", 'Gl 244A': 'Sirius',
         'Gl 144': 'Epsilon Eridani', 'Gl 280A': 'Procyon', 'Gl 71': 'Tau Ceti'}


def main(src, dst):
    rows = []
    with open(src, newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            dist = float(r['dist'])
            if not r['gl'] or not 0 < dist * LY_PER_PC < REACH_LY:
                continue
            eq = [float(r[k]) * LY_PER_PC for k in ('x', 'y', 'z')]
            gal = [sum(GALACTIC[i][j] * eq[j] for j in range(3)) for i in range(3)]
            bv = float(r['ci']) if r['ci'] else (0.0 if 'D' in r['spect'] else 1.8)
            rows.append((dist, r['gl'], gal, float(r['absmag']), bv))
    rows.sort()
    stars, names = [], {}
    for i, (_, gl, gal, absmag, bv) in enumerate(rows):
        stars.append([round(v, 3) for v in gal] + [round(absmag, 2), round(bv, 2)])
        if gl in NAMES:
            names[str(i)] = NAMES[gl]
    missing = set(NAMES.values()) - set(names.values())
    if missing:
        sys.exit(f'not found: {", ".join(sorted(missing))}')
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump({'source': 'HYG Database v4.1 (astronexus), CC BY-SA 4.0', 'stars': stars, 'names': names},
                  f, separators=(',', ':'))
        f.write('\n')
    print(f'{len(stars)} stars, {len(names)} named')
    # Check: every distance within reach.
    assert all(math.hypot(*s[:3]) < REACH_LY for s in stars)


if __name__ == '__main__':
    main(*sys.argv[1:3])
