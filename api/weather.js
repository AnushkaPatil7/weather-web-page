export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=35&longitude=139&current_weather=true",
      { method: "GET" }
    );

    if (!response.ok) {
      throw new Error("Open-Meteo response failed");
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      error: "Failed to reach Open-Meteo",
      details: error.message,
    });
  }
}
