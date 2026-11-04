// Заготовка для SMS-кодов (подтверждение телефона, восстановление пароля).
// Сейчас SMS-сервис не подключён: код только пишется в лог сервера.
// Чтобы подключить казахстанский SMS-сервис, замените тело sendCode() вызовом его API
// и задайте ключ через переменную окружения (например, SMS_API_KEY). Никогда не храните ключ в коде.

export async function sendCode(phone, code) {
  if (process.env.SMS_API_KEY) {
    throw new Error('SMS-сервис ещё не подключён: допишите отправку в server/sms.js');
  }
  console.log(`[sms:dev] код для ${phone}: ${code}`);
  return { sent: false, dev: true };
}
