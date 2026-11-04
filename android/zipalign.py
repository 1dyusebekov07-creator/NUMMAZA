"""Минимальный zipalign: несжатые файлы (resources.arsc и т.п.) выравниваются по 4 байтам,
как требует Android 11+ для targetSdk >= 30. Сжатые файлы копируются как есть."""
import sys
import zipfile

src, dst = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, 'w') as zout:
    for info in zin.infolist():
        data = zin.read(info.filename)
        out = zipfile.ZipInfo(info.filename, date_time=info.date_time)
        out.external_attr = info.external_attr
        out.create_system = info.create_system
        # resources.arsc обязательно без сжатия; остальное — как было
        out.compress_type = zipfile.ZIP_STORED if (info.compress_type == zipfile.ZIP_STORED or info.filename == 'resources.arsc') else zipfile.ZIP_DEFLATED
        if out.compress_type == zipfile.ZIP_STORED:
            name_len = len(info.filename.encode('utf-8'))
            pos = zout.fp.tell()
            pad = (-(pos + 30 + name_len)) % 4
            out.extra = b'\x00' * pad
        zout.writestr(out, data)

# Проверка
with zipfile.ZipFile(dst) as z:
    for info in z.infolist():
        if info.compress_type == zipfile.ZIP_STORED:
            off = info.header_offset + 30 + len(info.filename.encode('utf-8')) + len(info.extra)
            assert off % 4 == 0, info.filename
print('aligned', dst)
