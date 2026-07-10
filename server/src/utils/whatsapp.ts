import axios from 'axios';

interface UserConfig {
  evolution_api_url: string;
  evolution_api_key: string;
  evolution_instance: string;
}

export async function sendWhatsAppReminder(user: UserConfig, phone: string, message: string): Promise<void> {
  if (!user.evolution_api_url || !user.evolution_api_key || !user.evolution_instance) {
    console.log('⚠️  WhatsApp não configurado, pulando envio');
    return;
  }

  const cleanPhone = phone.replace(/\D/g, '');
  const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

  try {
    await axios.post(
      `${user.evolution_api_url}/message/sendText/${user.evolution_instance}`,
      {
        number: phoneWithCountry,
        text: message,
      },
      {
        headers: {
          apikey: user.evolution_api_key,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    console.log(`✅ WhatsApp enviado para ${phoneWithCountry}`);
  } catch (error: any) {
    console.error(`❌ Erro ao enviar WhatsApp para ${phoneWithCountry}:`, error?.message || error);
  }
}
