"""Read the cell values of a legacy Excel 97 to 2003 workbook with the standard library."""

from __future__ import annotations

import struct

ENDOFCHAIN = 0xFFFFFFFE
FREESECT = 0xFFFFFFFF


def _stream(data: bytes, wanted: tuple[str, ...]) -> bytes:
    if data[:8] != bytes.fromhex("d0cf11e0a1b11ae1"):
        raise ValueError("Not an OLE2 compound file")
    sector = 1 << struct.unpack_from("<H", data, 0x1E)[0]
    mini = 1 << struct.unpack_from("<H", data, 0x20)[0]
    fat_count, first_dir = struct.unpack_from("<II", data, 0x2C)
    cutoff, first_minifat, minifat_count, first_difat, difat_count = struct.unpack_from("<IIIII", data, 0x38)

    def read(index: int) -> bytes:
        start = (index + 1) * sector
        return data[start:start + sector]

    difat = list(struct.unpack_from("<109I", data, 0x4C))
    nxt = first_difat
    for _ in range(difat_count):
        block = read(nxt)
        values = struct.unpack(f"<{sector // 4}I", block)
        difat.extend(values[:-1])
        nxt = values[-1]
    fat: list[int] = []
    for index in difat[:fat_count]:
        fat.extend(struct.unpack(f"<{sector // 4}I", read(index)))

    def chain(start: int, table: list[int]) -> list[int]:
        out, seen = [], set()
        while start not in (ENDOFCHAIN, FREESECT):
            if start in seen or start >= len(table):
                raise ValueError("Broken sector chain")
            seen.add(start)
            out.append(start)
            start = table[start]
        return out

    directory = b"".join(read(i) for i in chain(first_dir, fat))
    entries = []
    for offset in range(0, len(directory), 128):
        raw = directory[offset:offset + 128]
        length = struct.unpack_from("<H", raw, 0x40)[0]
        name = raw[:max(length - 2, 0)].decode("utf-16-le")
        kind = raw[0x42]
        start, size = struct.unpack_from("<II", raw, 0x74)
        entries.append((name, kind, start, size))
    root = next(entry for entry in entries if entry[1] == 5)
    ministream = b"".join(read(i) for i in chain(root[2], fat))
    minifat: list[int] = []
    for index in chain(first_minifat, fat) if minifat_count else []:
        minifat.extend(struct.unpack(f"<{sector // 4}I", read(index)))
    for name, kind, start, size in entries:
        if kind == 2 and name in wanted:
            if size < cutoff:
                return b"".join(ministream[i * mini:(i + 1) * mini] for i in chain(start, minifat))[:size]
            return b"".join(read(i) for i in chain(start, fat))[:size]
    raise ValueError("No workbook stream")


def _records(stream: bytes):
    offset = 0
    while offset + 4 <= len(stream):
        kind, length = struct.unpack_from("<HH", stream, offset)
        yield offset, kind, stream[offset + 4:offset + 4 + length]
        offset += 4 + length


class _Pieces:
    """Walk an SST payload whose strings may continue across CONTINUE records."""

    def __init__(self, pieces: list[bytes]):
        self.pieces, self.index, self.offset = pieces, 0, 0

    def take(self, count: int) -> bytes:
        out = b""
        while count:
            piece = self.pieces[self.index]
            if self.offset == len(piece):
                self.index, self.offset = self.index + 1, 0
                continue
            part = piece[self.offset:self.offset + count]
            self.offset += len(part)
            count -= len(part)
            out += part
        return out

    def chars(self, count: int, high: bool) -> str:
        text = []
        while count:
            piece = self.pieces[self.index]
            if self.offset == len(piece):
                # A string that crosses into CONTINUE restarts with its own option byte.
                self.index, self.offset = self.index + 1, 0
                high = bool(self.pieces[self.index][0] & 1)
                self.offset = 1
                continue
            width = 2 if high else 1
            available = (len(piece) - self.offset) // width
            n = min(available, count)
            raw = piece[self.offset:self.offset + n * width]
            text.append(raw.decode("utf-16-le" if high else "latin-1"))
            self.offset += n * width
            count -= n
        return "".join(text)


def _sst(pieces: list[bytes]) -> list[str]:
    reader = _Pieces(pieces)
    _, unique = struct.unpack("<II", reader.take(8))
    strings = []
    for _ in range(unique):
        count = struct.unpack("<H", reader.take(2))[0]
        flags = reader.take(1)[0]
        runs = struct.unpack("<H", reader.take(2))[0] if flags & 8 else 0
        extra = struct.unpack("<I", reader.take(4))[0] if flags & 4 else 0
        strings.append(reader.chars(count, bool(flags & 1)))
        reader.take(runs * 4 + extra)
    return strings


def _short_string(data: bytes, offset: int, length_size: int) -> str:
    count = data[offset] if length_size == 1 else struct.unpack_from("<H", data, offset)[0]
    flags = data[offset + length_size]
    start = offset + length_size + 1
    if flags & 1:
        return data[start:start + 2 * count].decode("utf-16-le")
    return data[start:start + count].decode("latin-1")


def _rk(value: int) -> float:
    if value & 2:
        number = float(value >> 2 if value < 0x80000000 else (value >> 2) - (1 << 30))
    else:
        number = struct.unpack("<d", struct.pack("<Q", (value & 0xFFFFFFFC) << 32))[0]
    return number / 100 if value & 1 else number


def read_workbook(data: bytes) -> dict[str, dict[tuple[int, int], object]]:
    """Return each worksheet's cells keyed by zero based (row, column)."""
    stream = _stream(data, ("Workbook", "Book"))
    sheets: list[tuple[int, str]] = []
    strings: list[str] = []
    records = list(_records(stream))
    for position, (_, kind, payload) in enumerate(records):
        if kind == 0x0085:
            sheets.append((struct.unpack_from("<I", payload, 0)[0], _short_string(payload, 6, 1)))
        elif kind == 0x00FC:
            pieces = [payload]
            for _, follow, more in records[position + 1:]:
                if follow != 0x003C:
                    break
                pieces.append(more)
            strings = _sst(pieces)
    by_offset = {offset: index for index, (offset, _, _) in enumerate(records)}
    workbook = {}
    for start, name in sheets:
        cells: dict[tuple[int, int], object] = {}
        pending = None
        for _, kind, payload in records[by_offset[start] + 1:]:
            if kind == 0x000A:
                break
            if kind == 0x00FD:
                row, col, _, index = struct.unpack_from("<HHHI", payload)
                cells[(row, col)] = strings[index]
            elif kind == 0x0203:
                row, col, _, value = struct.unpack_from("<HHHd", payload)
                cells[(row, col)] = value
            elif kind == 0x027E:
                row, col, _, value = struct.unpack_from("<HHHI", payload)
                cells[(row, col)] = _rk(value)
            elif kind == 0x00BD:
                row, first = struct.unpack_from("<HH", payload)
                count = (len(payload) - 6) // 6
                for n in range(count):
                    value = struct.unpack_from("<I", payload, 4 + n * 6 + 2)[0]
                    cells[(row, first + n)] = _rk(value)
            elif kind == 0x0204:
                row, col, _ = struct.unpack_from("<HHH", payload)
                cells[(row, col)] = _short_string(payload, 6, 2)
            elif kind == 0x0205:
                row, col, _, value, error = struct.unpack_from("<HHHBB", payload)
                cells[(row, col)] = {"error": value} if error else bool(value)
            elif kind == 0x0006:
                row, col = struct.unpack_from("<HH", payload)
                result = payload[6:14]
                if result[6:8] == b"\xff\xff":
                    if result[0] == 0:
                        pending = (row, col)
                    elif result[0] == 1:
                        cells[(row, col)] = bool(result[2])
                    elif result[0] == 3:
                        cells[(row, col)] = ""
                    else:
                        cells[(row, col)] = {"error": result[2]}
                else:
                    cells[(row, col)] = struct.unpack("<d", result)[0]
            elif kind == 0x0207 and pending:
                cells[pending] = _short_string(payload, 0, 2)
                pending = None
        workbook[name] = cells
    return workbook
