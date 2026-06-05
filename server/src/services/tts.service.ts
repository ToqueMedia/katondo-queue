// TTS service — generates voice text for ticket announcements

// TTS service — no external dependencies needed

export function generateVoiceText(ticketNumber: string, stationName: string, language = 'pt'): string {
  const texts: Record<string, string> = {
    pt: `Senha ${ticketNumber}, dirija-se à ${stationName}.`,
    en: `Ticket ${ticketNumber}, please proceed to ${stationName}.`,
    es: `Número ${ticketNumber}, diríjase a ${stationName}.`,
  };

  return texts[language] || texts.pt;
}

export function generateVoiceTextFromTicket(
  ticketNumber: string,
  stationName: string,
  serviceName?: string,
  language = 'pt',
): string {
  if (serviceName) {
    const texts: Record<string, string> = {
      pt: `Senha ${ticketNumber}, serviço ${serviceName}, dirija-se à ${stationName}.`,
      en: `Ticket ${ticketNumber}, ${serviceName} service, please proceed to ${stationName}.`,
      es: `Número ${ticketNumber}, servicio ${serviceName}, diríjase a ${stationName}.`,
    };
    return texts[language] || texts.pt;
  }

  return generateVoiceText(ticketNumber, stationName, language);
}
