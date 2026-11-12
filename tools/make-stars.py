"""Makes docs/stars.bin from the Yale Bright Star Catalogue, 5th Revised Ed. (Hoffleit & Warren 1991).

Get the catalogue from CDS (VizieR V/50): https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz, then run
    python3 -I tools/make-stars.py catalog.gz docs/stars.bin

Keeps the stars brighter than magnitude 6.0, brightest first, 6 bytes each, little-endian:
    uint16  right ascension (J2000), 0..65535 for 0..360 degrees
    uint16  declination (J2000), 0..65535 for -90..+90 degrees
    uint8   visual magnitude: (V + 2) * 25
    uint8   colour index B-V: (B-V + 0.5) * 100, clamped to 0..255 (0.6, a Sun-like white, when missing)
"""
import gzip
import struct
import sys

MAG_LIMIT = 6.0


def field(line, start, end):
    """Bytes start..end of the catalogue's fixed-width line (1-based, inclusive, as in its ReadMe)."""
    return line[start - 1:end].strip()


def main(src, dst):
    stars = []
    with gzip.open(src, 'rt', encoding='ascii') as f:
        for line in f:
            if not field(line, 76, 77) or not field(line, 103, 107):
                continue  # a few entries (novae, objects that are not stars) have no position or magnitude
            ra = (int(field(line, 76, 77)) + int(field(line, 78, 79)) / 60 + float(field(line, 80, 83)) / 3600) * 15
            dec = int(field(line, 85, 86)) + int(field(line, 87, 88)) / 60 + int(field(line, 89, 90)) / 3600
            if field(line, 84, 84) == '-':
                dec = -dec
            mag = float(field(line, 103, 107))
            bv = field(line, 110, 114)
            bv = float(bv) if bv else 0.6
            if mag < MAG_LIMIT:
                stars.append((mag, ra, dec, bv))
    stars.sort()
    out = bytearray()
    for mag, ra, dec, bv in stars:
        out += struct.pack('<HHBB', round(ra / 360 * 65535) % 65536, round((dec + 90) / 180 * 65535),
                           round((mag + 2) * 25), max(0, min(255, round((bv + 0.5) * 100))))
    with open(dst, 'wb') as f:
        f.write(out)
    print(f'{len(stars)} stars, {len(out)} bytes')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
