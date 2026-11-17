// api/jogos-ao-vivo.js
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Usa o token da Vercel, ou o seu token novo como fallback
  const TOKEN = process.env.FUTPLAY_TOKEN || 'FUT-B882306D51DF3FF2DD14C597A8784C96BAE7';
  const API_URL = 'https://fut.nxcloud.site/ao-vivo';

  try {
    // Enviando o token na URL e no Header por garantia
    const response = await fetch(`${API_URL}?token=${TOKEN}`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/json'
      }
    });

    const text = await response.text();
    let data;
    
    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({ 
        error: 'A API não retornou JSON (provavelmente bloqueou a Vercel ou o token expirou).', 
        detalhes: text.substring(0, 200) 
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `API externa respondeu HTTP ${response.status}`, 
        detalhes: data 
      });
    }

    // Junta os jogos ao vivo e os próximos
    const aoVivo = (data.ao_vivo || []).map(jogo => ({ ...jogo, status_visual: 'ao_vivo' }));
    const proximos = (data.proximos || []).map(jogo => ({ ...jogo, status_visual: 'agendado' }));
    
    const todosJogos = [...aoVivo, ...proximos];

    const jogos = todosJogos.map(jogo => ({
      id: `${jogo.time_casa}-${jogo.time_fora}-${jogo.hora}`,
      liga: jogo.liga,
      timeCasa: jogo.time_casa,
      timeFora: jogo.time_fora,
      logoCasa: jogo.logo_casa,
      logoFora: jogo.logo_fora,
      placarCasa: jogo.placar_casa,
      placarFora: jogo.placar_fora,
      minuto: jogo.minuto,
      hora: jogo.hora,
      status: jogo.status_visual,
      canais: jogo.canais || []
    }));

    res.status(200).json({ jogos });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno no servidor', detalhes: error.message });
  }
};
