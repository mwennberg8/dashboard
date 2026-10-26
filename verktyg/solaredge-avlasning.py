#!/usr/bin/env python3
"""solaredge-avlasning.py – läser allt en SolarEdge-växelriktare visar över Modbus TCP.

Homeys Modbus-app säger att något fel rapporteras men inte vilket. Det här
skriptet läser registren direkt och sparar både råa värden och tolkade:

  * hela SunSpec-kedjan (från 40000): identitet, växelriktaren, alla mätare
  * SolarEdges egna block: lagringsstyrning (0xE000), batteri 1–3 (0xE100,
    0xE200, 0xE300) och effektstyrning (0xF000)

Det viktigaste för felsökning:
  * Växelriktarens status (SunSpec 1–8) och SolarEdges egen felkod (StVnd).
  * Batteriets största tillåtna laddeffekt enligt batteriet självt, dess status,
    spänning, ström och händelselogg.

Kräver bara Python 3.8 eller senare, inga extra paket. Körs på en dator i samma
nätverk som växelriktaren:

    python3 solaredge-avlasning.py 192.168.50.20
    python3 solaredge-avlasning.py 192.168.50.20 --logga 60     # var 60:e s till CSV

OBS: SolarEdge tar bara emot EN Modbus-anslutning åt gången. Får skriptet ingen
kontakt håller Homeys Modbus-app troligen anslutningen. Stäng av appen en stund
(Homey → Inställningar → Appar → SolarEdge + Growatt TCP modbus → Inaktivera),
kör skriptet och slå sedan på appen igen.

Registeradresserna i SolarEdge-blocken följer SolarEdges dokumentation och den
öppna Home Assistant-integrationen. Råvärdena sparas alltid, så en feltolkning
går att rätta i efterhand. SolarEdge lagrar 32- och 64-bitarsvärden i E-blocken
med det minst signifikanta ordet först; det tolkas så här.
"""

import argparse
import csv
import datetime as dt
import json
import os
import socket
import struct
import sys
import time

# ---------------------------------------------------------------- Modbus TCP


class ModbusFel(Exception):
    pass


class Modbus:
    """Minimal Modbus TCP-klient: bara funktion 3 (läs holding-register)."""

    def __init__(self, ip, port, enhet, timeout):
        self.ip, self.port, self.enhet, self.timeout = ip, port, enhet, timeout
        self.s = None
        self.tid = 0

    def anslut(self):
        self.s = socket.create_connection((self.ip, self.port), timeout=self.timeout)
        self.s.settimeout(self.timeout)

    def stang(self):
        try:
            if self.s:
                self.s.close()
        finally:
            self.s = None

    def _las_exakt(self, n):
        data = b''
        while len(data) < n:
            bit = self.s.recv(n - len(data))
            if not bit:
                raise ModbusFel('anslutningen stängdes av växelriktaren')
            data += bit
        return data

    def las(self, start, antal):
        """Läser `antal` register från `start`. Kastar ModbusFel vid undantag."""
        self.tid = (self.tid + 1) & 0xFFFF
        pdu = struct.pack('>BHH', 3, start, antal)
        self.s.sendall(struct.pack('>HHHB', self.tid, 0, len(pdu) + 1, self.enhet) + pdu)
        while True:
            tid, _proto, langd, _enhet = struct.unpack('>HHHB', self._las_exakt(7))
            svar = self._las_exakt(langd - 1)
            if tid == self.tid:
                break   # gamla svar från en tidigare timeout kastas
        if svar[0] & 0x80:
            raise ModbusFel(f'undantag {svar[1]} vid {start}+{antal}')
        n = svar[1]
        return list(struct.unpack('>' + 'H' * (n // 2), svar[2:2 + n]))


def las_omrade(mb, start, antal, karta, saknas, bit=100):
    """Läser ett område i bitar. Ger en bit undantag delas den tills enstaka
    register; register som inte finns hamnar i `saknas` i stället för att
    stoppa allt."""
    adr = start
    slut = start + antal
    while adr < slut:
        n = min(bit, slut - adr)
        try:
            for i, v in enumerate(mb.las(adr, n)):
                karta[adr + i] = v
        except ModbusFel:
            if n == 1:
                saknas.append(adr)
            else:
                las_omrade(mb, adr, n, karta, saknas, bit=max(1, n // 2))
        except socket.timeout:
            raise ModbusFel(f'ingen svar vid register {adr} (timeout)')
        adr += n

# ---------------------------------------------------------------- tolkning


def r(karta, a):
    return karta.get(a)


def u16(karta, a):
    return r(karta, a)


def s16(karta, a):
    v = r(karta, a)
    return None if v is None else (v - 0x10000 if v & 0x8000 else v)


def u32_be(karta, a):
    h, l = r(karta, a), r(karta, a + 1)
    return None if h is None or l is None else (h << 16) | l


def u32_le(karta, a):
    """SolarEdge E-block: minst signifikanta ordet först."""
    l, h = r(karta, a), r(karta, a + 1)
    return None if h is None or l is None else (h << 16) | l


def u64_le(karta, a):
    ord_ = [r(karta, a + i) for i in range(4)]
    if None in ord_:
        return None
    return ord_[0] | (ord_[1] << 16) | (ord_[2] << 32) | (ord_[3] << 48)


def f32_le(karta, a):
    v = u32_le(karta, a)
    if v is None:
        return None
    f = struct.unpack('>f', struct.pack('>I', v))[0]
    return None if f != f else round(f, 3)   # NaN → None


def text(karta, a, n):
    ord_ = [r(karta, a + i) for i in range(n)]
    if None in ord_:
        return None
    b = b''.join(struct.pack('>H', w) for w in ord_)
    return b.split(b'\x00')[0].decode('ascii', 'replace').strip()


def skalat(varde, sf):
    if varde is None or sf is None or sf in (-32768,):
        return None
    # SunSpec: 0xFFFF / 0x8000 betyder "inte implementerat"
    if varde in (0xFFFF, -32768):
        return None
    return round(varde * (10 ** sf), 3)


SUNSPEC_STATUS = {1: 'Av', 2: 'Sover (natt)', 3: 'Startar', 4: 'Producerar (MPPT)',
                  5: 'Begränsad (throttled)', 6: 'Stänger av', 7: 'FEL', 8: 'Standby'}
SUNSPEC_EVT1 = ['jordfel', 'DC-överspänning', 'AC frånkopplad', 'DC frånkopplad',
                'nät frånkopplat', 'skåp öppet', 'manuell avstängning', 'övertemperatur',
                'överfrekvens', 'underfrekvens', 'AC-överspänning', 'AC-underspänning',
                'säkring (sträng) löst', 'undertemperatur', 'minnesförlust', 'hårdvarutest misslyckades']
BATT_STATUS = {0: 'Av', 1: 'Standby', 2: 'Startar', 3: 'Laddar', 4: 'Laddar ur', 5: 'FEL',
               6: 'Håller laddning', 7: 'Vilar', 10: 'Energisparläge'}
LAGRING_LAGE = {0: 'Av', 1: 'Maximera egenkonsumtion', 2: 'Tidsstyrt', 3: 'Backup', 4: 'Fjärrstyrning'}
LADDA_LAGE = {0: 'Av', 1: 'Ladda bara överskott från sol', 2: 'Ladda från sol först',
              3: 'Ladda från sol och nät', 4: 'Maximera export', 5: 'Ladda ur mot förbrukning',
              7: 'Maximera egenkonsumtion'}
AC_POLICY = {0: 'AC-laddning av', 1: 'Alltid tillåten', 2: 'Fast energigräns', 3: 'Andel av produktion'}


def bitar(v, namn):
    if v is None:
        return None
    ut = [namn[i] if i < len(namn) else f'bit {i}' for i in range(32) if v & (1 << i)]
    return ut


def tolka_common(k, b):
    return {'tillverkare': text(k, b, 16), 'modell': text(k, b + 16, 16),
            'alternativ': text(k, b + 32, 8), 'version': text(k, b + 40, 8),
            'serienummer': text(k, b + 48, 16), 'enhetsadress': u16(k, b + 64)}


def tolka_vaxelriktare(k, b, modell):
    a_sf, v_sf, w_sf, hz_sf = s16(k, b + 4), s16(k, b + 11), s16(k, b + 13), s16(k, b + 15)
    st, stv = u16(k, b + 36), u16(k, b + 37)
    evt1 = u32_be(k, b + 38)
    return {
        'sunspec_modell': modell,
        'status_kod': st, 'status': SUNSPEC_STATUS.get(st, 'okänd'),
        'leverantorsstatus_kod (StVnd)': stv,
        'handelser_evt1': evt1, 'handelser_evt1_tolkat': bitar(evt1, SUNSPEC_EVT1),
        'handelser_evt2': u32_be(k, b + 40),
        'leverantorshandelser_1_4': [u32_be(k, b + o) for o in (42, 44, 46, 48)],
        'strom_A': skalat(u16(k, b), a_sf),
        'strom_fas_A': [skalat(u16(k, b + i), a_sf) for i in (1, 2, 3)],
        'spanning_fas_N_V': [skalat(u16(k, b + i), v_sf) for i in (8, 9, 10)],
        'effekt_W': skalat(s16(k, b + 12), w_sf),
        'frekvens_Hz': skalat(u16(k, b + 14), hz_sf),
        'skenbar_VA': skalat(s16(k, b + 16), s16(k, b + 17)),
        'reaktiv_VAr': skalat(s16(k, b + 18), s16(k, b + 19)),
        'effektfaktor_%': skalat(s16(k, b + 20), s16(k, b + 21)),
        'energi_totalt_Wh': skalat(u32_be(k, b + 22), s16(k, b + 24)),
        'dc_strom_A': skalat(u16(k, b + 25), s16(k, b + 26)),
        'dc_spanning_V': skalat(u16(k, b + 27), s16(k, b + 28)),
        'dc_effekt_W': skalat(s16(k, b + 29), s16(k, b + 30)),
        'kylflans_C': skalat(s16(k, b + 32), s16(k, b + 35)),
    }


def tolka_matare(k, b, modell):
    a_sf, v_sf, w_sf, e_sf = s16(k, b + 4), s16(k, b + 13), s16(k, b + 20), s16(k, b + 52)
    return {
        'sunspec_modell': modell,
        'strom_A': skalat(s16(k, b), a_sf),
        'strom_fas_A': [skalat(s16(k, b + i), a_sf) for i in (1, 2, 3)],
        'spanning_fas_N_V': [skalat(s16(k, b + i), v_sf) for i in (6, 7, 8)],
        'frekvens_Hz': skalat(s16(k, b + 14), s16(k, b + 15)),
        'effekt_W': skalat(s16(k, b + 16), w_sf),
        'effekt_fas_W': [skalat(s16(k, b + i), w_sf) for i in (17, 18, 19)],
        'energi_export_Wh': skalat(u32_be(k, b + 36), e_sf),
        'energi_import_Wh': skalat(u32_be(k, b + 44), e_sf),
        'handelser': u32_be(k, b + 103),
    }


def tolka_lagring(k):
    b = 0xE000
    lage, ac, std, kmd = u16(k, b + 4), u16(k, b + 5), u16(k, b + 0x0A), u16(k, b + 0x0D)
    return {
        'exportstyrning_lage': u16(k, b), 'exportstyrning_grans_lage': u16(k, b + 1),
        'exportstyrning_anlaggningsgrans_W': f32_le(k, b + 2),
        'lagringsstyrning_kod': lage, 'lagringsstyrning': LAGRING_LAGE.get(lage, 'okänd'),
        'ac_laddning_policy_kod': ac, 'ac_laddning_policy': AC_POLICY.get(ac, 'okänd'),
        'ac_laddning_grans': f32_le(k, b + 6),
        'backupreserv_%': f32_le(k, b + 8),
        'standardlage_kod': std, 'standardlage': LADDA_LAGE.get(std, 'okänd'),
        'fjarrkommando_timeout_s': u32_le(k, b + 0x0B),
        'fjarrkommando_lage_kod': kmd, 'fjarrkommando_lage': LADDA_LAGE.get(kmd, 'okänd'),
        'fjarr_laddgrans_W': f32_le(k, b + 0x0E),
        'fjarr_urladdningsgrans_W': f32_le(k, b + 0x10),
    }


def tolka_batteri(k, b):
    if r(k, b) is None and r(k, b + 0x6C) is None:
        return None
    st = u32_le(k, b + 0x86)
    return {
        'tillverkare': text(k, b, 16), 'modell': text(k, b + 0x10, 16),
        'firmware': text(k, b + 0x20, 16), 'serienummer': text(k, b + 0x30, 16),
        'enhets_id': u16(k, b + 0x40),
        'markenergi_Wh': f32_le(k, b + 0x42),
        'max_laddeffekt_kontinuerlig_W': f32_le(k, b + 0x44),
        'max_urladdning_kontinuerlig_W': f32_le(k, b + 0x46),
        'max_laddeffekt_topp_W': f32_le(k, b + 0x48),
        'max_urladdning_topp_W': f32_le(k, b + 0x4A),
        'medeltemperatur_C': f32_le(k, b + 0x6C),
        'maxtemperatur_C': f32_le(k, b + 0x6E),
        'spanning_V': f32_le(k, b + 0x70),
        'strom_A': f32_le(k, b + 0x72),
        'effekt_W': f32_le(k, b + 0x74),
        'livstid_urladdat_Wh': u64_le(k, b + 0x76),
        'livstid_laddat_Wh': u64_le(k, b + 0x7A),
        'max_energi_Wh': f32_le(k, b + 0x7E),
        'tillganglig_energi_Wh': f32_le(k, b + 0x80),
        'halsa_SOH_%': f32_le(k, b + 0x82),
        'laddniva_SOE_%': f32_le(k, b + 0x84),
        'status_kod': st, 'status': BATT_STATUS.get(st, 'okänd'),
        'status_intern': u32_le(k, b + 0x88),
        'handelselogg': [u16(k, b + 0x8A + i) for i in range(8)],
        'handelselogg_intern': [u16(k, b + 0x92 + i) for i in range(8)],
    }

# ---------------------------------------------------------------- avläsning


def las_allt(mb):
    karta, saknas, block = {}, [], []
    # SunSpec-kedjan: 'SunS' på 40000, sedan modell-id + längd tills 0xFFFF.
    las_omrade(mb, 40000, 2, karta, saknas)
    if (r(karta, 40000), r(karta, 40001)) != (0x5375, 0x6E53):
        raise ModbusFel('ingen SunSpec-signatur på 40000 – fel enhetsadress eller inte en SolarEdge?')
    adr = 40002
    for _ in range(40):
        las_omrade(mb, adr, 2, karta, saknas)
        mid, langd = r(karta, adr), r(karta, adr + 1)
        if mid is None or mid == 0xFFFF:
            break
        las_omrade(mb, adr + 2, langd, karta, saknas)
        block.append({'modell': mid, 'start': adr, 'data': adr + 2, 'langd': langd})
        adr += 2 + langd
    # SolarEdges egna block. Ett register som inte finns hoppas över.
    for start, antal in ((0xE000, 0x20), (0xE100, 0xA0), (0xE200, 0xA0), (0xE300, 0xA0), (0xF000, 0x20)):
        las_omrade(mb, start, antal, karta, saknas)
    return karta, saknas, block


def tolka(karta, block):
    ut = {'vaxelriktare': None, 'identitet': [], 'matare': [], 'ovriga_sunspec': []}
    for bl in block:
        m, d = bl['modell'], bl['data']
        if m == 1:
            ut['identitet'].append(tolka_common(karta, d))
        elif m in (101, 102, 103):
            ut['vaxelriktare'] = tolka_vaxelriktare(karta, d, m)
        elif 201 <= m <= 204:
            ut['matare'].append(tolka_matare(karta, d, m))
        else:
            ut['ovriga_sunspec'].append({'modell': m, 'start': bl['start'], 'langd': bl['langd']})
    ut['lagring'] = tolka_lagring(karta)
    ut['batterier'] = [x for x in (tolka_batteri(karta, b) for b in (0xE100, 0xE200, 0xE300)) if x]
    ut['effektstyrning'] = {'aktiv_effektgrans_%': u16(karta, 0xF001)}
    return ut


def rapport(t, saknas, ip):
    rad = [f'SolarEdge-avläsning {dt.datetime.now():%Y-%m-%d %H:%M:%S} – {ip}', '']
    for i, idn in enumerate(t['identitet']):
        rad.append(f"{'Växelriktare' if i == 0 else f'Enhet {i}'}: {idn['tillverkare']} {idn['modell']}"
                   f" · version {idn['version']} · serienr {idn['serienummer']}")
    v = t['vaxelriktare']
    if v:
        rad += ['', 'VÄXELRIKTARE',
                f"  Status: {v['status_kod']} = {v['status']}",
                f"  SolarEdges egen statuskod (StVnd): {v['leverantorsstatus_kod (StVnd)']}"
                '  ← slå upp i SolarEdges fellista / mySolarEdge',
                f"  Händelser (Evt1): {v['handelser_evt1_tolkat'] or 'inga'}",
                f"  Leverantörshändelser: {v['leverantorshandelser_1_4']}",
                f"  AC: {v['effekt_W']} W · {v['strom_A']} A · {v['frekvens_Hz']} Hz · fas-N {v['spanning_fas_N_V']} V",
                f"  DC: {v['dc_effekt_W']} W · {v['dc_spanning_V']} V · {v['dc_strom_A']} A",
                f"  Kylfläns: {v['kylflans_C']} °C"]
    for i, m in enumerate(t['matare']):
        rad += ['', f'MÄTARE {i + 1} (SunSpec {m["sunspec_modell"]})',
                f"  Effekt: {m['effekt_W']} W (faser {m['effekt_fas_W']})",
                f"  Ström: {m['strom_fas_A']} A · Spänning: {m['spanning_fas_N_V']} V",
                f"  Energi: import {m['energi_import_Wh']} Wh · export {m['energi_export_Wh']} Wh",
                f"  Händelser: {m['handelser']}"]
    L = t['lagring']
    rad += ['', 'LAGRINGSSTYRNING',
            f"  Läge: {L['lagringsstyrning_kod']} = {L['lagringsstyrning']}",
            f"  AC-laddning: {L['ac_laddning_policy_kod']} = {L['ac_laddning_policy']} (gräns {L['ac_laddning_grans']})",
            f"  Standardläge: {L['standardlage_kod']} = {L['standardlage']}",
            f"  Fjärrkommando: {L['fjarrkommando_lage_kod']} = {L['fjarrkommando_lage']}"
            f" · timeout {L['fjarrkommando_timeout_s']} s",
            f"  Fjärr laddgräns: {L['fjarr_laddgrans_W']} W · urladdningsgräns: {L['fjarr_urladdningsgrans_W']} W",
            f"  Backupreserv: {L['backupreserv_%']} % · Exportgräns: {L['exportstyrning_anlaggningsgrans_W']} W",
            f"  Aktiv effektgräns: {t['effektstyrning']['aktiv_effektgrans_%']} %"]
    for i, b in enumerate(t['batterier']):
        rad += ['', f'BATTERI {i + 1}: {b["tillverkare"]} {b["modell"]} · firmware {b["firmware"]} · serienr {b["serienummer"]}',
                f"  Status: {b['status_kod']} = {b['status']} · intern status: {b['status_intern']}",
                f"  MAX LADDEFFEKT enligt batteriet: kontinuerlig {b['max_laddeffekt_kontinuerlig_W']} W"
                f" · topp {b['max_laddeffekt_topp_W']} W",
                f"  Max urladdning: kontinuerlig {b['max_urladdning_kontinuerlig_W']} W · topp {b['max_urladdning_topp_W']} W",
                f"  Nu: {b['effekt_W']} W · {b['spanning_V']} V · {b['strom_A']} A",
                f"  Laddnivå {b['laddniva_SOE_%']} % · hälsa {b['halsa_SOH_%']} %"
                f" · energi {b['tillganglig_energi_Wh']}/{b['max_energi_Wh']} Wh (märk {b['markenergi_Wh']} Wh)",
                f"  Temperatur: medel {b['medeltemperatur_C']} °C · max {b['maxtemperatur_C']} °C",
                f"  Händelselogg: {' '.join(f'{x:04X}' if x is not None else '----' for x in b['handelselogg'])}",
                f"  Händelselogg (intern): {' '.join(f'{x:04X}' if x is not None else '----' for x in b['handelselogg_intern'])}"]
    if not t['batterier']:
        rad += ['', 'BATTERI: inga batteriregister svarade.']
    rad += ['', f'Register som inte finns (hoppades över): {len(saknas)} st'
            + (' – ' + ', '.join(omraden(saknas)) if saknas else '')]
    return '\n'.join(rad)


def omraden(adresser):
    """[57856, 57857, …] → ['0xE200–0xE29F (160)'] – läsbart i rapporten."""
    ut, a = [], sorted(adresser)
    i = 0
    while i < len(a):
        j = i
        while j + 1 < len(a) and a[j + 1] == a[j] + 1:
            j += 1
        ut.append(f'0x{a[i]:04X}' + (f'–0x{a[j]:04X}' if j > i else '') + f' ({j - i + 1})')
        i = j + 1
    return ut


LOGG_FALT = ['tid', 'vx_status', 'vx_stvnd', 'vx_effekt_W', 'vx_dc_V', 'batt_status', 'batt_status_intern',
             'batt_effekt_W', 'batt_V', 'batt_A', 'batt_soe_%', 'batt_temp_C', 'batt_maxladd_W',
             'fjarr_laddgrans_W', 'standardlage', 'matare_effekt_W']


def logg_rad(t):
    v, b = t['vaxelriktare'] or {}, (t['batterier'] or [{}])[0]
    m = (t['matare'] or [{}])[0]
    return [dt.datetime.now().isoformat(timespec='seconds'), v.get('status_kod'),
            v.get('leverantorsstatus_kod (StVnd)'), v.get('effekt_W'), v.get('dc_spanning_V'),
            b.get('status_kod'), b.get('status_intern'), b.get('effekt_W'), b.get('spanning_V'),
            b.get('strom_A'), b.get('laddniva_SOE_%'), b.get('medeltemperatur_C'),
            b.get('max_laddeffekt_kontinuerlig_W'), t['lagring']['fjarr_laddgrans_W'],
            t['lagring']['standardlage_kod'], m.get('effekt_W')]


def main():
    p = argparse.ArgumentParser(description='Läser allt en SolarEdge-växelriktare visar över Modbus TCP.')
    p.add_argument('ip', help='växelriktarens IP-adress')
    p.add_argument('--port', type=int, default=1502, help='Modbus TCP-port (SolarEdge: 1502)')
    p.add_argument('--enhet', type=int, default=1, help='Modbus-enhetsadress (oftast 1)')
    p.add_argument('--timeout', type=float, default=5.0)
    p.add_argument('--ut', default='.', help='mapp för filerna')
    p.add_argument('--logga', type=int, metavar='SEK',
                   help='läs om och om igen och lägg nyckelvärden i en CSV-fil var SEK sekund')
    a = p.parse_args()

    os.makedirs(a.ut, exist_ok=True)
    mb = Modbus(a.ip, a.port, a.enhet, a.timeout)
    try:
        mb.anslut()
    except OSError as e:
        sys.exit(f'Kunde inte ansluta till {a.ip}:{a.port} – {e}\n'
                 'SolarEdge tar bara emot en Modbus-anslutning åt gången. Stäng av Homeys '
                 'Modbus-app en stund och försök igen. Kontrollera också att Modbus TCP är '
                 'påslaget i växelriktaren (SetApp → Kommunikation → Modbus TCP).')
    try:
        karta, saknas, block = las_allt(mb)
        t = tolka(karta, block)
        stam = os.path.join(a.ut, f'solaredge-{dt.datetime.now():%Y%m%d-%H%M%S}')
        with open(stam + '.json', 'w', encoding='utf-8') as f:
            json.dump({'tid': dt.datetime.now().isoformat(timespec='seconds'), 'ip': a.ip,
                       'tolkat': t, 'sunspec_block': block, 'saknade_register': saknas,
                       'register': {str(k): v for k, v in sorted(karta.items())}},
                      f, ensure_ascii=False, indent=1)
        txt = rapport(t, saknas, a.ip)
        with open(stam + '.txt', 'w', encoding='utf-8') as f:
            f.write(txt + '\n')
        print(txt)
        print(f'\nSparat: {stam}.json (alla {len(karta)} register) och {stam}.txt')

        if a.logga:
            fil = os.path.join(a.ut, 'solaredge-logg.csv')
            ny = not os.path.exists(fil)
            print(f'Loggar till {fil} var {a.logga}:e sekund. Avbryt med Ctrl+C.')
            with open(fil, 'a', newline='', encoding='utf-8') as f:
                w = csv.writer(f)
                if ny:
                    w.writerow(LOGG_FALT)
                while True:
                    try:
                        k, s, bl = las_allt(mb)
                        rad = logg_rad(tolka(k, bl))
                        w.writerow(rad)
                        f.flush()
                        print(' · '.join(f'{n}={v}' for n, v in zip(LOGG_FALT, rad)), flush=True)
                    except (ModbusFel, OSError) as e:
                        print(f'{dt.datetime.now():%H:%M:%S} fel: {e} – ansluter om', flush=True)
                        mb.stang()
                        time.sleep(5)
                        try:
                            mb.anslut()
                        except OSError:
                            pass
                    time.sleep(a.logga)
    except KeyboardInterrupt:
        print('\nAvbrutet.')
    except ModbusFel as e:
        sys.exit(f'Modbus-fel: {e}')
    finally:
        mb.stang()


if __name__ == '__main__':
    main()
