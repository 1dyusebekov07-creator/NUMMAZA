"""Создаёт тестовую PDF-выписку в формате Kaspi Gold (дата | сумма | операция | детали).
Это самодельный файл для автотестов, а не настоящая выписка банка."""
import sys
from datetime import date, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

out = sys.argv[1] if len(sys.argv) > 1 else 'kaspi_sample.pdf'
today = date.fromisoformat(sys.argv[2]) if len(sys.argv) > 2 else date.today()
pdfmetrics.registerFont(TTFont('DV', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))

def money(v):
    s = f"{abs(v):,.2f}".replace(',', ' ').replace('.', ',')
    return ('+ ' if v > 0 else '- ') + s + ' ₸'

rows = []
start = today - timedelta(days=60)
for i in range(61):
    d = start + timedelta(days=i)
    if d.day == 5: rows.append((d, 650000, 'Пополнение', 'ТОО Компания заработная плата'))
    if d.day == 6: rows.append((d, 50000, 'Пополнение', 'С Kaspi Депозита'))
    if i % 2 == 0: rows.append((d, -(4200 + i * 37), 'Покупка', 'MAGNUM CASH&CARRY ALMATY'))
    if d.weekday() >= 4: rows.append((d, -5350, 'Покупка', 'GLOVO*KZ'))
    if i % 3 == 0: rows.append((d, -1950, 'Покупка', 'YANDEX.GO'))
    if d.day == 12: rows.append((d, -2990, 'Покупка', 'NETFLIX.COM'))
    if d.day == 20: rows.append((d, -38000, 'Покупка', 'Alseco Коммунальные'))
    if i == 30: rows.append((d, -15000, 'Перевод', 'Айгерим Б.'))
    if i == 40: rows.append((d, -2400, 'Покупка', 'ТОО Неизвестный Мерчант'))
rows.sort(key=lambda r: r[0], reverse=True)

c = canvas.Canvas(out, pagesize=A4)
W, H = A4
def header(y):
    c.setFont('DV', 9)
    for x, t in ((40, 'Дата'), (100, 'Сумма'), (210, 'Операция'), (300, 'Детали')):
        c.drawString(x, y, t)
    return y - 16
c.setFont('DV', 13)
c.drawString(40, H - 50, 'ВЫПИСКА по Kaspi Gold')
c.setFont('DV', 9)
c.drawString(40, H - 66, f'за период с {start:%d.%m.%y} по {today:%d.%m.%y}')
c.drawString(40, H - 80, 'Остаток на начало периода: + 120 000,00 ₸')
y = header(H - 110)
for d, v, op, det in rows:
    if y < 50:
        c.drawString(W - 90, 30, f'Страница {c.getPageNumber()}')
        c.showPage(); c.setFont('DV', 9); y = header(H - 50)
    c.drawString(40, y, d.strftime('%d.%m.%y'))
    c.drawString(100, y, money(v))
    c.drawString(210, y, op)
    c.drawString(300, y, det)
    y -= 14
c.save()
print(out, len(rows))
