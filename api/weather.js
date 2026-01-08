export default async function handler(req, res) {
  const url = "https://api.open-meteo.com/v1/forecast?latitude=35&longitude=139&current_weather=true";

  try {
    const response = await fetch(url, { method: "GET" });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Open-Meteo returned an error" });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch Open-Meteo API",
      details: error.message
    });
  }
}
