// api/jogos-ao-vivo.js
module.exports = async function handler(req, res) {
  // Cache de 1 minuto para evitar bloqueio da API
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Pega o token do painel da Vercel ou usa o que estava na sua imagem como fallback
  const TOKEN = process.env.FUTPLAY_TOKEN || 'FUT-3E9888A417A97E5205AC279053813F63F93';
  const API_URL = 'https://fut.nxcloud.site/ao-vivo';

  try {
    const response = await fetch(`${API_URL}?token=${TOKEN}`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Erro na API de jogos.' });
    }

    const data = await response.json();

    // Junta os jogos que estão rolando AGORA com os que VÃO COMEÇAR
    const aoVivo = (data.ao_vivo || []).map(jogo => ({ ...jogo, status_visual: 'ao_vivo' }));
    const proximos = (data.proximos || []).map(jogo => ({ ...jogo, status_visual: 'agendado' }));
    
    const todosJogos = [...aoVivo, ...proximos];

    // Formata os dados para o frontend
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
    console.error('[jogos-ao-vivo] erro:', error);
    res.status(502).json({ error: 'Falha ao buscar jogos ao vivo.' });
  }
};
