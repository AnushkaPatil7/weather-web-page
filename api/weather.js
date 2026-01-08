export default async function handler(req, res) {
  const url =
    'https://api.open-meteo.com/v1/forecast?latitude=35&longitude=139&current_weather=true';

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Open-Meteo failed' });
  }
}
